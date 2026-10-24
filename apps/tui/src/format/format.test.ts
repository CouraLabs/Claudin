import { BATCH_EDIT_TOOL_NAME, stripCustomPrefix, type ToolCall } from "@kraude-kode/events";
import { expect, test } from "vitest";
import { buildGauge, formatDuration, formatTimeUntil, formatTokenCount } from "./formatMetrics.ts";
import { fileName } from "./shortenPath.ts";
import { buildToolDiff } from "./toolDiff.ts";
import { describeApproval, summarizeToolCall } from "./toolSummary.ts";
import { clipLines, truncateText } from "./truncateText.ts";

const call = (name: string, input: Record<string, unknown>): ToolCall => ({
  id: "t",
  name,
  input,
  status: "running",
  expanded: false,
  startedAt: 0,
});

test("truncates and clips text", () => {
  expect(truncateText("a  b\nc", 20)).toBe("a b c");
  expect(truncateText("a".repeat(10), 5)).toBe("aaaa…");
  expect(clipLines("1\n2\n3\n4", 2)).toBe("1\n2\n… 2 more lines");
  expect(clipLines("1\n2", 2)).toBe("1\n2");
});

test("formats tokens, durations and the context meter", () => {
  expect(formatTokenCount(900)).toBe("900");
  expect(formatTokenCount(48_000)).toBe("48k");
  expect(formatTokenCount(1_500_000)).toBe("1.5M");
  expect(formatDuration(1400)).toBe("1.4s");
});

test("builds a ten cell gauge where each cell is 10% and a half cell is 5%", () => {
  expect(buildGauge(0)).toBe("░░░░░");
  expect(buildGauge(0.07)).toBe("▒░░░░");
  expect(buildGauge(0.5)).toBe("██▓░░");
  expect(buildGauge(1)).toBe("█████");
  expect(buildGauge(3)).toBe("█████");
});

test("reads the file name from full, relative and trailing-slash paths", () => {
  expect(fileName("/work/app/src/auth.ts")).toBe("auth.ts");
  expect(fileName("src/auth.ts")).toBe("auth.ts");
  expect(fileName("auth.ts")).toBe("auth.ts");
  expect(fileName("src/dir/")).toBe("dir");
  expect(fileName("/")).toBe("/");
});

test("summarizes tool calls and approval prompts", () => {
  expect(summarizeToolCall(call("Read", { file_path: "src/a.ts" }))).toBe("a.ts");
  expect(summarizeToolCall(call("Bash", { command: "npm test", description: "x" }))).toBe(
    "npm test",
  );
  expect(summarizeToolCall(call("Other", { a: 1 }))).toBe('{"a":1}');
  expect(describeApproval(call("Bash", { command: "npm test" }))).toBe("Run command `npm test`?");
  expect(describeApproval(call("Edit", { file_path: "a.ts" }))).toBe("Modify `a.ts` with Edit?");
  expect(describeApproval(call("WebFetch", {}))).toBe("Allow `WebFetch`?");
  expect(
    summarizeToolCall(call("Write", { file_path: "/work/app/src/server.ts", description: "x" })),
  ).toBe("server.ts");
  expect(describeApproval(call("Edit", { file_path: "/work/app/src/auth.ts" }))).toBe(
    "Modify `auth.ts` with Edit?",
  );
});

test("builds diffs for edit and write tools only", () => {
  const edit = buildToolDiff(
    call("Edit", {
      file_path: "src/a.ts",
      old_string: "const b = 2",
      new_string: "const b = 3\nconst c = 4",
    }),
  );
  expect(edit).toMatchObject({ additions: 2, deletions: 1, filetype: "typescript" });
  expect(edit?.patch).toContain("+const c = 4");

  const write = buildToolDiff(call("Write", { file_path: "notes.txt", content: "hi" }));
  expect(write).toMatchObject({ additions: 1, deletions: 0, filetype: undefined });

  const multi = buildToolDiff(
    call("MultiEdit", { file_path: "a.js", edits: [{ old_string: "x", new_string: "y" }] }),
  );
  expect(multi).toMatchObject({ additions: 1, deletions: 1 });
  expect(buildToolDiff(call("Bash", { command: "ls" }))).toBeUndefined();
});

test("formats the time until a rate limit resets", () => {
  const minute = 60_000;
  expect(formatTimeUntil(45 * minute, 0)).toBe("45m");
  expect(formatTimeUntil(134 * minute, 0)).toBe("2h14m");
  expect(formatTimeUntil((3 * 24 * 60 + 4 * 60) * minute, 0)).toBe("3d4h");
  expect(formatTimeUntil(0, 5 * minute)).toBe("just now");
});

test("summarizes and describes a batch edit call", () => {
  const batch = call(BATCH_EDIT_TOOL_NAME, {
    edits: [{ file_path: "/a.ts" }, { file_path: "/a.ts" }, { file_path: "/b.ts" }],
  });
  expect(summarizeToolCall(batch)).toBe("3 edits in 2 files");
  expect(describeApproval(batch)).toBe("Apply 3 edits in 2 files with BatchEdit?");
  expect(stripCustomPrefix(BATCH_EDIT_TOOL_NAME)).toBe("BatchEdit");
});
