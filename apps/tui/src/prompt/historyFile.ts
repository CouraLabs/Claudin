import { homedir } from "node:os";
import { join } from "node:path";
import { MAX_PROMPT_HISTORY } from "@kraude-kode/events";

const HISTORY_ROOT = join(homedir(), ".kraude", "prompts");

export const buildHistoryPath = (cwd: string, root = HISTORY_ROOT): string =>
  join(root, cwd.replace(/[^a-zA-Z0-9]/g, "-"), "history.jsonl");

const parseLine = (line: string): string | undefined => {
  try {
    const { text } = JSON.parse(line) as { text?: unknown };
    return typeof text === "string" && text !== "" ? text : undefined;
  } catch {
    return undefined;
  }
};

export async function readHistoryFile(path: string): Promise<string[]> {
  const content = await Bun.file(path)
    .text()
    .catch(() => "");
  const entries = content.split("\n").flatMap((line) => parseLine(line) ?? []);
  return entries.slice(-MAX_PROMPT_HISTORY);
}

export async function writeHistoryFile(path: string, entries: string[]): Promise<void> {
  const lines = entries.slice(-MAX_PROMPT_HISTORY).map((text) => JSON.stringify({ text }));
  await Bun.write(path, lines.length > 0 ? `${lines.join("\n")}\n` : "");
}
