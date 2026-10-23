import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSessionStore, type RequestEvent } from "@claudin/events";
import { expect, test } from "vitest";
import { createDaemonContext } from "../server/daemonContext.ts";
import { handleRequest } from "../server/handleRequest.ts";

async function createContext() {
  const directory = await mkdtemp(join(tmpdir(), "claudin-"));
  const optionsPath = join(directory, "nested", "options.json");
  const store = new FileSessionStore(join(directory, "sessions"));
  return { optionsPath, context: await createDaemonContext(store, undefined, optionsPath) };
}

async function collect(
  context: Awaited<ReturnType<typeof createContext>>["context"],
  request: RequestEvent,
) {
  const responses = [];
  for await (const response of handleRequest(context, request)) responses.push(response);
  return responses;
}

const color = { r: 10, g: 20, b: 30, a: 40 };

test("loading without an options file yields no background", async () => {
  const { context } = await createContext();
  expect(await collect(context, { type: "options.load.requested" })).toEqual([
    { type: "options.loaded", background: undefined },
  ]);
});

test("saving writes the background to the options file and loading reads it back", async () => {
  const { context, optionsPath } = await createContext();
  const saved = await collect(context, { type: "options.background.save.requested", color });
  expect(saved).toEqual([{ type: "options.background.saved", color }]);
  expect(await Bun.file(optionsPath).json()).toEqual({ background: color });
  expect(await collect(context, { type: "options.load.requested" })).toEqual([
    { type: "options.loaded", background: color },
  ]);
});

test("saving keeps the other options in the file", async () => {
  const { context, optionsPath } = await createContext();
  await Bun.write(optionsPath, JSON.stringify({ other: true }));
  await collect(context, { type: "options.background.save.requested", color });
  expect(await Bun.file(optionsPath).json()).toEqual({ other: true, background: color });
});

test("saving a theme writes it to the options file and loading reads it back", async () => {
  const { context, optionsPath } = await createContext();
  await collect(context, { type: "options.background.save.requested", color });
  const saved = await collect(context, { type: "options.theme.save.requested", theme: "aura" });
  expect(saved).toEqual([{ type: "options.theme.saved", theme: "aura" }]);
  expect(await Bun.file(optionsPath).json()).toEqual({ background: color, theme: "aura" });
  expect(await collect(context, { type: "options.load.requested" })).toEqual([
    { type: "options.loaded", background: color, theme: "aura" },
  ]);
});
