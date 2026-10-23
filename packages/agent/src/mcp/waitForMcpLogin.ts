import type { McpServerStatus } from "@anthropic-ai/claude-agent-sdk";

export type WaitForLoginOptions = { intervalMs: number; timeoutMs: number };

export const DEFAULT_LOGIN_WAIT: WaitForLoginOptions = { intervalMs: 2_000, timeoutMs: 180_000 };

export async function waitForMcpLogin(
  fetchStatus: () => Promise<McpServerStatus[]>,
  serverName: string,
  { intervalMs, timeoutMs }: WaitForLoginOptions = DEFAULT_LOGIN_WAIT,
): Promise<McpServerStatus[]> {
  const deadline = Date.now() + timeoutMs;
  let servers = await fetchStatus();
  while (Date.now() < deadline && isAwaitingLogin(servers, serverName)) {
    await Bun.sleep(intervalMs);
    servers = await fetchStatus();
  }
  return servers;
}

const isAwaitingLogin = (servers: McpServerStatus[], serverName: string): boolean =>
  servers.some((server) => server.name === serverName && server.status === "needs-auth");
