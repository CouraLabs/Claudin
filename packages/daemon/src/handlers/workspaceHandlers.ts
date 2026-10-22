import type { RequestHandlers } from "../server/requestHandler.ts";
import { searchWorkspaceFiles } from "../workspace/searchWorkspaceFiles.ts";
import { readGitInfo } from "../workspace/workspaceInfo.ts";

export const workspaceHandlers: Pick<
  RequestHandlers,
  "workspace.info.requested" | "workspace.files.requested" | "workspace.cwd.set.requested"
> = {
  async *"workspace.info.requested"({ cwd }) {
    yield { type: "workspace.info.received", cwd, ...(await readGitInfo(cwd)) };
  },
  async *"workspace.files.requested"({ cwd }, request) {
    const matches = await searchWorkspaceFiles(cwd, request.query);
    yield { type: "workspace.files.received", query: request.query, matches };
  },
  async *"workspace.cwd.set.requested"(context, request) {
    const { cwd, created } = await context.changeDirectory(request.path);
    yield created;
    yield { type: "workspace.cwd.changed", cwd, ...(await readGitInfo(cwd)) };
  },
};
