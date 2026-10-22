import type { AppEvent } from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";
import {
  requestRateLimit,
  requestSessionInfo,
  requestWorkspaceInfo,
  resumeAgentSession,
  startAgentSession,
} from "./agentSessionActions.ts";

const isRateLimitEvent = (event: AppEvent): boolean =>
  event.type === "agent.message.received" &&
  (event.message as { type?: string } | undefined)?.type === "rate_limit_event";

const isTurnResult = (event: AppEvent): boolean =>
  event.type === "agent.message.received" &&
  (event.message as { type?: string } | undefined)?.type === "result";

export function reactToEvent(store: AppStore, event: AppEvent): void {
  if (event.type === "session.restored") {
    requestWorkspaceInfo(store);
    resumeAgentSession(store);
  }
  if (event.type === "session.created") startAgentSession(store);
  if (event.type === "agent.session.created") requestSessionInfo(store);
  if (isTurnResult(event)) requestWorkspaceInfo(store);
  if (isRateLimitEvent(event)) requestRateLimit(store);
}
