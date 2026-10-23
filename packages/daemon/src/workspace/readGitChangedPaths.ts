const readLines = async (cwd: string, command: ReturnType<typeof Bun.$>): Promise<string[]> =>
  (await command.cwd(cwd).quiet().nothrow()).text().split("\n").filter(Boolean);

export async function readGitChangedPaths(cwd: string): Promise<string[]> {
  const [tracked, untracked] = await Promise.all([
    readLines(cwd, Bun.$`git diff --name-only --relative HEAD`),
    readLines(cwd, Bun.$`git ls-files --others --exclude-standard`),
  ]);
  return [...tracked, ...untracked];
}
