import type { SessionState } from "../session/sessionState.ts";
import type {
  AgentStatus,
  ToolCall,
  ToolsEntry,
  TranscriptEntry,
} from "../session/transcriptTypes.ts";
import { appendEntry } from "./appendEntry.ts";

const OPEN_STATUSES = new Set(["running", "awaiting_approval", "awaiting_answer"]);

export const isToolsEntry = (entry: TranscriptEntry): entry is ToolsEntry => entry.kind === "tools";

export const listToolCalls = (state: SessionState): ToolCall[] =>
  state.transcript.filter(isToolsEntry).flatMap((entry) => entry.calls);

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

const readEditedPath = ({ input }: ToolCall): unknown => input.file_path ?? input.notebook_path;

export const listEditedFiles = (state: SessionState): string[] => [
  ...new Set(
    listToolCalls(state)
      .filter((call) => EDIT_TOOLS.has(call.name) && call.status === "completed")
      .map(readEditedPath)
      .filter((path): path is string => typeof path === "string"),
  ),
];

export function countTurnTools(state: SessionState): number {
  const lastUser = state.transcript.findLastIndex((entry) => entry.kind === "user");
  return state.transcript
    .slice(lastUser + 1)
    .filter(isToolsEntry)
    .reduce((total, entry) => total + entry.calls.length, 0);
}

export const findAwaitingCalls = (state: SessionState): ToolCall[] =>
  listToolCalls(state).filter((call) => call.status === "awaiting_approval");

export const findQuestionCalls = (state: SessionState): ToolCall[] =>
  listToolCalls(state).filter((call) => call.status === "awaiting_answer");

export const findGroupId = (state: SessionState, callId: string): string | undefined =>
  state.transcript.filter(isToolsEntry).find((e) => e.calls.some((c) => c.id === callId))?.id;

export const pickToolStatus = (state: SessionState): AgentStatus => {
  const calls = listToolCalls(state);
  if (calls.some((call) => call.status === "awaiting_approval")) return "approval_required";
  if (calls.some((call) => call.status === "awaiting_answer")) return "answer_required";
  return calls.some((call) => call.status === "running") ? "executing" : "thinking";
};

const stampEnd = (call: ToolCall, now: number): ToolCall =>
  OPEN_STATUSES.has(call.status) || call.endedAt !== undefined ? call : { ...call, endedAt: now };

export function updateToolCall(
  state: SessionState,
  callId: string,
  patch: (call: ToolCall) => ToolCall,
): SessionState {
  const transcript = state.transcript.map((entry) => {
    if (!isToolsEntry(entry) || !entry.calls.some((call) => call.id === callId)) return entry;
    const calls = entry.calls.map((call) =>
      call.id === callId ? stampEnd(patch(call), state.now) : call,
    );
    return { ...entry, calls };
  });
  return { ...state, transcript };
}

export function upsertToolCall(
  state: SessionState,
  call: Pick<ToolCall, "id" | "name" | "input">,
): SessionState {
  if (findGroupId(state, call.id)) {
    return updateToolCall(state, call.id, (old) => ({
      ...old,
      name: call.name,
      input: call.input,
    }));
  }
  const fresh: ToolCall = { ...call, status: "running", expanded: false, startedAt: state.now };
  const last = state.transcript.at(-1);
  if (last && isToolsEntry(last)) {
    const grown = { ...last, calls: [...last.calls, fresh] };
    return { ...state, transcript: [...state.transcript.slice(0, -1), grown] };
  }
  return appendEntry(state, { kind: "tools", calls: [fresh] });
}

export function settleOpenCalls(state: SessionState, error: string): SessionState {
  const transcript = state.transcript.map((entry) => {
    if (!isToolsEntry(entry)) return entry;
    const calls = entry.calls.map((call) =>
      OPEN_STATUSES.has(call.status)
        ? stampEnd({ ...call, status: "failed", error }, state.now)
        : call,
    );
    return { ...entry, calls };
  });
  return { ...state, transcript };
}
