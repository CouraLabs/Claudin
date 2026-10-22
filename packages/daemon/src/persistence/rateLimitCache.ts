import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { RawRateLimits } from "@claudin/events";

export const RATE_LIMIT_CACHE_PATH = join(homedir(), ".claudin", "rate-limits.json");

const dropExpiredWindows = (limits: RawRateLimits, now: number): RawRateLimits => {
  const live = Object.entries(limits ?? {}).filter(([, window]) => {
    const resetsAt = Date.parse((window as { resets_at?: string } | null)?.resets_at ?? "");
    return resetsAt > now;
  });
  return Object.fromEntries(live) as RawRateLimits;
};

export async function readCachedRateLimits(now = Date.now()): Promise<RawRateLimits | undefined> {
  try {
    const stored = JSON.parse(await readFile(RATE_LIMIT_CACHE_PATH, "utf8")) as RawRateLimits;
    const live = dropExpiredWindows(stored, now);
    return hasWindows(live) ? live : undefined;
  } catch {
    return undefined;
  }
}

const hasWindows = (limits: RawRateLimits): boolean => Object.keys(limits ?? {}).length > 0;

export async function writeCachedRateLimits(limits: RawRateLimits): Promise<void> {
  if (!limits || !hasWindows(limits)) return;
  try {
    await mkdir(dirname(RATE_LIMIT_CACHE_PATH), { recursive: true });
    await writeFile(RATE_LIMIT_CACHE_PATH, JSON.stringify(limits));
  } catch {}
}
