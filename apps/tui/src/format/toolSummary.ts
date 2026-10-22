import type { ToolCall } from "@claudin/events";
import { truncateText } from "./truncateText.ts";

const SUMMARY_LENGTH = 80;

const SUMMARY_KEYS = ["file_path", "path", "command", "pattern", "query", "url", "description"];

const SEARCH_TOOLS = new Set(["Glob", "Grep"]);

const summarizeSearch = ({ pattern, path }: Record<string, unknown>): string =>
  typeof path === "string" ? `${pattern} in ${path}` : String(pattern);

export function summarizeToolCall({ name, input, status, progress }: ToolCall): string {
  if (status === "running" && progress) return truncateText(progress, SUMMARY_LENGTH);
  if (SEARCH_TOOLS.has(name) && typeof input.pattern === "string") {
    return truncateText(summarizeSearch(input), SUMMARY_LENGTH);
  }
  const key = SUMMARY_KEYS.find((name) => typeof input[name] === "string");
  const value = key ? String(input[key]) : JSON.stringify(input);
  return truncateText(value, SUMMARY_LENGTH);
}

export const describeApproval = ({ name, input }: ToolCall): string => {
  if (name === "Bash") return `Run command \`${truncateText(String(input.command ?? ""), 60)}\`?`;
  const path = input.file_path ?? input.notebook_path;
  if (typeof path === "string") return `Modify \`${truncateText(path, 60)}\` with ${name}?`;
  return `Allow \`${name}\`?`;
};
