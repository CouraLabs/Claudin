import { DEFAULT_EFFORT, type PermissionMode } from "@kraude-kode/events";
import type { AppStore } from "../store/appStore.ts";
import { requestAgent } from "./agentRequest.ts";

export const DEFAULT_MODEL = "claude-haiku-5-5";

const buildSessionOptions = (store: AppStore) => ({
  model: store.state.model || DEFAULT_MODEL,
  effort: (store.state.effort || DEFAULT_EFFORT) as typeof DEFAULT_EFFORT,
  permissionMode: store.state.permissionMode as PermissionMode,
});

export const startAgentSession = (store: AppStore): void =>
  store.request({
    type: "agent.session.create.requested",
    options: buildSessionOptions(store),
  });

export function resumeAgentSession(store: AppStore): void {
  const options = buildSessionOptions(store);
  const resumed = requestAgent(
    store,
    { type: "agent.session.resume.requested", options },
    "ignore",
  );
  if (!resumed) startAgentSession(store);
}

export function forkAgentSession(store: AppStore): void {
  const options = buildSessionOptions(store);
  const forked = requestAgent(store, { type: "agent.session.fork.requested", options }, "ignore");
  if (!forked) startAgentSession(store);
}

export function requestWorkspaceInfo(store: AppStore): void {
  store.request({ type: "workspace.info.requested" });
}

export function requestSessionInfo(store: AppStore): void {
  if (requestAgent(store, { type: "agent.commands.requested" }, "ignore")) requestRateLimit(store);
}

export function requestRateLimit(store: AppStore): void {
  requestAgent(store, { type: "agent.rate_limit.requested" }, "ignore");
}

export function attachSession(store: AppStore): void {
  store.request({ type: "agent.rate_limit.cached.requested" });
  store.request({ type: "options.load.requested" });
  store.request({ type: "session.sync.requested" });
}

export function bootSession(store: AppStore, resumeSessionId?: string): void {
  requestWorkspaceInfo(store);
  store.request({ type: "agent.rate_limit.cached.requested" });
  store.request({ type: "options.load.requested" });
  if (resumeSessionId) {
    store.request({ type: "session.restore.requested", sessionId: resumeSessionId });
  } else {
    startAgentSession(store);
  }
}
