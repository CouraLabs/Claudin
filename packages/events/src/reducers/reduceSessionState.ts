import type { ModelInfo, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AppEvent } from "../session/appEvent.ts";
import { appendNotice } from "./appendEntry.ts";
import { carryDevice, startFreshSession } from "./carryOver.ts";
import { reduceAgentMessage } from "./reduceAgentMessage.ts";
import { reduceApprovalRequired, reduceApprovalResolved } from "./reduceApproval.ts";
import { updateFileMatches } from "./reduceAutocomplete.ts";
import { applyLoadedBackground, applySavedBackground } from "./reduceBackground.ts";
import {
  describeServers,
  reduceAgentModeChanged,
  reduceEffortChanged,
  reduceModeChanged,
  reduceModelChanged,
} from "./reduceNotices.ts";
import { reducePrompt } from "./reducePrompt.ts";
import { reduceQuestionRequired, reduceQuestionResolved } from "./reduceQuestion.ts";
import { reduceRateLimit } from "./reduceRateLimit.ts";
import { stopStreaming } from "./reduceResult.ts";
import { reduceUi } from "./reduceUi.ts";
import { createSessionState, type SessionState } from "../session/sessionState.ts";
import type { SessionSummary, StoredEvent } from "../session/sessionSummary.ts";
import { settleOpenCalls } from "./toolGroups.ts";

function restoreSession(
  state: SessionState,
  sessionId: string,
  stored: StoredEvent[],
): SessionState {
  const replayed = stored.reduce<SessionState>(
    (current, { event, timestamp }) => reduceTimedEvent(current, event, timestamp),
    createSessionState(sessionId),
  );
  const settled = settleOpenCalls(stopStreaming(replayed), "Interrupted");
  return appendNotice(
    {
      ...settled,
      ...carryDevice(state),
      sessionId,
      status: "idle",
      queuedTurns: 0,
      now: state.now,
      ui: createSessionState(sessionId).ui,
    },
    "Session restored",
  );
}

function openModelPicker(state: SessionState, models: ModelInfo[]): SessionState {
  const current = models.findIndex((model) => model.value === state.model);
  const picker = { kind: "model", selected: Math.max(current, 0) } as const;
  return { ...state, models, ui: { ...state.ui, picker } };
}

function openSessionPicker(state: SessionState, sessions: SessionSummary[]): SessionState {
  if (sessions.length === 0) return appendNotice(state, "No stored sessions yet");
  const picker = { kind: "session", selected: 0 } as const;
  return { ...state, sessionList: sessions, ui: { ...state.ui, picker } };
}

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
      return restoreSession(state, event.sessionId, event.events);
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
        agentMode: event.agentMode ?? state.agentMode,
      };
    case "agent.mode.changed":
      return reduceAgentModeChanged(state, event.mode);
    case "agent.models.received":
      return openModelPicker(state, event.models);
    case "session.list.received":
      return openSessionPicker(state, event.sessions);
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
