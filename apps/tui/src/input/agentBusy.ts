import type { AgentStatus } from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";

export const isStatusBusy = (status: AgentStatus): boolean =>
  status !== "idle" && status !== "error";

export const isAgentBusy = (store: AppStore): boolean => isStatusBusy(store.state.status);
