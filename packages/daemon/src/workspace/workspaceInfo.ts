import type { GitStats } from "@claudin/events";

export type GitInfo = { gitBranch: string; gitStats: GitStats };

const NO_CHANGES: GitStats = { additions: 0, deletions: 0 };

const readBranch = async (cwd: string): Promise<string> => {
  const result = await Bun.$`git rev-parse --abbrev-ref HEAD`.cwd(cwd).quiet().nothrow();
  return result.exitCode === 0 ? result.text().trim() : "";
};

const readStats = async (cwd: string): Promise<GitStats> => {
  const result = await Bun.$`git diff --numstat HEAD`.cwd(cwd).quiet().nothrow();
  if (result.exitCode !== 0) return NO_CHANGES;
  return result
    .text()
    .split("\n")
    .reduce<GitStats>(
      (total, line) => {
        const parts = line.split("\t");
        if (parts.length < 3) return total;
        const additions = Number(parts[0]);
        const deletions = Number(parts[1]);
        return {
          additions: total.additions + (Number.isNaN(additions) ? 0 : additions),
          deletions: total.deletions + (Number.isNaN(deletions) ? 0 : deletions),
        };
      },
      { ...NO_CHANGES },
    );
};

export async function readGitInfo(cwd: string): Promise<GitInfo> {
  const [gitBranch, gitStats] = await Promise.all([readBranch(cwd), readStats(cwd)]);
  return { gitBranch, gitStats };
}
