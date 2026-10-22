import semver, { type ReleaseType } from "semver";

const BUMPS: ReleaseType[] = ["patch", "minor", "major"];

export const parseBump = (input = "patch"): ReleaseType => {
  const bump = BUMPS.find((candidate) => candidate === input);
  if (!bump) throw new Error(`Bump must be one of ${BUMPS.join(", ")}, got "${input}"`);
  return bump;
};

export const nextVersion = (current: string, bump: ReleaseType): string => {
  const next = semver.inc(current, bump);
  if (!next) throw new Error(`Cannot bump invalid version "${current}"`);
  return next;
};
