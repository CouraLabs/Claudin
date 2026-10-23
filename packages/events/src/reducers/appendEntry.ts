import type { SessionState } from "../session/sessionState.ts";
import type { TranscriptEntry } from "../session/transcriptTypes.ts";

type NewEntry = TranscriptEntry extends infer E
  ? E extends unknown
    ? Omit<E, "id" | "at">
    : never
  : never;

export function appendEntry(state: SessionState, entry: NewEntry): SessionState {
  const id = `entry-${state.entryCounter}`;
  return {
    ...state,
    entryCounter: state.entryCounter + 1,
    transcript: [...state.transcript, { ...entry, id, at: state.now } as TranscriptEntry],
  };
}

export const appendNotice = (state: SessionState, text: string): SessionState =>
  appendEntry(state, { kind: "notice", text });

export const appendMarkdownNotice = (state: SessionState, text: string): SessionState =>
  appendEntry(state, { kind: "notice", text, markdown: true });
