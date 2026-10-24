import { relative, resolve } from "node:path";
import { countPatchLines, type FileDiff } from "@kraude-kode/events";

const isTracked = async (cwd: string, path: string): Promise<boolean> =>
  (await Bun.$`git ls-files --error-unmatch -- ${path}`.cwd(cwd).quiet().nothrow()).exitCode === 0;

async function readPatch(cwd: string, path: string): Promise<string> {
  const command = (await isTracked(cwd, path))
    ? Bun.$`git diff --no-color HEAD -- ${path}`
    : Bun.$`git diff --no-color --no-index -- /dev/null ${path}`;
  return (await command.cwd(cwd).quiet().nothrow()).text();
}

async function readFileDiff(cwd: string, path: string): Promise<FileDiff> {
  const absolute = resolve(cwd, path);
  const patch = await readPatch(cwd, absolute);
  return {
    path: relative(cwd, absolute) || path,
    patch,
    additions: countPatchLines(patch, "+"),
    deletions: countPatchLines(patch, "-"),
  };
}

export async function readFileDiffs(cwd: string, paths: string[]): Promise<FileDiff[]> {
  const diffs = await Promise.all([...new Set(paths)].map((path) => readFileDiff(cwd, path)));
  return diffs.filter(({ patch }) => patch.trim() !== "");
}
