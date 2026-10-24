import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  isProcessAlive,
  readDaemonDiscovery,
  removeDaemonDiscovery,
  stopDaemonProcess,
  writeDaemonDiscovery,
} from "./discovery.ts";

const useDirectory = async () => mkdtemp(join(tmpdir(), "kraude-discovery-"));

const discovery = (pid = 4242) => ({ port: 7777, token: "tok", pid, auto: true });

test("discovery records round-trip and reject malformed files", async () => {
  const directory = await useDirectory();
  expect(await readDaemonDiscovery(7777, directory)).toBeUndefined();
  await writeDaemonDiscovery(discovery(), directory);
  expect(await readDaemonDiscovery(7777, directory)).toEqual(discovery());
  await Bun.write(join(directory, "daemon-8888.json"), "not json");
  expect(await readDaemonDiscovery(8888, directory)).toBeUndefined();
});

test("removal only deletes the record of the given daemon pid", async () => {
  const directory = await useDirectory();
  await writeDaemonDiscovery(discovery(111), directory);
  await removeDaemonDiscovery(7777, 222, directory);
  expect(await readDaemonDiscovery(7777, directory)).toEqual(discovery(111));
  await removeDaemonDiscovery(7777, 111, directory);
  expect(await readDaemonDiscovery(7777, directory)).toBeUndefined();
});

test("stopDaemonProcess terminates a spawned child", async () => {
  const child = Bun.spawn({
    cmd: [process.execPath, "-e", "setInterval(() => {}, 1000)"],
    stdout: "ignore",
    stderr: "ignore",
  });
  expect(isProcessAlive(child.pid)).toBe(true);
  await stopDaemonProcess(child.pid, 2_000);
  expect(isProcessAlive(child.pid)).toBe(false);
}, 10_000);
