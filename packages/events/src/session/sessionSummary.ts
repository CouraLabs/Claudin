import type { AppEvent } from "./appEvent.ts";
import { readPromptText } from "../models/messageText.ts";

export type SessionSummary = {
  id: string;
  title: string;
  cwd: string;
  updatedAt: number;
};

export type StoredEvent = { timestamp: number; event: AppEvent };

const TITLE_LENGTH = 80;

export function summarizeSession(id: string, stored: StoredEvent[]): SessionSummary {
  const firstPrompt = stored.find(({ event }) => event.type === "agent.prompt.requested")?.event;
  const cwd = stored.findLast(
    ({ event }) =>
      event.type === "workspace.info.received" || event.type === "workspace.cwd.changed",
  )?.event;
  return {
    id,
    title:
      firstPrompt?.type === "agent.prompt.requested"
        ? readPromptText(firstPrompt.content).replace(/\s+/g, " ").slice(0, TITLE_LENGTH)
        : "",
    cwd: cwd && "cwd" in cwd ? cwd.cwd : "",
    updatedAt: stored.at(-1)?.timestamp ?? 0,
  };
}
