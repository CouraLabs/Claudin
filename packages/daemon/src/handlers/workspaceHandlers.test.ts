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

test("diff request returns patches for edited files, including untracked ones", async () => {
  const context = await createWorkspace();
  const { cwd } = context;
  await Bun.$`git init -q && echo node_modules > .git/info/exclude && git add src && git -c user.email=t@t -c user.name=t commit -qm init`.cwd(
    cwd,
  );
  await writeFile(join(cwd, "src", "app.ts"), "export const app = 1;\n");
  await writeFile(join(cwd, "notes.md"), "hello\n");
  const paths = [join(cwd, "src", "app.ts"), join(cwd, "notes.md"), join(cwd, "src", "server.ts")];
  const [response] = await collect(context, { type: "workspace.diff.requested", paths });
  expect(response).toMatchObject({
    type: "workspace.diff.received",
    files: [
      { path: "src/app.ts", additions: 1, deletions: 0 },
      { path: "notes.md", additions: 1, deletions: 0 },
    ],
  });
});

test("diff request prefers git changes and falls back to the requested paths", async () => {
  const context = await createWorkspace();
  const { cwd } = context;
  await Bun.$`git init -q && echo node_modules > .git/info/exclude && git add src && git -c user.email=t@t -c user.name=t commit -qm init`.cwd(
    cwd,
  );
  const requested = [join(cwd, "src", "server.ts")];
  const [clean] = await collect(context, { type: "workspace.diff.requested", paths: requested });
  expect(clean).toMatchObject({ type: "workspace.diff.received", files: [] });
  await writeFile(join(cwd, "src", "app.ts"), "export const app = 1;\n");
  const [dirty] = await collect(context, { type: "workspace.diff.requested", paths: requested });
  expect(dirty).toMatchObject({
    type: "workspace.diff.received",
    files: [{ path: "src/app.ts", additions: 1, deletions: 0 }],
  });
});

test("diff request outside git shows the requested session paths", async () => {
  const context = await createWorkspace();
  const paths = [join(context.cwd, "src", "app.ts")];
  const [response] = await collect(context, { type: "workspace.diff.requested", paths });
  expect(response).toMatchObject({
    type: "workspace.diff.received",
    files: [{ path: "src/app.ts" }],
  });
});
