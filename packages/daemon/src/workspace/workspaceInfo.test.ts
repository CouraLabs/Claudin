import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { readGitInfo } from "./workspaceInfo.ts";

test("reports the branch and the uncommitted added and deleted lines", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kraude-git-"));
  await Bun.$`git init -q -b main && git config user.email test@example.com && git config user.name test`
    .cwd(dir)
    .quiet();
  await writeFile(join(dir, "a.txt"), "one\ntwo\nthree\n");
  await Bun.$`git add . && git commit -q -m init`.cwd(dir).quiet();
  await writeFile(join(dir, "a.txt"), "one\nTWO\nthree\nfour\n");
  expect(await readGitInfo(dir)).toEqual({
    gitBranch: "main",
    gitStats: { additions: 2, deletions: 1 },
  });
});

test("reports an empty branch and no changes outside a repository", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kraude-plain-"));
  expect(await readGitInfo(dir)).toEqual({
    gitBranch: "",
    gitStats: { additions: 0, deletions: 0 },
  });
});
