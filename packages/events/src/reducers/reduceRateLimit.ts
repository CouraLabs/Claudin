import type { SDKControlGetUsageResponse } from "@anthropic-ai/claude-agent-sdk";
import type { SessionState } from "../session/sessionState.ts";
import type { RateLimits, RateWindow } from "../session/transcriptTypes.ts";
import { appendNotice } from "./appendEntry.ts";
import { stopStreaming } from "./reduceResult.ts";

export type RawRateLimits = SDKControlGetUsageResponse["rate_limits"];
type RawWindow = NonNullable<NonNullable<RawRateLimits>["five_hour"]>;

function readWindow(raw: RawWindow | null | undefined): RateWindow | undefined {
  if (!raw || raw.utilization === null || !raw.resets_at) return undefined;
  const resetsAt = Date.parse(raw.resets_at);
  return Number.isNaN(resetsAt) ? undefined : { utilization: raw.utilization, resetsAt };
}

export const readRateLimits = (raw: RawRateLimits): RateLimits => ({
  fiveHour: readWindow(raw?.five_hour),
  sevenDay: readWindow(raw?.seven_day),
});

export const reduceRateLimit = (state: SessionState, raw: RawRateLimits): SessionState =>
  raw ? { ...state, rateLimits: readRateLimits(raw) } : state;

type EventWindow = { utilization?: number; resetsAt?: number };

type RateLimitEvent = {
  rate_limit_info?: EventWindow & {
    rateLimitType?: string;
    unifiedWindows?: Record<string, EventWindow | undefined>;
  };
};

const PERCENT = 100;
const MILLISECONDS = 1000;

function readEventWindow(window?: EventWindow): RateWindow | undefined {
  if (typeof window?.utilization !== "number" || typeof window.resetsAt !== "number") {
    return undefined;
  }
  return { utilization: window.utilization * PERCENT, resetsAt: window.resetsAt * MILLISECONDS };
}

export function reduceRateLimitEvent(state: SessionState, event: RateLimitEvent): SessionState {
  const info = event.rate_limit_info;
  const windows =
    info?.unifiedWindows ?? (info?.rateLimitType ? { [info.rateLimitType]: info } : {});
  return {
    ...state,
    rateLimits: {
      fiveHour: readEventWindow(windows.five_hour) ?? state.rateLimits.fiveHour,
      sevenDay: readEventWindow(windows.seven_day) ?? state.rateLimits.sevenDay,
    },
  };
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const readClockLabel = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatRemaining = (remaining: number): string => {
  if (remaining >= DAY_MS)
    return `${Math.floor(remaining / DAY_MS)}d ${Math.floor((remaining % DAY_MS) / HOUR_MS)}h`;
  if (remaining >= HOUR_MS)
    return `${Math.floor(remaining / HOUR_MS)}h ${Math.floor((remaining % HOUR_MS) / MINUTE_MS)}m`;
  return `${Math.max(1, Math.ceil(remaining / MINUTE_MS))}m`;
};

const describeWaitStart = (resetsAt: number, now: number): string =>
  `Usage limit reached. Execution paused; resuming at ${readClockLabel(resetsAt)} (in ${formatRemaining(resetsAt - now)}) automatically.`;

export function reduceWaitStart(state: SessionState, resetsAt: number): SessionState {
  if (resetsAt <= state.now) return state;
  return {
    ...appendNotice(stopStreaming(state), describeWaitStart(resetsAt, state.now)),
    status: "rate_limited",
    rateLimitWait: { resetsAt },
  };
}

export function reduceWaitEnd(state: SessionState, resumed: boolean): SessionState {
  const wait = state.rateLimitWait;
  return {
    ...appendNotice(
      stopStreaming(state),
      resumed ? "Usage limit reset. Resuming execution." : "Rate-limit resume stopped.",
    ),
    status: resumed ? "thinking" : wait ? "idle" : state.status,
    ...(wait && { rateLimitWait: undefined, ...(resumed && { turnStartedAt: state.now }) }),
  };
}
