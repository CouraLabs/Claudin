import type { AgentStatus } from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";

export const isStatusBusy = (status: AgentStatus): boolean =>
  status !== "idle" && status !== "error";

export const isAgentBusy = (store: AppStore): boolean => isStatusBusy(store.state.status);

export function guardIdle(store: AppStore, action: string): boolean {
  if (!isAgentBusy(store)) return true;
  const text = `Agent is busy: cancel the current turn before ${action}`;
  store.emit({ type: "ui.notice.posted", text });
  return false;
}
