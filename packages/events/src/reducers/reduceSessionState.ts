import type { ModelInfo, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { PickerKind } from "../requests/uiEvents.ts";
import type { AppEvent } from "../session/appEvent.ts";
import { createSessionState, type SessionState } from "../session/sessionState.ts";
import type { SessionSummary, StoredEvent } from "../session/sessionSummary.ts";
import { appendNotice } from "./appendEntry.ts";
import { carryDevice, startFreshSession } from "./carryOver.ts";
import { reduceAgentMessage } from "./reduceAgentMessage.ts";
import { reduceApprovalRequired, reduceApprovalResolved } from "./reduceApproval.ts";
import { updateFileMatches } from "./reduceAutocomplete.ts";
import { applyLoadedBackground, applySavedBackground } from "./reduceBackground.ts";
import { openDiffViewer } from "./reduceDiffViewer.ts";
import {
  describeLoginStarted,
  describeServers,
  reduceEffortChanged,
  reduceModeChanged,
  reduceModelChanged,
} from "./reduceNotices.ts";
import { reducePrompt } from "./reducePrompt.ts";
import { reduceQuestionRequired, reduceQuestionResolved } from "./reduceQuestion.ts";
import { reduceRateLimit } from "./reduceRateLimit.ts";
import { stopStreaming } from "./reduceResult.ts";
import { reduceUi } from "./reduceUi.ts";
import { settleOpenCalls } from "./toolGroups.ts";

const replayEvents = (sessionId: string, stored: StoredEvent[]): SessionState =>
  stored.reduce<SessionState>(
    (current, { event, timestamp }) => reduceTimedEvent(current, event, timestamp),
    createSessionState(sessionId),
  );

const adoptReplay = (state: SessionState, replayed: SessionState, sessionId: string) => ({
  ...replayed,
  ...carryDevice(state),
  sessionId,
  now: state.now,
  ui: createSessionState(sessionId).ui,
});

function restoreSession(
  state: SessionState,
  sessionId: string,
  stored: StoredEvent[],
  notice: string,
): SessionState {
  const replayed = replayEvents(sessionId, stored);
  const settled = settleOpenCalls(stopStreaming(replayed), "Interrupted");
  return appendNotice(
    { ...adoptReplay(state, settled, sessionId), status: "idle", queuedTurns: 0 },
    notice,
  );
}

const syncSession = (state: SessionState, sessionId: string, stored: StoredEvent[]) =>
  appendNotice(
    adoptReplay(state, replayEvents(sessionId, stored), sessionId),
    "Attached to the live session",
  );

function openModelPicker(state: SessionState, allModels: ModelInfo[]): SessionState {
  const models = allModels.filter((model) => model.value !== "default");
  const current = models.findIndex((model) => model.value === state.model);
  const picker = { kind: "model", selected: Math.max(current, 0) } as const;
  return { ...state, models, ui: { ...state.ui, picker } };
}

function openSessionPicker(
  state: SessionState,
  sessions: SessionSummary[],
  kind: Extract<PickerKind, "session" | "search">,
  emptyNotice: string,
): SessionState {
  if (sessions.length === 0) return appendNotice(state, emptyNotice);
  const picker = { kind, selected: 0 };
  return { ...state, sessionList: sessions, ui: { ...state.ui, picker } };
}

const describeRewind = (filesChanged: string[], insertions: number, deletions: number) =>
  filesChanged.length === 0
    ? "Rewind found no file changes to undo"
    : `Rewound ${filesChanged.length} file(s) (+${insertions} -${deletions}): ${filesChanged.join(", ")}`;

export const reduceTimedEvent = (state: SessionState, event: AppEvent, at: number): SessionState =>
  reduceSessionState({ ...state, now: at }, event);

export function reduceSessionState(state: SessionState, event: AppEvent): SessionState {
  switch (event.type) {
    case "agent.prompt.requested":
      return reducePrompt(state, event.content, false);
    case "agent.prompt.queue.requested":
    case "agent.prompt.steer.requested":
      return reducePrompt(state, event.content, state.status !== "idle");
    case "agent.message.received":
      return reduceAgentMessage(state, event.message as SDKMessage);
    case "session.created":
      return startFreshSession(state, event.sessionId);
    case "session.restored":
      return restoreSession(state, event.sessionId, event.events, "Session restored");
    case "session.forked":
      return restoreSession(state, event.sessionId, event.events, "Session forked");
    case "session.synced":
      return syncSession(state, event.sessionId, event.events);
    case "session.exported":
      return appendNotice(state, `Transcript exported to ${event.path}`);
    case "session.search.received":
      return openSessionPicker(
        state,
        event.sessions,
        "search",
        `No sessions match "${event.query}"`,
      );
    case "workspace.diff.received":
      return openDiffViewer(state, event.files);
    case "agent.files.rewound":
      return appendNotice(
        state,
        describeRewind(event.filesChanged, event.insertions, event.deletions),
      );
    case "agent.session.created":
      return { ...state, agentSessionId: event.agentSessionId };
    case "request.failed":
      return {
        ...appendNotice(state, `Request failed: ${event.reason}`),
        status: "error",
        turnStartedAt: undefined,
      };
    case "agent.prompt.cancelled":
      return {
        ...appendNotice(settleOpenCalls(state, "Cancelled"), "Turn cancelled"),
        status: "idle",
        turnStartedAt: undefined,
        ui: { ...state.ui, focus: "input", question: null },
      };
    case "agent.tool.approval.required":
      return reduceApprovalRequired(state, event);
    case "agent.tool.approval.resolved":
      return reduceApprovalResolved(state, event);
    case "agent.question.required":
      return reduceQuestionRequired(state, event);
    case "agent.question.resolved":
      return reduceQuestionResolved(state, event);
    case "agent.model.changed":
      return reduceModelChanged(state, event.model);
    case "agent.effort.changed":
      return reduceEffortChanged(state, event.effort);
    case "agent.session.create.requested":
      return {
        ...state,
        effort: typeof event.options?.effort === "string" ? event.options.effort : state.effort,
        model: event.options?.model ?? state.model,
      };
    case "agent.models.received":
      return openModelPicker(state, event.models);
    case "session.list.received":
      return openSessionPicker(state, event.sessions, "session", "No stored sessions yet");
    case "workspace.cwd.changed":
      return appendNotice(
        {
          ...state,
          cwd: event.cwd,
          gitBranch: event.gitBranch,
          gitStats: event.gitStats,
        },
        `Working directory: ${event.cwd}`,
      );
    case "agent.commands.received":
      return { ...state, slashCommands: event.commands };
    case "agent.rate_limit.received":
      return reduceRateLimit(state, event.rateLimit);
    case "agent.permission_mode.changed":
      return reduceModeChanged(state, event.mode);
    case "agent.mcp.status.received":
      return appendNotice(state, describeServers(event.servers));
    case "agent.mcp.login.started":
      return appendNotice(state, describeLoginStarted(event.serverName, event.authUrl));
    case "workspace.info.received":
      return { ...state, cwd: event.cwd, gitBranch: event.gitBranch, gitStats: event.gitStats };
    case "options.loaded":
      return applyLoadedBackground(state, event.background);
    case "options.background.saved":
      return applySavedBackground(state, event.color);
    case "workspace.files.received":
      return updateFileMatches(state, event.query, event.matches);
    default:
      return event.type.startsWith("ui.")
        ? reduceUi(state, event as Parameters<typeof reduceUi>[1])
        : state;
  }
}
