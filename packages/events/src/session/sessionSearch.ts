import { joinBlocks, readPromptText } from "../models/messageText.ts";
import type { AppEvent } from "./appEvent.ts";
import { type SessionSummary, type StoredEvent, summarizeSession } from "./sessionSummary.ts";

const SNIPPET_RADIUS = 30;

type MessageLike = { type?: string; message?: { content?: unknown } };

function readSearchableText(event: AppEvent): string {
  if (event.type === "agent.prompt.requested") return readPromptText(event.content);
  if (event.type !== "agent.message.received") return "";
  const message = event.message as MessageLike | undefined;
  return message?.type === "assistant" ? joinBlocks(message.message?.content) : "";
}

function cutSnippet(text: string, at: number, length: number): string {
  const flat = text.replace(/\s+/g, " ");
  const start = Math.max(at - SNIPPET_RADIUS, 0);
  const end = Math.min(at + length + SNIPPET_RADIUS, flat.length);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

export function matchSession(
  id: string,
  stored: StoredEvent[],
  query: string,
): SessionSummary | undefined {
  const needle = query.toLowerCase();
  for (const { event } of stored) {
    const text = readSearchableText(event).replace(/\s+/g, " ");
    const at = text.toLowerCase().indexOf(needle);
    if (at >= 0)
      return { ...summarizeSession(id, stored), title: cutSnippet(text, at, needle.length) };
  }
  return undefined;
}
