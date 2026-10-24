import { DaemonClient } from "@kraude-kode/daemon";
import type { ResponseEvent } from "@kraude-kode/events";
import {
  readDaemonDiscovery,
  removeDaemonDiscovery,
  sleep,
  stopDaemonProcess,
} from "./discovery.ts";

const STATUS_TIMEOUT_MS = 5_000;
const READY_TIMEOUT_MS = 15_000;
const SPAWN_CONNECT_ATTEMPTS = 25;
const RETRY_DELAY_MS = 200;

export type DaemonStatus = Extract<ResponseEvent, { type: "daemon.status.received" }>;

export type DaemonConnection = {
  entryPath: string;
  port: number;
  runId: string;
  cwd: string;
};

export const requestDaemonStatus = (client: DaemonClient): Promise<DaemonStatus | undefined> => {
  let unsubscribe = () => {};
  const status = new Promise<DaemonStatus>((resolve) => {
    unsubscribe = client.subscribe((event) => {
      if (event.type !== "daemon.status.received") return;
      resolve(event);
    });
    client.send({ type: "daemon.status.requested" });
  });
  return Promise.race([status, sleep(STATUS_TIMEOUT_MS).then(() => undefined)]).finally(() =>
    unsubscribe(),
  );
};

const isSoleClient = (status: DaemonStatus): boolean => status.clients.length === 1;

const tryConnect = (
  port: number,
  token: string,
  runId: string,
  cwd: string,
): Promise<DaemonClient | undefined> =>
  DaemonClient.connect(`ws://127.0.0.1:${port}`, { token, runId, mode: "own", cwd }).catch(
    () => undefined,
  );

const spawnDaemonProcess = (entryPath: string, port: number) => {
  const child = Bun.spawn({
    cmd: [process.execPath, entryPath, "daemon", "--port", String(port), "--auto"],
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
    detached: true,
  });
  child.unref();
  const failure: { reason?: string } = {};
  void child.exited.then((code) => {
    failure.reason ??= `Daemon exited with code ${code} before becoming ready`;
  });
  return { pid: child.pid, failure };
};

const waitForDaemonDiscovery = async (
  port: number,
  pid: number,
  failure: { reason?: string },
): Promise<Awaited<ReturnType<typeof readDaemonDiscovery>>> => {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const discovery = await readDaemonDiscovery(port);
    if (discovery?.pid === pid) return discovery;
    if (failure.reason) throw new Error(failure.reason);
    await sleep(RETRY_DELAY_MS);
  }
  return readDaemonDiscovery(port);
};

const spawnAndConnect = async ({
  entryPath,
  port,
  runId,
  cwd,
}: DaemonConnection): Promise<DaemonClient> => {
  const child = spawnDaemonProcess(entryPath, port);
  const discovery = await waitForDaemonDiscovery(port, child.pid, child.failure);
  if (!discovery) throw new Error(`Daemon failed to start on port ${port}`);
  for (let attempt = 0; attempt < SPAWN_CONNECT_ATTEMPTS; attempt++) {
    const client = await tryConnect(port, discovery.token, runId, cwd);
    if (client) return client;
    await sleep(RETRY_DELAY_MS);
  }
  throw new Error(`Daemon is not accepting connections on port ${port}`);
};

export async function openDaemonClient(connection: DaemonConnection): Promise<DaemonClient> {
  const discovery = await readDaemonDiscovery(connection.port);
  if (!discovery) return spawnAndConnect(connection);
  const client = await tryConnect(
    connection.port,
    discovery.token,
    connection.runId,
    connection.cwd,
  );
  if (!client) {
    await removeDaemonDiscovery(connection.port, discovery.pid);
    return spawnAndConnect(connection);
  }
  if (!discovery.auto) return client;
  const status = await requestDaemonStatus(client);
  if (!status || !isSoleClient(status)) return client;
  const fresh = await requestDaemonStatus(client);
  if (!fresh || !isSoleClient(fresh)) return client;
  client.close();
  await stopDaemonProcess(fresh.pid);
  await removeDaemonDiscovery(connection.port, fresh.pid);
  return spawnAndConnect(connection);
}
