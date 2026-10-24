import { readTokens, type UsageFields } from "../models/readTokens.ts";
import type { SessionState } from "../session/sessionState.ts";
import { appendEntry } from "./appendEntry.ts";

type StreamEvent = {
  type: string;
  message?: { id: string; usage?: UsageFields };
  content_block?: { type: string };
  delta?: { type: string; text?: string };
  usage?: UsageFields;
};

const findStreamingIndex = (state: SessionState): number =>
  state.transcript.findLastIndex(
    (entry) =>
      entry.kind === "assistant" && entry.streaming && entry.messageId === state.streamingMessageId,
  );

function appendDelta(state: SessionState, text: string): SessionState {
  const index = findStreamingIndex(state);
  if (index < 0) return startTextBlock(state, text);
  const transcript = state.transcript.map((entry, i) =>
    i === index && entry.kind === "assistant" ? { ...entry, text: entry.text + text } : entry,
  );
  return { ...state, transcript };
}

const startTextBlock = (state: SessionState, text = ""): SessionState =>
  appendEntry(state, {
    kind: "assistant",
    messageId: state.streamingMessageId ?? "",
    text,
    streaming: true,
  });

function startBlock(state: SessionState, blockType?: string): SessionState {
  if (blockType === "thinking") return { ...state, thinkingStartedAt: state.now };
  return blockType === "text" ? startTextBlock(state) : state;
}

function endThinking(state: SessionState): SessionState {
  if (state.thinkingStartedAt === undefined) return state;
  const durationMs = state.now - state.thinkingStartedAt;
  return appendEntry({ ...state, thinkingStartedAt: undefined }, { kind: "thought", durationMs });
}

export function reduceStreamEvent(state: SessionState, event: StreamEvent): SessionState {
  switch (event.type) {
    case "message_start":
      return {
        ...state,
        streamingMessageId: event.message?.id,
        tokens: readTokens(event.message?.usage ?? {}, state.tokens),
      };
    case "content_block_start":
      return startBlock(state, event.content_block?.type);
    case "content_block_stop":
      return endThinking(state);
    case "content_block_delta":
      return event.delta?.type === "text_delta"
        ? appendDelta(state, event.delta.text ?? "")
        : state;
    case "message_delta":
      return { ...state, tokens: readTokens(event.usage ?? {}, state.tokens) };
    case "message_stop":
      return { ...state, streamingMessageId: undefined };
    default:
      return state;
  }
}
