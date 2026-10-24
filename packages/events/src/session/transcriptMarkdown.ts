import type { SessionState } from "./sessionState.ts";
import type { ToolCall, TranscriptEntry } from "./transcriptTypes.ts";

const SUBJECT_KEYS = ["file_path", "path", "pattern", "command", "url", "query", "description"];

const readSubject = ({ input }: ToolCall): string => {
  const key = SUBJECT_KEYS.find((name) => typeof input[name] === "string");
  return key ? ` \`${String(input[key]).replace(/\s+/g, " ")}\`` : "";
};

const renderCall = (call: ToolCall): string => {
  const failure = call.error ? ` (failed: ${call.error.split("\n")[0]})` : "";
  return `- **${call.name}**${readSubject(call)}${failure}`;
};

const renderEntry = (entry: TranscriptEntry): string | undefined => {
  if (entry.kind === "user") return `## You\n\n${entry.text}`;
  if (entry.kind === "assistant") return `## Claude\n\n${entry.text}`;
  if (entry.kind === "notice") return `> ${entry.text}`;
  if (entry.kind === "tools") return entry.calls.map(renderCall).join("\n");
  return undefined;
};

export function renderTranscriptMarkdown(state: SessionState): string {
  const header = [
    "# KraudeKode session",
    "",
    `- Session: ${state.sessionId}`,
    `- Directory: ${state.cwd}`,
    `- Model: ${state.model}`,
    `- Cost: $${state.costUsd.toFixed(3)}`,
  ].join("\n");
  const body = state.transcript.map(renderEntry).filter(Boolean);
  return `${[header, ...body].join("\n\n")}\n`;
}
