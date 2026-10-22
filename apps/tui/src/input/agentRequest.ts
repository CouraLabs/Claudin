import type { RequestEvent } from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";

type AgentRequest = Extract<RequestEvent, { agentSessionId: string }>;

type WithoutSession<E> = E extends unknown ? Omit<E, "agentSessionId"> : never;

export type AgentRequestInput = WithoutSession<AgentRequest>;

export const NOT_READY_NOTICE = "Agent session is not ready";

export function requestAgent(
  store: AppStore,
  request: AgentRequestInput,
  onMissing: "notify" | "ignore" = "notify",
): boolean {
  const { agentSessionId } = store.state;
  if (!agentSessionId) {
    if (onMissing === "notify") store.emit({ type: "ui.notice.posted", text: NOT_READY_NOTICE });
    return false;
  }
  store.request({ ...request, agentSessionId } as RequestEvent);
  return true;
}
