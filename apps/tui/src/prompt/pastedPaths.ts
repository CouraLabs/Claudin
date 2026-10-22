import { statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute } from "node:path";

const unwrapPath = (raw: string): string =>
  raw
    .trim()
    .replace(/^(['"])(.*)\1$/, "$2")
    .replace(/^file:\/\//, "")
    .replace(/^~(?=\/)/, homedir())
    .replace(/\\(.)/g, "$1");

const isExistingFile = (path: string): boolean => {
  try {
    return isAbsolute(path) && statSync(path).isFile();
  } catch {
    return false;
  }
};

export function parsePastedPaths(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const paths = lines
    .flatMap((line) => (isExistingFile(unwrapPath(line)) ? [line] : line.split(/(?<!\\)\s+/)))
    .map(unwrapPath);
  return paths.length > 0 && paths.every(isExistingFile) ? paths : [];
}
