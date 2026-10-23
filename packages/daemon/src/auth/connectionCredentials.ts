import { randomBytes } from "node:crypto";

export type ConnectionCredentials = { token: string; runId: string };

export const createRunId = (): string => crypto.randomUUID();

export const createAccessToken = (): string => randomBytes(32).toString("base64url");

export function appendCredentials(url: string, { token, runId }: ConnectionCredentials): string {
  const target = new URL(url);
  target.searchParams.set("token", token);
  target.searchParams.set("runId", runId);
  return target.toString();
}
