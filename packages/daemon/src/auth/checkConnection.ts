import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { readRequestParam } from "../server/requestParams.ts";

export type Rejection = { status: number; reason: string };

const isSameSecret = (given: string, expected: string): boolean => {
  const givenBytes = Buffer.from(given);
  const expectedBytes = Buffer.from(expected);
  return givenBytes.length === expectedBytes.length && timingSafeEqual(givenBytes, expectedBytes);
};

export function readRunId(request: IncomingMessage): string | null {
  return readRequestParam(request, "runId") ?? null;
}

export function checkConnection(
  request: IncomingMessage,
  token: string,
  liveRunIds: ReadonlySet<string>,
): Rejection | undefined {
  if (request.headers.origin) return { status: 403, reason: "Browser origins are not allowed" };
  if (!isSameSecret(readRequestParam(request, "token") ?? "", token)) {
    return { status: 401, reason: "Invalid access token" };
  }
  const runId = readRequestParam(request, "runId");
  if (!runId) return { status: 400, reason: "Missing run id" };
  if (liveRunIds.has(runId)) return { status: 409, reason: "Run id already connected" };
  return undefined;
}
