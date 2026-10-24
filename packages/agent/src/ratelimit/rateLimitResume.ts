import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const MILLISECONDS_PER_SECOND = 1000;

export const RATE_LIMIT_RESUME_BUFFER_MS = 30_000;

export const MAX_RATE_LIMIT_RESUMES = 8;

export type RejectedRateLimit = { resetsAt: number };

export type Sleep = (ms: number, signal: AbortSignal) => Promise<boolean>;

export const waitOutSleep: Sleep = (ms, signal) =>
  new Promise<boolean>((resolve) => {
    if (signal.aborted) return resolve(false);
    const timer = setTimeout(() => resolve(true), ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve(false);
      },
      { once: true },
    );
  });

type RejectionInfo = {
  status?: string;
  resetsAt?: number;
};

export const readRejectedRateLimit = (message: SDKMessage): RejectedRateLimit | undefined => {
  if (message.type !== "rate_limit_event") return undefined;
  const info = message.rate_limit_info as RejectionInfo;
  if (info?.status !== "rejected" || typeof info.resetsAt !== "number") return undefined;
  const resetsAt = info.resetsAt * MILLISECONDS_PER_SECOND;
  return Number.isFinite(resetsAt) ? { resetsAt } : undefined;
};

export const rateLimitWaitMs = (
  rejection: RejectedRateLimit,
  now: number,
  bufferMs: number,
): number => Math.max(0, rejection.resetsAt - now) + bufferMs;
