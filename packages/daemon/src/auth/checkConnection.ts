import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export type Rejection = { status: number; reason: string };

const isSameSecret = (given: string, expected: string): boolean => {
  const givenBytes = Buffer.from(given);
  const expectedBytes = Buffer.from(expected);
  return givenBytes.length === expectedBytes.length && timingSafeEqual(givenBytes, expectedBytes);
};

export function readRunId(request: IncomingMessage): string | null {
  return new URL(request.url ?? "/", "ws://127.0.0.1").searchParams.get("runId");
}

export function checkConnection(
  request: IncomingMessage,
  token: string,
  liveRunIds: ReadonlySet<string>,
): Rejection | undefined {
  if (request.headers.origin) return { status: 403, reason: "Browser origins are not allowed" };
  const params = new URL(request.url ?? "/", "ws://127.0.0.1").searchParams;
  if (!isSameSecret(params.get("token") ?? "", token)) {
    return { status: 401, reason: "Invalid access token" };
  }
  const runId = params.get("runId");
  if (!runId) return { status: 400, reason: "Missing run id" };
  if (liveRunIds.has(runId)) return { status: 409, reason: "Run id already connected" };
  return undefined;
}
