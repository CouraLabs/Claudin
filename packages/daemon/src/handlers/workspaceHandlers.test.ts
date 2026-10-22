import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSessionStore, type RequestEvent } from "@claudin/events";
import { expect, test } from "vitest";
import { createDaemonContext, type DaemonContext } from "../server/daemonContext.ts";
import { handleRequest } from "../server/handleRequest.ts";
import { rankFiles } from "../workspace/searchWorkspaceFiles.ts";

async function createWorkspace() {
  const cwd = await mkdtemp(join(tmpdir(), "claudin-ws-"));
  await mkdir(join(cwd, "src"));
  await mkdir(join(cwd, "node_modules"));
  await writeFile(join(cwd, "src", "app.ts"), "");
  await writeFile(join(cwd, "src", "server.ts"), "");
  await writeFile(join(cwd, "node_modules", "skip.ts"), "");
  const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "claudin-")));
  const context = await createDaemonContext(store);
  context.cwd = cwd;
  return context;
}

async function collect(context: DaemonContext, request: RequestEvent) {
  const responses = [];
  for await (const response of handleRequest(context, request)) responses.push(response);
  return responses;
}

test("ranks files by fuzzy query", () => {
  const files = ["src/app.ts", "src/server.ts", "README.md"];
  expect(rankFiles(files, "serv", 5)).toEqual(["src/server.ts"]);
  expect(rankFiles(files, "", 2)).toEqual(["src/app.ts", "src/server.ts"]);
});

test("workspace info reports the working directory", async () => {
  const context = await createWorkspace();
  const [response] = await collect(context, { type: "workspace.info.requested" });
  expect(response).toMatchObject({ type: "workspace.info.received", cwd: context.cwd });
});

test("workspace files skip ignored directories", async () => {
  const context = await createWorkspace();
  const [response] = await collect(context, { type: "workspace.files.requested", query: "ts" });
  expect(response).toMatchObject({ type: "workspace.files.received", query: "ts" });
  const matches = (response as { matches: string[] }).matches;
  expect(matches.sort()).toEqual(["src/app.ts", "src/server.ts"]);
});
