import type { EventClient } from "@claudin/daemon/client";
import {
  type BackgroundColor,
  findAwaitingCalls,
  findGroupId,
  findQuestionCalls,
  readHistoryText,
  type SessionState,
  THEME_NAMES,
  type ThemeName,
} from "@claudin/events";
import { BoxRenderable, type CliRenderer, createCliRenderer } from "@opentui/core";
import { BackgroundPanel } from "./components/backgroundPanel.ts";
import { DiffViewerPanel } from "./components/diffViewerPanel.ts";
import { HeaderBar } from "./components/headerBar.ts";
import { ListPopover } from "./components/listPopover.ts";
import { PromptInput } from "./components/promptInput.ts";
import { ScrollbackView } from "./components/scrollbackView.ts";
import { SessionInfoBar } from "./components/sessionInfoBar.ts";
import { StatusLine } from "./components/statusLine.ts";
import { buildListView } from "./format/listViews.ts";
import { isStatusBusy } from "./input/agentBusy.ts";
import { attachSession, bootSession, requestRateLimit } from "./input/agentSessionActions.ts";
import { acceptAutocomplete, syncAutocomplete } from "./input/autocomplete.ts";
import {
  answerApproval,
  cancelTurn,
  type PromptDelivery,
  submitPrompt,
} from "./input/promptActions.ts";
import { createKeyPresses, routeKey } from "./input/routeKeys.ts";
import { reactToEvent } from "./input/sessionReactions.ts";
import { TurnNotifier } from "./notify/turnNotifier.ts";
import { buildHistoryPath, readHistoryFile } from "./prompt/historyFile.ts";
import { HistorySaver } from "./prompt/historySaver.ts";
import { AppStore } from "./store/appStore.ts";
import { applyTheme, Theme } from "./theme/colors.ts";
import { createSyntaxStyle } from "./theme/syntaxStyle.ts";

const CLOCK_INTERVAL_MS = 100;
const RATE_LIMIT_INTERVAL_MS = 60_000;
const RATE_LIMIT_RETRY_MS = 5_000;

export type TuiOptions = {
  renderer?: CliRenderer;
  resumeSessionId?: string;
  attach?: boolean;
  historyPath?: string;
  onExit?: (sessionId: string) => void;
};

const readShownTheme = ({ theme, ui }: SessionState): ThemeName =>
  (ui.picker?.kind === "theme" ? THEME_NAMES[ui.picker.selected] : undefined) ?? theme;

const readShownBackground = ({ background, ui }: SessionState): BackgroundColor =>
  ui.backgroundEditor?.color ?? background;

export async function startTui(
  client: EventClient,
  options: TuiOptions = {},
): Promise<CliRenderer> {
  const activeRenderer =
    options.renderer ?? (await createCliRenderer({ exitOnCtrlC: false, useMouse: true }));
  const store = new AppStore(client);
  let syntaxStyle = createSyntaxStyle(activeRenderer);
  let appliedTheme: ThemeName = readShownTheme(store.state);
  let appliedBackground = readShownBackground(store.state);

  const header = new HeaderBar(activeRenderer);
  const infoBar = new SessionInfoBar(activeRenderer);
  const popover = new ListPopover(activeRenderer);
  const backgroundPanel = new BackgroundPanel(activeRenderer);
  const statusLine = new StatusLine(activeRenderer, () => cancelTurn(store));
  const scrollback = new ScrollbackView(activeRenderer, {
    syntaxStyle,
    hooks: {
      syntaxStyle,
      onDecision: (decision, id) => answerApproval(store, decision, id),
      onToggle: (callId) => store.emit({ type: "ui.tool.toggled", callId }),
    },
  });

  const diffViewer = new DiffViewerPanel(activeRenderer, syntaxStyle);
  const submitInput = (delivery: PromptDelivery) => {
    const draft = input.compose();
    if (!submitPrompt(store, draft.text, delivery, draft.images)) return;
    input.clear();
    if (store.state.ui.history) store.emit({ type: "ui.history.reset" });
  };

  const historyPath = options.historyPath ?? buildHistoryPath(process.cwd());
  const historySaver = new HistorySaver(historyPath);
  let destroyed = false;
  const saveDraft = (text: string) => {
    const { ui, promptHistory } = store.state;
    if (ui.history && text === readHistoryText(store.state)) return;
    historySaver.schedule(promptHistory, text);
  };

  const input = new PromptInput(activeRenderer, {
    onSubmit: () => submitInput("send"),
    onChange: (text, cursor) => {
      syncAutocomplete(store, text, cursor);
      saveDraft(text);
    },
  });

  const root = new BoxRenderable(activeRenderer, {
    width: "100%",
    height: "100%",
    flexDirection: "column",
    backgroundColor: Theme.bg.default,
  });
  const parts = [
    header,
    scrollback,
    diffViewer,
    statusLine,
    popover,
    backgroundPanel,
    input,
    infoBar,
  ];
  for (const part of parts) root.add(part.renderable);
  activeRenderer.root.add(root);
  for (const part of [header, statusLine, popover, backgroundPanel, input, infoBar]) {
    part.renderable.onMouseScroll = ({ scroll }) => {
      if (scroll?.direction === "up") scrollback.scrollByLines(-1);
      if (scroll?.direction === "down") scrollback.scrollByLines(1);
    };
  }

  const syncTheme = (state: SessionState) => {
    const shownTheme = readShownTheme(state);
    const shownBackground = readShownBackground(state);
    const themeChanged = shownTheme !== appliedTheme;
    if (!themeChanged && shownBackground === appliedBackground) return;
    appliedTheme = shownTheme;
    appliedBackground = shownBackground;
    applyTheme(shownTheme, shownBackground);
    if (themeChanged) {
      const previous = syntaxStyle;
      syntaxStyle = createSyntaxStyle(activeRenderer);
      scrollback.reset(syntaxStyle);
      diffViewer.reset(syntaxStyle);
      previous.destroy();
    }
    root.backgroundColor = Theme.bg.default;
    input.applyColors();
  };

  let revealedCallId: string | undefined;
  const render = (state: SessionState) => {
    syncTheme(state);
    header.update(state);
    statusLine.update(state);
    infoBar.update(state);
    scrollback.update(state);
    scrollback.renderable.visible = state.ui.diffViewer === null;
    diffViewer.update(state);
    popover.update(buildListView(state));
    backgroundPanel.update(state);
    const inputFocused = state.ui.focus === "input";
    input.setFocused(inputFocused);
    scrollback.setFocused(!inputFocused);
    input.setBusy(isStatusBusy(state.status));
    input.setBorderColor(inputFocused ? Theme.status.success : Theme.border.separator);
    const awaitingId = (findAwaitingCalls(state)[0] ?? findQuestionCalls(state)[0])?.id;
    if (awaitingId && awaitingId !== revealedCallId) {
      scrollback.revealEntry(findGroupId(state, awaitingId) ?? "");
    }
    revealedCallId = awaitingId;
  };

  store.subscribe(render);
  const notifier = new TurnNotifier(activeRenderer);
  store.subscribeOwnEvents((event) => {
    reactToEvent(store, event);
    notifier.notify(event);
    if (event.type === "ui.exit.requested") activeRenderer.destroy();
  });
  const editor = {
    read: () => input.text,
    replace: (text: string) => input.replaceText(text, text.length),
  };
  const presses = createKeyPresses();
  activeRenderer.keyInput.on("keypress", (key) => {
    const targets = {
      store,
      presses,
      scrollback,
      diffViewer,
      editor,
      acceptCompletion: () => acceptAutocomplete(store, input),
      submitInput,
      exit: () => activeRenderer.destroy(),
    };
    if (routeKey(key, targets)) key.preventDefault();
  });

  const clock = setInterval(() => {
    if (store.state.status !== "idle") store.emit({ type: "ui.clock.ticked", now: Date.now() });
  }, CLOCK_INTERVAL_MS);
  let lastRateLimitAt = Date.now();
  const rateLimitPoll = setInterval(() => {
    const { rateLimits } = store.state;
    const missing = !rateLimits.fiveHour && !rateLimits.sevenDay;
    const waited = Date.now() - lastRateLimitAt;
    if (waited < (missing ? RATE_LIMIT_RETRY_MS : RATE_LIMIT_INTERVAL_MS)) return;
    lastRateLimitAt = Date.now();
    requestRateLimit(store);
  }, RATE_LIMIT_RETRY_MS);
  activeRenderer.on("destroy", () => {
    clearInterval(clock);
    clearInterval(rateLimitPoll);
    destroyed = true;
    void historySaver.flush();
    options.onExit?.(store.state.sessionId);
    store.close();
  });

  void readHistoryFile(historyPath).then((entries) => {
    if (!destroyed) store.emit({ type: "ui.history.loaded", entries });
  });
  render(store.state);
  input.setFocused(true);
  if (options.attach) attachSession(store);
  else bootSession(store, options.resumeSessionId);
  return activeRenderer;
}
