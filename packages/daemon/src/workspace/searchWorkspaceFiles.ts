import fuzzysort from "fuzzysort";

const MAX_SCANNED_FILES = 20_000;
const IGNORED_PATH = /(^|\/)(node_modules|\.git|dist|\.turbo|coverage)\//;

async function scanDirectory(cwd: string): Promise<string[]> {
  const files: string[] = [];
  for await (const file of new Bun.Glob("**/*").scan({ cwd, onlyFiles: true })) {
    if (IGNORED_PATH.test(file)) continue;
    files.push(file);
    if (files.length >= MAX_SCANNED_FILES) break;
  }
  return files;
}

export async function listWorkspaceFiles(cwd: string): Promise<string[]> {
  const listed = await Bun.$`git ls-files --cached --others --exclude-standard`
    .cwd(cwd)
    .quiet()
    .nothrow();
  if (listed.exitCode !== 0) return scanDirectory(cwd);
  return listed.text().split("\n").filter(Boolean);
}

export function rankFiles(files: string[], query: string, limit: number): string[] {
  if (!query) return files.slice(0, limit);
  return fuzzysort.go(query, files, { limit }).map((result) => result.target);
}

export const MATCH_LIMIT = 8;

export async function searchWorkspaceFiles(cwd: string, query: string): Promise<string[]> {
  return rankFiles(await listWorkspaceFiles(cwd), query, MATCH_LIMIT);
}
