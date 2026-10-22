import { GAUGE_GLYPHS } from "./glyphs.ts";

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
  return String(count);
}

export const formatCost = (usd: number): string => `$${usd.toFixed(usd < 1 ? 3 : 2)}`;

export const formatDuration = (milliseconds: number): string =>
  `${(Math.max(milliseconds, 0) / 1000).toFixed(1)}s`;

export const formatClock = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const GAUGE_CELLS = 5;
const GAUGE_LEVELS = GAUGE_GLYPHS.length - 1;

export function buildGauge(ratio: number, cells = GAUGE_CELLS): string {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const steps = Math.round(clamped * cells * GAUGE_LEVELS);
  return Array.from({ length: cells }, (_, cell) => {
    const level = Math.min(Math.max(steps - cell * GAUGE_LEVELS, 0), GAUGE_LEVELS);
    return GAUGE_GLYPHS[level];
  }).join("");
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatTimeUntil(target: number, now: number): string {
  const remaining = Math.max(target - now, 0);
  if (remaining >= DAY_MS) {
    return `${Math.floor(remaining / DAY_MS)}d${Math.floor((remaining % DAY_MS) / HOUR_MS)}h`;
  }
  if (remaining >= HOUR_MS) {
    return `${Math.floor(remaining / HOUR_MS)}h${Math.floor((remaining % HOUR_MS) / MINUTE_MS)}m`;
  }
  if (remaining < MINUTE_MS) return "just now";
  return `${Math.floor(remaining / MINUTE_MS)}m`;
}

export function formatTimeAgo(timestamp: number, now: number): string {
  const elapsed = Math.max(now - timestamp, 0);
  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h ago`;
  return `${Math.floor(elapsed / DAY_MS)}d ago`;
}
