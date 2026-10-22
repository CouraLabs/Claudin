import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { buildHistoryPath, readHistoryFile, writeHistoryFile } from "./historyFile.ts";
import { HistorySaver } from "./historySaver.ts";

const makePath = async () => join(await mkdtemp(join(tmpdir(), "claudin-hf-")), "history.jsonl");

test("the history path is derived from the working directory", () => {
  expect(buildHistoryPath("/Users/me/app", "/root")).toBe("/root/-Users-me-app/history.jsonl");
});

test("writing keeps only the ten newest prompts and reading skips bad lines", async () => {
  const path = await makePath();
  await writeHistoryFile(
    path,
    Array.from({ length: 12 }, (_, at) => `p${at}`),
  );
  await Bun.write(path, `${await Bun.file(path).text()}not json\n`);
  const entries = await readHistoryFile(path);
  expect(entries).toEqual(Array.from({ length: 10 }, (_, at) => `p${at + 2}`));
});

test("a missing file reads as empty history", async () => {
  expect(await readHistoryFile(await makePath())).toEqual([]);
});

test("the saver debounces and appends the draft last", async () => {
  const path = await makePath();
  const saver = new HistorySaver(path, 20);
  saver.schedule(["a"], "d");
  saver.schedule(["a"], "dr");
  await new Promise((resolve) => setTimeout(resolve, 80));
  expect(await readHistoryFile(path)).toEqual(["a", "dr"]);
});
