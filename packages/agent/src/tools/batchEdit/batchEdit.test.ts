import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { applyTextEdit } from "./applyTextEdit.ts";
import { runBatchEdit } from "./runBatchEdit.ts";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "batch-edit-"));
});

afterEach(() => rm(dir, { recursive: true, force: true }));

const edit = (
  file_path: string,
  old_string: string,
  new_string: string,
  replace_all?: boolean,
) => ({
  file_path,
  old_string,
  new_string,
  replace_all,
});

test("replaces a unique match and rejects ambiguous or missing ones", () => {
  expect(applyTextEdit("a b c", edit("/x", "b", "B"))).toMatchObject({
    ok: true,
    content: "a B c",
  });
  expect(applyTextEdit("b b", edit("/x", "b", "B"))).toMatchObject({ ok: false });
  expect(applyTextEdit("b b", edit("/x", "b", "B", true))).toMatchObject({
    ok: true,
    content: "B B",
    replacements: 2,
  });
  expect(applyTextEdit("a", edit("/x", "z", "y"))).toMatchObject({ ok: false });
  expect(applyTextEdit("a", edit("/x", "a", "a"))).toMatchObject({ ok: false });
});

test("keeps dollar signs in the replacement literal", () => {
  expect(applyTextEdit("a", edit("/x", "a", "$&$1"))).toMatchObject({ content: "$&$1" });
});

test("edits several files and chained edits in one call", async () => {
  const first = join(dir, "a.txt");
  const second = join(dir, "b.txt");
  await writeFile(first, "one two");
  await writeFile(second, "three");
  const report = await runBatchEdit([
    edit(first, "one", "1"),
    edit(first, "1 two", "1 2"),
    edit(second, "three", "3"),
  ]);
  expect(report.isError).toBe(false);
  expect(await readFile(first, "utf8")).toBe("1 2");
  expect(await readFile(second, "utf8")).toBe("3");
});

test("writes nothing when any edit fails", async () => {
  const first = join(dir, "a.txt");
  await writeFile(first, "one");
  const report = await runBatchEdit([edit(first, "one", "1"), edit(first, "missing", "x")]);
  expect(report.isError).toBe(true);
  expect(report.text).toContain("Edit 2");
  expect(await readFile(first, "utf8")).toBe("one");
});

test("creates a new file from an empty old_string", async () => {
  const created = join(dir, "nested", "new.txt");
  const report = await runBatchEdit([edit(created, "", "hello")]);
  expect(report.isError).toBe(false);
  expect(await readFile(created, "utf8")).toBe("hello");
});

test("rejects relative paths and missing files", async () => {
  expect((await runBatchEdit([edit("a.txt", "x", "y")])).text).toContain("must be absolute");
  expect((await runBatchEdit([edit(join(dir, "none"), "x", "y")])).text).toContain(
    "does not exist",
  );
});
