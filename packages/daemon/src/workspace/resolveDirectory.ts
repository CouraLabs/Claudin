import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const isDirectory = async (path: string): Promise<boolean> =>
  (await stat(path).catch(() => undefined))?.isDirectory() ?? false;

const expandHome = (path: string): string =>
  path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;

export const resolveDirectory = (base: string, path: string): string =>
  resolve(base, expandHome(path.trim()));
