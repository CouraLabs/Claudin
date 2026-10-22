import { createSessionState, type SessionState } from "../session/sessionState.ts";

const DEVICE_KEYS = ["theme", "background", "slashCommands", "models", "rateLimits"] as const;

const WORKSPACE_KEYS = [
  "model",
  "effort",
  "permissionMode",
  "agentMode",
  "cwd",
  "gitBranch",
  "gitStats",
] as const;

const pickKeys = <K extends keyof SessionState>(
  state: SessionState,
  keys: readonly K[],
): Pick<SessionState, K> =>
  Object.fromEntries(keys.map((key) => [key, state[key]])) as Pick<SessionState, K>;

export const carryDevice = (state: SessionState) => pickKeys(state, DEVICE_KEYS);

export function startFreshSession(state: SessionState, sessionId: string): SessionState {
  const fresh = createSessionState(sessionId);
  return {
    ...fresh,
    ...carryDevice(state),
    ...pickKeys(state, WORKSPACE_KEYS),
    tokens: { ...fresh.tokens, maxContext: state.tokens.maxContext },
  };
}
