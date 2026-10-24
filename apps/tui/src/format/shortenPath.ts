import { homedir } from "node:os";

export function tildePath(path: string): string {
  const home = homedir();
  const insideHome = path === home || path.startsWith(`${home}/`);
  return insideHome ? `~${path.slice(home.length)}` : path;
}

export function shortenPath(path: string, maxLength = 32): string {
  const tilded = tildePath(path);
  return tilded.length > maxLength ? `…${tilded.slice(-(maxLength - 1))}` : tilded;
}

export function fileName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  return trimmed.split(/[\\/]/).pop() || path;
}
