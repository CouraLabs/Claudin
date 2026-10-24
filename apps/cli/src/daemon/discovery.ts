import { chmod, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_KRAUDE_DIRECTORY = join(homedir(), ".kraude");

export type DaemonDiscovery = {
  port: number;
  token: string;
  pid: number;
  auto: boolean;
};

const discoveryPath = (port: number, directory: string): string =>
  join(directory, `daemon-${port}.json`);

const isDiscovery = (value: unknown): value is DaemonDiscovery =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as DaemonDiscovery).port === "number" &&
  typeof (value as DaemonDiscovery).token === "string" &&
  typeof (value as DaemonDiscovery).pid === "number" &&
  typeof (value as DaemonDiscovery).auto === "boolean";

export async function readDaemonDiscovery(
  port: number,
  directory = DEFAULT_KRAUDE_DIRECTORY,
): Promise<DaemonDiscovery | undefined> {
  const stored: unknown = await Bun.file(discoveryPath(port, directory))
    .json()
    .catch(() => undefined);
  return isDiscovery(stored) ? stored : undefined;
}

export async function writeDaemonDiscovery(
  discovery: DaemonDiscovery,
  directory = DEFAULT_KRAUDE_DIRECTORY,
): Promise<void> {
  const path = discoveryPath(discovery.port, directory);
  await writeFile(path, `${JSON.stringify(discovery)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

export async function removeDaemonDiscovery(
  port: number,
  pid: number,
  directory = DEFAULT_KRAUDE_DIRECTORY,
): Promise<void> {
  const stored = await readDaemonDiscovery(port, directory);
  if (stored?.pid !== pid) return;
  await rm(discoveryPath(port, directory), { force: true });
}

export const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function stopDaemonProcess(pid: number, timeoutMs = 5_000): Promise<void> {
  if (!isProcessAlive(pid)) return;
  process.kill(pid, "SIGTERM");
  const deadline = Date.now() + timeoutMs;
  while (isProcessAlive(pid) && Date.now() < deadline) await sleep(100);
  if (isProcessAlive(pid)) process.kill(pid, "SIGKILL");
  while (isProcessAlive(pid) && Date.now() < deadline + 2_000) await sleep(100);
}
