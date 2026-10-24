import { randomBytes } from "node:crypto";
import type { ConnectionMode } from "../server/daemonHub.ts";

export type ConnectionCredentials = {
  token: string;
  runId: string;
  mode?: ConnectionMode;
  cwd?: string;
};

export const createRunId = (): string => crypto.randomUUID();

export const createAccessToken = (): string => randomBytes(32).toString("base64url");

export function appendCredentials(
  url: string,
  { token, runId, mode, cwd }: ConnectionCredentials,
): string {
  const target = new URL(url);
  target.searchParams.set("token", token);
  target.searchParams.set("runId", runId);
  if (mode) target.searchParams.set("mode", mode);
  if (cwd) target.searchParams.set("cwd", cwd);
  return target.toString();
}
