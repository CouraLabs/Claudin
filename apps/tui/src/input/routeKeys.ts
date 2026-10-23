import { isCustomRow } from "@claudin/events";
import type { KeyEvent } from "@opentui/core";
import type { DiffViewerPanel } from "../components/diffViewerPanel.ts";
import type { ScrollbackView } from "../components/scrollbackView.ts";
import type { AppStore } from "../store/appStore.ts";
import { isAgentBusy } from "./agentBusy.ts";
import { routeAutocompleteKey } from "./autocomplete.ts";
import { adjustBackground, closeBackgroundEditor, saveBackground } from "./backgroundActions.ts";
import { type InputEditor, routeHistoryKey, routeHistorySearchKey } from "./historyActions.ts";
import { openModelPicker } from "./localCommands.ts";
import { confirmPicker } from "./pickerActions.ts";
import { answerApproval, cancelTurn, type PromptDelivery } from "./promptActions.ts";
import { confirmQuestion, dismissQuestion } from "./questionActions.ts";
import { showToast } from "./toastActions.ts";

export type KeyPresses = { escapeAt: number; ctrlCAt: number };

export const createKeyPresses = (): KeyPresses => ({ escapeAt: 0, ctrlCAt: 0 });

export type KeyTargets = {
  store: AppStore;
  presses: KeyPresses;
  scrollback: ScrollbackView;
  diffViewer: DiffViewerPanel;
  editor: InputEditor;
  acceptCompletion: () => void;
  pasteClipboard: () => void;
  submitInput: (delivery: PromptDelivery) => void;
  exit: () => void;
};

type KeyRoute = (key: KeyEvent, targets: KeyTargets) => boolean;

const DELIVERY_KEYS: Record<string, PromptDelivery> = { q: "queue", w: "steer" };

const DOUBLE_ESCAPE_MS = 500;

const EXIT_CONFIRM_MS = 3000;
const EXIT_NOTICE = "Press Ctrl + C again to exit";

const APPROVAL_KEYS = { a: "approve_all", y: "approve", n: "reject", return: "approve" } as const;

const routeExit: KeyRoute = (key, { store, presses, exit }) => {
  if (!key.ctrl || key.name !== "c") return false;
  const pressedAt = Date.now();
  if (pressedAt - presses.ctrlCAt <= EXIT_CONFIRM_MS) {
    presses.ctrlCAt = 0;
    exit();
    return true;
  }
  presses.ctrlCAt = pressedAt;
  showToast(store, EXIT_NOTICE);
  return true;
};

const routeDoubleEscape: KeyRoute = (key, { store, presses }) => {
  if (key.name !== "escape" || !isAgentBusy(store)) return false;
  const pressedAt = Date.now();
  const isDouble = pressedAt - presses.escapeAt <= DOUBLE_ESCAPE_MS;
  presses.escapeAt = isDouble ? 0 : pressedAt;
  if (isDouble) cancelTurn(store);
  return true;
};

const routeApproval: KeyRoute = (key, { store }) => {
  if (store.state.status !== "approval_required") return false;
  const decision = APPROVAL_KEYS[key.name as keyof typeof APPROVAL_KEYS];
  if (decision) answerApproval(store, decision);
  return true;
};

const QUESTION_ACTIONS: Record<string, (store: AppStore) => void> = {
  up: (store) => store.emit({ type: "ui.question.moved", delta: -1 }),
  down: (store) => store.emit({ type: "ui.question.moved", delta: 1 }),
  space: (store) => store.emit({ type: "ui.question.toggled" }),
  return: confirmQuestion,
  escape: dismissQuestion,
};

const DELETE_CHARACTER = "\x7f";

const readTypedText = (key: KeyEvent): string | undefined => {
  if (key.ctrl || key.meta) return undefined;
  return key.sequence.length === 1 && key.sequence >= " " && key.sequence !== DELETE_CHARACTER
    ? key.sequence
    : undefined;
};

function typeCustomAnswer(key: KeyEvent, store: AppStore): boolean {
  const { question } = store.state.ui;
  if (!question || !isCustomRow(question)) return false;
  const typed = readTypedText(key);
  if (key.name !== "backspace" && typed === undefined) return false;
  const text = typed === undefined ? question.custom.slice(0, -1) : question.custom + typed;
  store.emit({ type: "ui.question.custom.changed", text });
  return true;
}

const routeQuestion: KeyRoute = (key, { store }) => {
  if (store.state.status !== "answer_required") return false;
  if (!typeCustomAnswer(key, store)) QUESTION_ACTIONS[key.name]?.(store);
  return true;
};

const routeCompletion: KeyRoute = (key, { store, acceptCompletion }) =>
  routeAutocompleteKey(key, store, acceptCompletion);

const routeFocusCycle: KeyRoute = (key, { store }) => {
  if (key.name !== "tab") return false;
  store.emit({ type: "ui.focus.cycled", direction: 1 });
  return true;
};

const routePageScroll: KeyRoute = (key, { scrollback }) => {
  if (key.name !== "pageup" && key.name !== "pagedown") return false;
  scrollback.scrollByPage(key.name === "pageup" ? -1 : 1);
  return true;
};

const routeScrollback: KeyRoute = (key, { store, scrollback, editor }) => {
  if (store.state.ui.focus !== "scrollback" && editor.read() !== "") return false;
  if (key.name !== "up" && key.name !== "down") return false;
  scrollback.scrollByLines(key.name === "up" ? -1 : 1);
  return true;
};

const BACKGROUND_ACTIONS: Record<string, (store: AppStore, key: KeyEvent) => void> = {
  up: (store) => store.emit({ type: "ui.background.channel.moved", delta: -1 }),
  down: (store) => store.emit({ type: "ui.background.channel.moved", delta: 1 }),
  left: (store, key) => adjustBackground(store, -1, key.shift),
  right: (store, key) => adjustBackground(store, 1, key.shift),
  return: saveBackground,
  escape: closeBackgroundEditor,
};

const routeBackgroundEditor: KeyRoute = (key, { store }) => {
  if (!store.state.ui.backgroundEditor) return false;
  BACKGROUND_ACTIONS[key.name]?.(store, key);
  return true;
};

const DIFF_VIEWER_ACTIONS: Record<string, (targets: KeyTargets) => void> = {
  left: ({ store }) => store.emit({ type: "ui.diff.viewer.moved", delta: -1 }),
  right: ({ store }) => store.emit({ type: "ui.diff.viewer.moved", delta: 1 }),
  up: ({ diffViewer }) => diffViewer.scrollByLines(-1),
  down: ({ diffViewer }) => diffViewer.scrollByLines(1),
  pageup: ({ diffViewer }) => diffViewer.scrollByPage(-1),
  pagedown: ({ diffViewer }) => diffViewer.scrollByPage(1),
  escape: ({ store }) => store.emit({ type: "ui.diff.viewer.closed" }),
  q: ({ store }) => store.emit({ type: "ui.diff.viewer.closed" }),
};

const routeDiffViewer: KeyRoute = (key, targets) => {
  if (!targets.store.state.ui.diffViewer) return false;
  DIFF_VIEWER_ACTIONS[key.name]?.(targets);
  return true;
};

const routeHistory: KeyRoute = (key, { store, editor }) => routeHistoryKey(key, store, editor);

const routeHistorySearch: KeyRoute = (key, { store, editor }) =>
  routeHistorySearchKey(key, store, editor);

const routePicker: KeyRoute = (key, { store }) => {
  if (!store.state.ui.picker) return false;
  if (key.name === "up" || key.name === "down") {
    store.emit({ type: "ui.picker.moved", delta: key.name === "up" ? -1 : 1 });
  } else if (key.name === "return") {
    confirmPicker(store);
  } else if (key.name === "escape") {
    store.emit({ type: "ui.picker.closed" });
  }
  return true;
};

const routeModelPicker: KeyRoute = (key, { store }) => {
  if (key.name !== "tab" || !key.shift) return false;
  openModelPicker(store);
  return true;
};

const routeDelivery: KeyRoute = (key, { store, submitInput }) => {
  const delivery = key.ctrl ? DELIVERY_KEYS[key.name] : undefined;
  if (!delivery || store.state.ui.focus !== "input") return false;
  submitInput(delivery);
  return true;
};

const routePaste: KeyRoute = (key, { store, pasteClipboard }) => {
  if (key.name !== "v" || !(key.ctrl || key.super)) return false;
  if (store.state.ui.focus !== "input") return false;
  pasteClipboard();
  return true;
};

const ROUTES: KeyRoute[] = [
  routeExit,
  routeApproval,
  routeQuestion,
  routeDiffViewer,
  routeBackgroundEditor,
  routePicker,
  routeModelPicker,
  routeDelivery,
  routePaste,
  routeHistorySearch,
  routeCompletion,
  routeDoubleEscape,
  routeFocusCycle,
  routePageScroll,
  routeHistory,
  routeScrollback,
];

export const routeKey = (key: KeyEvent, targets: KeyTargets): boolean =>
  ROUTES.some((route) => route(key, targets));
