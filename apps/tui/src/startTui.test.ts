import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DaemonEvent, DaemonEventListener, EventClient } from "@claudin/daemon/client";
import type { RequestEvent } from "@claudin/events";
import { rgbToHex } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, expect, test } from "vitest";
import { startTui, type TuiOptions } from "./startTui.ts";
import { Theme } from "./theme/colors.ts";

class FakeClient implements EventClient {
  sent: RequestEvent[] = [];
  listener: DaemonEventListener = () => {};
  closed = false;

  send(request: RequestEvent) {
    this.sent.push(request);
  }

  subscribe(listener: DaemonEventListener) {
    this.listener = listener;
    return () => {};
  }

  close() {
    this.closed = true;
  }

  receive(response: unknown, peer = false) {
    this.listener(response as DaemonEvent, peer);
  }

  receiveMessage(message: unknown) {
    this.receive({ type: "agent.message.received", message });
  }

  lastOfType<T extends RequestEvent["type"]>(type: T) {
    return this.sent.findLast((request) => request.type === type) as
      | Extract<RequestEvent, { type: T }>
      | undefined;
  }
}

type Harness = Awaited<ReturnType<typeof createHarness>>;

let active: Harness | undefined;

async function createHarness(width = 100, height = 32, options: TuiOptions = {}) {
  const client = new FakeClient();
  const setup = await createTestRenderer({
    width,
    height,
    exitOnCtrlC: false,
    kittyKeyboard: true,
  });
  const historyPath = join(await mkdtemp(join(tmpdir(), "claudin-history-")), "history.jsonl");
  await startTui(client, { renderer: setup.renderer, historyPath, ...options });
  client.receive({
    type: "workspace.info.received",
    cwd: "/work/app",
    gitBranch: "main",
    gitStats: { additions: 0, deletions: 0 },
  });
  client.receive({ type: "agent.session.created", agentSessionId: "a1" });
  const frame = async () => {
    await setup.renderOnce();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await setup.renderOnce();
    return setup.captureCharFrame();
  };
  const harness = { client, historyPath, ...setup, frame };
  active = harness;
  return harness;
}

const assistantMessage = (id: string, content: unknown[]) => ({
  type: "assistant",
  parent_tool_use_id: null,
  message: { id, content, usage: { input_tokens: 48_000, output_tokens: 10 } },
});

const toolUse = (id: string, name: string, input: Record<string, unknown>) => ({
  type: "tool_use",
  id,
  name,
  input,
});

const toolResult = (id: string, content: string) => ({
  type: "user",
  message: { content: [{ type: "tool_result", tool_use_id: id, content }] },
});

async function submit(harness: Harness, text: string) {
  await harness.mockInput.typeText(text);
  harness.mockInput.pressEnter();
}

afterEach(() => {
  active?.renderer.destroy();
  active = undefined;
});

test("startup asks for workspace info and an agent session", async () => {
  const { client, frame } = await createHarness();
  expect(client.sent.map((request) => request.type)).toEqual([
    "workspace.info.requested",
    "agent.rate_limit.cached.requested",
    "options.load.requested",
    "agent.session.create.requested",
    "agent.commands.requested",
    "agent.rate_limit.requested",
  ]);
  const output = await frame();
  for (const expected of [
    "/work/app",
    "main",
    "Claude Haiku 5.5 (shift+tab) ⋅ ⣤ high ⋅ $0.000 ⋅ ⛉ Bypass",
  ]) {
    expect(output).toContain(expected);
  }
  expect(output).not.toContain("Idle");
  expect(output).toContain("Type your prompt");
  expect(client.lastOfType("agent.session.create.requested")).toMatchObject({
    options: { model: "claude-haiku-5-5", effort: "high", permissionMode: "bypassPermissions" },
  });
});

test("the label shows the model and effort and follows /effort", async () => {
  const harness = await createHarness();
  harness.client.receiveMessage({
    type: "system",
    subtype: "init",
    model: "claude-sonnet-5-5",
    cwd: "/work/app",
    permissionMode: "default",
  });
  expect(await harness.frame()).toContain("Claude Sonnet 5.5 (shift+tab) ⋅ ⣤ high");
  await submit(harness, "/effort max");
  expect(harness.client.lastOfType("agent.effort.set.requested")?.effort).toBe("max");
  harness.client.receive({ type: "agent.effort.changed", effort: "max" });
  const output = await harness.frame();
  expect(output).toContain("Claude Sonnet 5.5 (shift+tab) ⋅ ⣿ max");
});

test("submitting sends the prompt and shows it in the transcript", async () => {
  const harness = await createHarness();
  await submit(harness, "Implement auth");
  expect(harness.client.lastOfType("agent.prompt.requested")).toEqual({
    type: "agent.prompt.requested",
    agentSessionId: "a1",
    content: "Implement auth",
  });
  const output = await harness.frame();
  expect(output).toContain("❯ Implement auth");
  expect(output).toContain("Thinking…");
  expect(output).toContain("[stop]");
});

test("streams assistant markdown and settles on the final message", async () => {
  const harness = await createHarness();
  await submit(harness, "hi");
  const { client } = harness;
  client.receiveMessage({
    type: "stream_event",
    parent_tool_use_id: null,
    event: { type: "message_start", message: { id: "m1", usage: { input_tokens: 48_000 } } },
  });
  client.receiveMessage({
    type: "stream_event",
    parent_tool_use_id: null,
    event: { type: "content_block_start", index: 0, content_block: { type: "text" } },
  });
  client.receiveMessage({
    type: "stream_event",
    parent_tool_use_id: null,
    event: {
      type: "content_block_delta",
      delta: { type: "text_delta", text: "# Plan\n\nUse **bold** text" },
    },
  });
  expect(await harness.frame()).toContain("Use bold text");

  client.receiveMessage(
    assistantMessage("m1", [{ type: "text", text: "# Plan\n\nUse **bold** text" }]),
  );
  client.receiveMessage({
    type: "result",
    subtype: "success",
    is_error: false,
    modelUsage: { m: { contextWindow: 120_000 } },
  });
  const output = await harness.frame();
  expect(output.match(/Use bold text/g)).toHaveLength(1);
  expect(output).not.toContain("Thinking…");
  expect(output).not.toContain("Idle");
  expect(output).toContain("48k/120k");
  expect(output).toContain("40%");
});

test("fenced code renders inside a bordered block", async () => {
  const harness = await createHarness();
  harness.client.receiveMessage(
    assistantMessage("m1", [{ type: "text", text: "Here:\n\n```ts\nconst answer = 42\n```" }]),
  );
  const output = await harness.frame();
  expect(output).toContain("const answer = 42");
  expect(output).toContain("╭");
});

async function clickText(harness: Harness, text: string) {
  const lines = (await harness.frame()).split("\n");
  const row = lines.findIndex((line) => line.includes(text));
  expect(row).toBeGreaterThanOrEqual(0);
  await harness.mockMouse.click((lines[row] ?? "").indexOf(text) + 1, row);
}

test("tool calls render collapsed without a group title and expand on click", async () => {
  const harness = await createHarness();
  await submit(harness, "edit");
  const { client } = harness;
  client.receiveMessage(
    assistantMessage("m1", [
      toolUse("t1", "Read", { file_path: "src/server.ts" }),
      toolUse("t2", "Edit", {
        file_path: "src/auth.ts",
        old_string: "function oldAuth() {}",
        new_string: "export function authenticate() {}",
      }),
      toolUse("t3", "Bash", { command: "ls" }),
    ]),
  );
  client.receiveMessage(toolResult("t3", "alpha.txt"));
  const output = await harness.frame();
  expect(output).not.toContain("Tool Execution Group");
  expect(output).toContain("🞂 Read src/server.ts");
  expect(output).toContain("🞂 Edit src/auth.ts (+1 -1)");
  expect(output).toContain("🞂 Bash ls");
  expect(output).not.toContain("authenticate()");
  expect(output).not.toContain("alpha.txt");
  expect(output).toContain("Executing…");

  await clickText(harness, "🞂 Edit src/auth.ts");
  let expanded = await harness.frame();
  expect(expanded).toContain("🞃 Edit src/auth.ts");
  expect(expanded).toMatch(/\+ export function authenticate\(\) \{\}/);
  expect(expanded).toMatch(/- function oldAuth\(\) \{\}/);
  expect(expanded).not.toContain("alpha.txt");

  await clickText(harness, "🞂 Bash ls");
  expect(await harness.frame()).toContain("alpha.txt");

  await clickText(harness, "🞃 Edit src/auth.ts");
  expanded = await harness.frame();
  expect(expanded).not.toContain("authenticate()");
  expect(expanded).toContain("alpha.txt");
});

test("hovering a tool call header highlights it with the accent color", async () => {
  const harness = await createHarness();
  await submit(harness, "run");
  harness.client.receiveMessage(assistantMessage("m1", [toolUse("t1", "Bash", { command: "ls" })]));
  const lines = (await harness.frame()).split("\n");
  const row = lines.findIndex((line) => line.includes("🞂 Bash ls"));
  const column = (lines[row] ?? "").indexOf("Bash");
  const nameColor = async () => {
    await harness.frame();
    const spans = harness.captureSpans().lines[row]?.spans ?? [];
    const span = spans.find((candidate) => candidate.text.includes("Bash"));
    return span ? rgbToHex(span.fg) : "";
  };
  expect(await nameColor()).not.toBe(Theme.accent.brand);
  await harness.mockMouse.moveTo(column, row);
  expect(await nameColor()).toBe(Theme.accent.brand);
  await harness.mockMouse.moveTo(column, row + 5);
  expect(await nameColor()).not.toBe(Theme.accent.brand);
});

test("each tool call shows its own execution time on the right", async () => {
  const harness = await createHarness();
  await submit(harness, "run");
  harness.client.receiveMessage(assistantMessage("m1", [toolUse("t1", "Bash", { command: "ls" })]));
  harness.client.receiveMessage(toolResult("t1", "ok"));
  const line = (await harness.frame()).split("\n").find((row) => row.includes("🞂 Bash ls")) ?? "";
  expect(line).toMatch(/🞂 Bash ls\s+\d+\.\ds\s*$/);
});

test("approval prompts can be answered with the keyboard", async () => {
  const harness = await createHarness();
  await submit(harness, "run tests");
  const { client } = harness;
  client.receiveMessage(assistantMessage("m1", [toolUse("t1", "Bash", { command: "npm test" })]));
  client.receive({
    type: "agent.tool.approval.required",
    agentSessionId: "a1",
    toolUseId: "t1",
    toolName: "Bash",
    input: { command: "npm test" },
  });
  const output = await harness.frame();
  expect(output).toContain(">>> APPROVAL REQUIRED: Run command `npm test`?");
  for (const label of ["[A] Approve All", "[Y] Approve Single", "[N] Reject"]) {
    expect(output).toContain(label);
  }
  expect(output).toContain("Approval required");

  harness.mockInput.pressKey("n");
  expect(client.lastOfType("agent.tool.approval.answered")).toEqual({
    type: "agent.tool.approval.answered",
    agentSessionId: "a1",
    toolUseId: "t1",
    decision: "reject",
  });
  harness.mockInput.pressKey("a");
  expect(client.lastOfType("agent.tool.approval.answered")?.decision).toBe("approve_all");
  harness.mockInput.pressEnter();
  expect(client.lastOfType("agent.tool.approval.answered")?.decision).toBe("approve");
  harness.mockInput.pressKey("y");
  expect(client.lastOfType("agent.tool.approval.answered")?.decision).toBe("approve");

  client.receive({ type: "agent.tool.approval.resolved", toolUseId: "t1", decision: "approve" });
  expect(await harness.frame()).not.toContain("APPROVAL REQUIRED");
});

const QUESTION_EVENT = {
  type: "agent.question.required",
  agentSessionId: "a1",
  toolUseId: "q1",
  questions: [
    {
      question: "Which library?",
      header: "Library",
      options: [
        { label: "Zod", description: "schemas" },
        { label: "Valibot", description: "small" },
      ],
    },
    {
      question: "Which extras?",
      header: "Extras",
      multiSelect: true,
      options: [
        { label: "Tests", description: "vitest" },
        { label: "Docs", description: "readme" },
      ],
    },
  ],
};

test("questions render, navigate with the keyboard and send every answer", async () => {
  const harness = await createHarness();
  await submit(harness, "plan it");
  harness.client.receiveMessage(assistantMessage("m1", [toolUse("q1", "AskUserQuestion", {})]));
  harness.client.receive(QUESTION_EVENT);
  const output = await harness.frame();
  expect(output).toContain(">>> Library (1/2): Which library?");
  expect(output).toContain("❯ Zod schemas");
  expect(output).toContain("Answer required");
  expect(output).toContain("Esc dismiss");

  harness.mockInput.pressArrow("down");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.question.answered")).toBeUndefined();
  expect(await harness.frame()).toContain("Which extras?");
  harness.mockInput.pressKey(" ");
  harness.mockInput.pressArrow("down");
  harness.mockInput.pressKey(" ");
  expect(await harness.frame()).toContain("◉ Docs");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.question.answered")).toEqual({
    type: "agent.question.answered",
    agentSessionId: "a1",
    toolUseId: "q1",
    answers: { "Which library?": "Valibot", "Which extras?": "Tests, Docs" },
  });
});

test("the last question row takes a typed custom answer", async () => {
  const harness = await createHarness();
  await submit(harness, "plan it");
  harness.client.receiveMessage(assistantMessage("m1", [toolUse("q1", "AskUserQuestion", {})]));
  harness.client.receive(QUESTION_EVENT);
  harness.mockInput.pressArrow("up");
  await harness.mockInput.typeText("Bun");
  harness.mockInput.pressBackspace();
  await harness.mockInput.typeText("n x");
  expect(await harness.frame()).toContain("Other: Bun x");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.question.answered")).toBeUndefined();
  expect(await harness.frame()).toContain("Which extras?");
});

test("idle shows the last run duration and tool count", async () => {
  const harness = await createHarness();
  await submit(harness, "go");
  harness.client.receiveMessage(
    assistantMessage("m1", [toolUse("t1", "Read", { file_path: "a" })]),
  );
  harness.client.receiveMessage({
    type: "result",
    subtype: "success",
    is_error: false,
    duration_ms: 12_300,
    modelUsage: {},
  });
  expect(await harness.frame()).toContain("✓ 12.3s ⋅ 1 tool");
});

test("glob and grep calls show their pattern and path", async () => {
  const harness = await createHarness();
  await submit(harness, "find");
  harness.client.receiveMessage(
    assistantMessage("m1", [
      toolUse("t1", "Grep", { pattern: "TODO", path: "src" }),
      toolUse("t2", "Glob", { pattern: "**/*.ts" }),
    ]),
  );
  const output = await harness.frame();
  expect(output).toContain("Grep TODO in src");
  expect(output).toContain("Glob **/*.ts");
});

test("escape dismisses a question and keystrokes stay out of the prompt", async () => {
  const harness = await createHarness();
  await submit(harness, "plan it");
  harness.client.receiveMessage(assistantMessage("m1", [toolUse("q1", "AskUserQuestion", {})]));
  harness.client.receive(QUESTION_EVENT);
  harness.mockInput.pressKey("x");
  harness.mockInput.pressEscape();
  expect(harness.client.lastOfType("agent.question.answered")?.answers).toEqual({});
  harness.client.receive({ type: "agent.question.resolved", toolUseId: "q1", answered: false });
  const lines = (await harness.frame()).split("\n");
  expect(lines.find((line) => line.includes("❯ "))).not.toContain("x");
});

test("approval keystrokes never leak into the prompt box", async () => {
  const harness = await createHarness();
  await submit(harness, "go");
  harness.client.receive({
    type: "agent.tool.approval.required",
    agentSessionId: "a1",
    toolUseId: "t1",
    toolName: "Write",
    input: { file_path: "a.txt", content: "x" },
  });
  harness.mockInput.pressKey("y");
  harness.client.receive({
    type: "agent.tool.approval.resolved",
    toolUseId: "t1",
    decision: "approve",
  });
  await harness.frame();
  await submit(harness, "later");
  expect(harness.client.lastOfType("agent.prompt.requested")?.content).not.toContain("y");
});

test("ctrl+c warns first and exits on the second press without cancelling the turn", async () => {
  const harness = await createHarness();
  await submit(harness, "long task");
  harness.mockInput.pressCtrlC();
  expect(await harness.frame()).toContain("Press Ctrl + C again to exit");
  expect(harness.client.closed).toBe(false);
  harness.mockInput.pressCtrlC();
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(harness.client.lastOfType("agent.prompt.cancel.requested")).toBeUndefined();
  expect(harness.client.closed).toBe(true);
});

test("the quit command and its aliases exit the app", async () => {
  for (const command of ["/quit", "/exit", "/q", "/leave"]) {
    const harness = await createHarness();
    await submit(harness, command);
    if (!harness.client.closed) harness.mockInput.pressEnter();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(harness.client.closed).toBe(true);
  }
});

test("a busy agent shows the queue and steer title and the interrupt hint", async () => {
  const harness = await createHarness();
  expect((await harness.frame()).includes("Ctrl+Q (queue)")).toBe(false);
  await submit(harness, "long task");
  const output = await harness.frame();
  expect(output).toContain("Ctrl+Q (queue) Ctrl+W (steer)");
  expect(output).toContain("(esc esc)");
});

test("ctrl+c while idle exits and closes the client", async () => {
  const harness = await createHarness();
  harness.mockInput.pressCtrlC();
  harness.mockInput.pressCtrlC();
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(harness.client.closed).toBe(true);
});

test("slash popover filters commands and tab completes", async () => {
  const harness = await createHarness();
  await harness.mockInput.typeText("/");
  let output = await harness.frame();
  for (const command of ["/permission", "/model", "/theme-background"]) {
    expect(output).toContain(command);
  }

  await harness.mockInput.typeText("cl");
  output = await harness.frame();
  expect(output).toContain("Start a fresh session");
  expect(output).not.toContain("/model");

  harness.mockInput.pressTab();
  output = await harness.frame();
  expect(output).toContain("❯ /clear");
  expect(output).not.toContain("Start a fresh session");

  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("session.create.requested")).toBeDefined();
});

test("slash popover lists the commands reported by the agent sdk", async () => {
  const harness = await createHarness();
  harness.client.receive({
    type: "agent.commands.received",
    commands: [
      { name: "compact", description: "Compact the conversation", argumentHint: "[focus]" },
    ],
  });
  await harness.mockInput.typeText("/comp");
  const output = await harness.frame();
  expect(output).toContain("/compact");
  expect(output).toContain("[focus] Compact the conversation");

  harness.mockInput.pressTab();
  await harness.frame();
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.prompt.requested")?.content).toBe("/compact");
});

test("@ opens file search and completion inserts the path", async () => {
  const harness = await createHarness();
  await harness.mockInput.typeText("read @ap");
  expect(harness.client.lastOfType("workspace.files.requested")?.query).toBe("ap");
  harness.client.receive({
    type: "workspace.files.received",
    query: "ap",
    matches: ["src/app.ts", "src/api.ts"],
  });
  let output = await harness.frame();
  expect(output).toContain("src/app.ts");
  expect(output).toContain("src/api.ts");

  harness.mockInput.pressArrow("down");
  harness.mockInput.pressTab();
  output = await harness.frame();
  expect(output).toContain("read @src/api.ts");
});

test("shift+enter inserts a newline and grows the input", async () => {
  const harness = await createHarness();
  await harness.mockInput.typeText("line one");
  harness.mockInput.pressEnter({ shift: true });
  await harness.mockInput.typeText("line two");
  const output = await harness.frame();
  expect(output).toContain("line one");
  expect(output).toContain("line two");
  expect(harness.client.lastOfType("agent.prompt.requested")).toBeUndefined();
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.prompt.requested")?.content).toBe("line one\nline two");
});

test("tab cycles focus between the input and the scrollback", async () => {
  const harness = await createHarness();
  harness.mockInput.pressTab();
  await harness.mockInput.typeText("zz");
  expect(await harness.frame()).not.toContain("zz");
  harness.mockInput.pressTab();
  await harness.mockInput.typeText("yy");
  expect(await harness.frame()).toContain("yy");
});

test("ctrl+q queues and ctrl+w steers a prompt while the agent is busy", async () => {
  const harness = await createHarness();
  await submit(harness, "first");
  await harness.mockInput.typeText("second");
  harness.mockInput.pressKey("q", { ctrl: true });
  expect(harness.client.lastOfType("agent.prompt.queue.requested")).toEqual({
    type: "agent.prompt.queue.requested",
    agentSessionId: "a1",
    content: "second",
  });
  await harness.mockInput.typeText("third");
  harness.mockInput.pressKey("w", { ctrl: true });
  expect(harness.client.lastOfType("agent.prompt.steer.requested")).toEqual({
    type: "agent.prompt.steer.requested",
    agentSessionId: "a1",
    content: "third",
  });
  const output = await harness.frame();
  expect(output).toContain("❯ second");
  expect(output).toContain("❯ third");
});

test("ctrl+q and ctrl+w send a normal prompt when the agent is idle", async () => {
  const harness = await createHarness();
  await harness.mockInput.typeText("hello");
  harness.mockInput.pressKey("q", { ctrl: true });
  expect(harness.client.lastOfType("agent.prompt.requested")?.content).toBe("hello");
  expect(harness.client.lastOfType("agent.prompt.queue.requested")).toBeUndefined();
});

test("a plain enter while busy keeps the text and explains the shortcuts", async () => {
  const harness = await createHarness();
  await submit(harness, "first");
  await submit(harness, "second");
  const output = await harness.frame();
  expect(output).toContain("Ctrl+Q queues");
  expect(output).toContain("second");
});

test("the status line shows the 5h and 7d rate limits with the time to reset", async () => {
  const harness = await createHarness();
  const now = Date.now();
  harness.client.receive({
    type: "agent.rate_limit.received",
    rateLimit: {
      five_hour: { utilization: 23.4, resets_at: new Date(now + 134.5 * 60_000).toISOString() },
      seven_day: {
        utilization: 41,
        resets_at: new Date(now + (3 * 24 * 60 + 4 * 60 + 1) * 60_000).toISOString(),
      },
    },
  });
  const output = await harness.frame();
  expect(output).toContain("➄ 23% █▒░░░ in 2h14m");
  expect(output).toContain("❼ 41% ██░░░ in 3d4h");
});

test("the status line below the editor shows settings and token usage", async () => {
  const harness = await createHarness(130);
  const lines = (await harness.frame()).split("\n");
  const status = lines.find((line) => line.includes("⛉ Bypass")) ?? "";
  expect(status).toContain("⛉ Bypass");
  expect(status).toContain("↑0 ↓0 ⇑0 ⇓0 ↯0%");
  harness.client.receive({ type: "agent.permission_mode.changed", mode: "acceptEdits" });
  harness.client.receiveMessage({
    type: "assistant",
    parent_tool_use_id: null,
    message: {
      id: "m1",
      content: [],
      usage: {
        input_tokens: 1_000,
        output_tokens: 2_000,
        cache_creation_input_tokens: 3_000,
        cache_read_input_tokens: 6_000,
      },
    },
  });
  const after = await harness.frame();
  expect(after).toContain("⛉ Accept Edits");
  expect(after).toContain("↑1k ↓2k ⇑3k ⇓6k ↯60%");
});

test("the editor box only has top and bottom borders", async () => {
  const harness = await createHarness();
  const lines = (await harness.frame()).split("\n");
  const row = lines.findIndex((line) => line.includes("❯"));
  expect(lines[row]?.trimStart().startsWith("❯")).toBe(true);
  expect(lines[row - 1]?.trim()).toMatch(/^─+$/);
  expect(lines[row + 1]?.trim()).toMatch(/^─+$/);
});

test("double escape interrupts a busy turn and a single one does not", async () => {
  const harness = await createHarness();
  await submit(harness, "long task");
  harness.mockInput.pressEscape();
  expect(harness.client.lastOfType("agent.prompt.cancel.requested")).toBeUndefined();
  harness.mockInput.pressEscape();
  expect(harness.client.lastOfType("agent.prompt.cancel.requested")).toEqual({
    type: "agent.prompt.cancel.requested",
    agentSessionId: "a1",
  });
});

test("the theme picker previews the highlighted theme and saves only on enter", async () => {
  const harness = await createHarness();
  const defaultBrand = Theme.accent.brand;
  await submit(harness, "/theme");
  harness.mockInput.pressEnter();
  await harness.frame();
  harness.mockInput.pressArrow("down");
  await harness.frame();
  expect(Theme.accent.brand).not.toBe(defaultBrand);
  harness.mockInput.pressEscape();
  await harness.frame();
  expect(Theme.accent.brand).toBe(defaultBrand);
  expect(await harness.frame()).not.toContain("Theme set to");

  await submit(harness, "/theme");
  harness.mockInput.pressEnter();
  harness.mockInput.pressArrow("down");
  harness.mockInput.pressEnter();
  const output = await harness.frame();
  expect(output).toContain("Theme set to");
  expect(Theme.accent.brand).not.toBe(defaultBrand);
});

test("the header shows the full path below a top margin and a bottom border", async () => {
  const harness = await createHarness();
  const lines = (await harness.frame()).split("\n");
  expect(lines[0]?.trim()).toBe("");
  expect(lines[1]).toContain("/work/app");
  expect(lines[2]?.trim()).toMatch(/^─+$/);
});

test("resuming a session restores it and resumes its agent session", async () => {
  const harness = await createHarness(100, 32, { resumeSessionId: "s9" });
  expect(harness.client.lastOfType("session.restore.requested")?.sessionId).toBe("s9");
  harness.client.receive({
    type: "session.restored",
    sessionId: "s9",
    events: [
      { type: "session.created", sessionId: "s9" },
      { type: "agent.session.created", agentSessionId: "a9" },
      { type: "agent.model.changed", model: "claude-sonnet-5-5" },
      { type: "agent.prompt.requested", agentSessionId: "a9", content: "earlier question" },
    ].map((event, index) => ({ timestamp: 1_000 + index, event })),
  });
  expect(harness.client.lastOfType("agent.session.resume.requested")).toMatchObject({
    agentSessionId: "a9",
    options: { model: "claude-sonnet-5-5" },
  });
  const output = await harness.frame();
  expect(output).toContain("earlier question");
  expect(output).toContain("Session restored");
});

test("the exit callback receives the session id when the tui is destroyed", async () => {
  const exited: string[] = [];
  const harness = await createHarness(100, 32, { onExit: (id) => exited.push(id) });
  harness.client.receive({ type: "session.created", sessionId: "s7" });
  harness.mockInput.pressCtrlC();
  harness.mockInput.pressCtrlC();
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(exited).toEqual(["s7"]);
});

test("the clear command resets the transcript", async () => {
  const harness = await createHarness();
  await submit(harness, "remember this");
  expect(await harness.frame()).toContain("remember this");
  await submit(harness, "/clear");
  harness.mockInput.pressEnter();
  const before = harness.client.sent.length;
  expect(harness.client.lastOfType("session.create.requested")).toBeDefined();
  harness.client.receive({ type: "session.created", sessionId: "s2" });
  expect(harness.client.sent.slice(before).map((r) => r.type)).toEqual([
    "agent.session.create.requested",
  ]);
  harness.client.receive({ type: "agent.session.created", agentSessionId: "a2" });
  const output = await harness.frame();
  expect(output).not.toContain("remember this");
});

test("shift+tab asks the agent to cycle the model", async () => {
  const harness = await createHarness();
  harness.mockInput.pressTab({ shift: true });
  expect(harness.client.lastOfType("agent.model.cycle.requested")).toEqual({
    type: "agent.model.cycle.requested",
    agentSessionId: "a1",
  });
  harness.client.receive({ type: "agent.model.changed", model: "claude-sonnet-5-5" });
  expect(await harness.frame()).toContain("Claude Sonnet 5.5 (shift+tab)");
});

test("shift+tab cycles the model while a turn is running", async () => {
  const harness = await createHarness();
  await submit(harness, "work");
  harness.mockInput.pressTab({ shift: true });
  expect(harness.client.lastOfType("agent.model.cycle.requested")).toBeDefined();
});

const MODELS = [
  {
    value: "default",
    resolvedModel: "claude-opus-5-5",
    displayName: "Default",
    description: "Recommended",
  },
  {
    value: "haiku",
    resolvedModel: "claude-haiku-5-5",
    displayName: "Haiku",
    description: "Fastest",
  },
];

test("/model lists the available models and selecting one switches to it", async () => {
  const harness = await createHarness();
  await submit(harness, "/model");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.models.requested")?.agentSessionId).toBe("a1");
  harness.client.receive({ type: "agent.models.received", models: MODELS });
  const output = await harness.frame();
  expect(output).toContain("Select a model");
  expect(output).toContain("Default");
  expect(output).toContain("Haiku");
  expect(output).toContain("Esc close");

  harness.mockInput.pressArrow("down");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.model.set.requested")).toMatchObject({ model: "haiku" });
  harness.client.receive({ type: "agent.model.changed", model: "haiku" });
  const after = await harness.frame();
  expect(after).not.toContain("Select a model");
  expect(after).toContain("Claude Haiku 5.5");
});

test("escape closes the picker without changing anything", async () => {
  const harness = await createHarness();
  harness.client.receive({ type: "agent.models.received", models: MODELS });
  expect(await harness.frame()).toContain("Select a model");
  harness.mockInput.pressEscape();
  expect(await harness.frame()).not.toContain("Select a model");
  expect(harness.client.lastOfType("agent.model.set.requested")).toBeUndefined();
});

const SESSIONS = [
  { id: "s-current", title: "current work", cwd: "/work/app", updatedAt: Date.now() },
  { id: "s-old", title: "fix the parser", cwd: "/work/other", updatedAt: Date.now() - 3_600_000 },
];

test("/session lists stored sessions and selecting one restores it", async () => {
  const harness = await createHarness();
  harness.client.receive({ type: "session.created", sessionId: "s-current" });
  await submit(harness, "/session");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("session.list.requested")).toBeDefined();
  harness.client.receive({ type: "session.list.received", sessions: SESSIONS });
  const output = await harness.frame();
  expect(output).toContain("Switch session");
  expect(output).toContain("current work (current)");
  expect(output).toContain("fix the parser");
  expect(output).toContain("/work/other ⋅ 1h ago");

  harness.mockInput.pressArrow("down");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("session.restore.requested")?.sessionId).toBe("s-old");
});

test("/session says so when nothing is stored", async () => {
  const harness = await createHarness();
  harness.client.receive({ type: "session.list.received", sessions: [] });
  expect(await harness.frame()).toContain("No stored sessions yet");
});

test("/cd requests a directory change and starts an agent session there", async () => {
  const harness = await createHarness();
  await submit(harness, "/cd ~/other");
  expect(harness.client.lastOfType("workspace.cwd.set.requested")?.path).toBe("~/other");
  const before = harness.client.sent.length;
  harness.client.receive({ type: "session.created", sessionId: "s2" });
  harness.client.receive({
    type: "workspace.cwd.changed",
    cwd: "/home/other",
    gitBranch: "dev",
    gitStats: { additions: 0, deletions: 0 },
  });
  expect(harness.client.sent.slice(before).map((r) => r.type)).toContain(
    "agent.session.create.requested",
  );
  const output = await harness.frame();
  expect(output).toContain("/home/other");
  expect(output).toContain("dev");
});

async function fillNotices(harness: Awaited<ReturnType<typeof createHarness>>, count = 40) {
  for (let i = 0; i < count; i++) {
    harness.client.receive({
      type: "ui.notice.posted",
      text: `line-${String(i).padStart(2, "0")}`,
    });
  }
  expect(await harness.frame()).toContain("line-39");
}

test("the mouse wheel scrolls the messages from anywhere on screen", async () => {
  const harness = await createHarness(100, 24);
  await fillNotices(harness);
  await harness.mockMouse.scroll(40, 8, "up");
  await harness.mockMouse.scroll(40, 8, "up");
  expect(await harness.frame()).not.toContain("line-39");
  await harness.mockMouse.scroll(40, 8, "down");
  await harness.mockMouse.scroll(40, 8, "down");
  expect(await harness.frame()).toContain("line-39");
  for (const y of [1, 21, 22]) await harness.mockMouse.scroll(40, y, "up");
  expect(await harness.frame()).not.toContain("line-39");
});

test("page up scrolls the messages and arrows only scroll while the prompt is empty", async () => {
  const harness = await createHarness(100, 24);
  await fillNotices(harness);
  harness.mockInput.pressKey("\u001B[5~");
  expect(await harness.frame()).not.toContain("line-39");
  harness.mockInput.pressKey("\u001B[6~");
  harness.mockInput.pressKey("\u001B[6~");
  expect(await harness.frame()).toContain("line-39");
  harness.mockInput.pressArrow("up");
  harness.mockInput.pressArrow("up");
  expect(await harness.frame()).not.toContain("line-39");
  harness.mockInput.pressKey("\u001B[6~");
  harness.mockInput.pressKey("\u001B[6~");
  await harness.mockInput.typeText("a");
  harness.mockInput.pressArrow("up");
  expect(await harness.frame()).toContain("line-39");
});

test("the idle line adds the first six words of the last prompt", async () => {
  const harness = await createHarness();
  await submit(harness, "please refactor the status line component right now");
  harness.client.receiveMessage({
    type: "result",
    subtype: "success",
    is_error: false,
    duration_ms: 6_000,
    modelUsage: {},
  });
  expect(await harness.frame()).toContain(
    "✓ 6.0s ⋅ 0 tools ⋅ please refactor the status line component…",
  );
});

test("/theme-background previews RGBA sliders live and saves on enter", async () => {
  const harness = await createHarness();
  expect(Theme.bg.default).toBe("#00000000");
  await submit(harness, "/theme-background");
  harness.mockInput.pressEnter();
  let output = await harness.frame();
  expect(output).toContain("Background color");
  expect(output).toContain("❯ R");

  harness.mockInput.pressArrow("right");
  harness.mockInput.pressArrow("right", { shift: true });
  harness.mockInput.pressArrow("down");
  harness.mockInput.pressArrow("down");
  harness.mockInput.pressArrow("down");
  for (let step = 0; step < 15; step += 1) harness.mockInput.pressArrow("right", { shift: true });
  output = await harness.frame();
  expect(Theme.bg.default).toBe("#110000f0");
  expect(output).toContain("❯ A");

  harness.mockInput.pressEscape();
  output = await harness.frame();
  expect(output).not.toContain("Background color");
  expect(Theme.bg.default).toBe("#00000000");

  await submit(harness, "/theme-background");
  harness.mockInput.pressEnter();
  harness.mockInput.pressArrow("right", { shift: true });
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("options.background.save.requested")?.color).toEqual({
    r: 16,
    g: 0,
    b: 0,
    a: 0,
  });
  harness.client.receive({
    type: "options.background.saved",
    color: { r: 16, g: 0, b: 0, a: 255 },
  });
  output = await harness.frame();
  expect(output).toContain("Background color saved");
  expect(Theme.bg.default).toBe("#100000");
});

test("a stored background loaded at startup is applied", async () => {
  const harness = await createHarness();
  harness.client.receive({
    type: "options.loaded",
    background: { r: 0, g: 255, b: 0, a: 255 },
  });
  await harness.frame();
  expect(Theme.bg.default).toBe("#00ff00");
});

async function submitCommand(harness: Harness, command: string) {
  await submit(harness, command);
  harness.mockInput.pressEnter();
}

const finishTurn = (harness: Harness) =>
  harness.client.receiveMessage({ type: "result", subtype: "success", is_error: false });

const inputLine = async (harness: Harness) =>
  (await harness.frame()).split("\n").findLast((line) => line.includes("❯ ")) ?? "";

test("shift+up and shift+down recall earlier prompts and ctrl+r searches them", async () => {
  const harness = await createHarness();
  await submit(harness, "first idea");
  finishTurn(harness);
  await submit(harness, "second idea");
  finishTurn(harness);
  await harness.mockInput.typeText("fir");
  harness.mockInput.pressArrow("up", { shift: true });
  expect(await inputLine(harness)).toContain("second idea");
  harness.mockInput.pressArrow("up", { shift: true });
  expect(await inputLine(harness)).toContain("first idea");
  harness.mockInput.pressArrow("down", { shift: true });
  harness.mockInput.pressArrow("down", { shift: true });
  expect(await inputLine(harness)).not.toContain("idea");
  harness.mockInput.pressKey("r", { ctrl: true });
  expect(await inputLine(harness)).toContain("first idea");
});

test("/fork copies the session and then forks the agent conversation", async () => {
  const harness = await createHarness();
  await submitCommand(harness, "/fork");
  expect(harness.client.lastOfType("session.fork.requested")).toBeDefined();
  harness.client.receive({
    type: "session.forked",
    sessionId: "s2",
    events: [{ timestamp: 1, event: { type: "agent.session.created", agentSessionId: "a1" } }],
  });
  expect(harness.client.lastOfType("agent.session.fork.requested")).toMatchObject({
    agentSessionId: "a1",
  });
  expect(await harness.frame()).toContain("Session forked");
});

test("/rewind lists checkpointed prompts and rewinds files to the chosen one", async () => {
  const harness = await createHarness();
  await submit(harness, "add login");
  harness.client.receiveMessage({
    type: "user",
    uuid: "u1",
    isReplay: true,
    parent_tool_use_id: null,
    message: { role: "user", content: "add login" },
  });
  finishTurn(harness);
  await submitCommand(harness, "/rewind");
  expect(await harness.frame()).toContain("Restore files to before this prompt");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.files.rewind.requested")).toEqual({
    type: "agent.files.rewind.requested",
    agentSessionId: "a1",
    userMessageId: "u1",
  });
  harness.client.receive({
    type: "agent.files.rewound",
    userMessageId: "u1",
    filesChanged: ["src/login.ts"],
    insertions: 0,
    deletions: 12,
  });
  expect(await harness.frame()).toContain("Rewound 1 file(s) (+0 -12): src/login.ts");
});

test("/view-diffs asks for the edited files and shows their diffs until escape", async () => {
  const harness = await createHarness(100, 32);
  await submit(harness, "edit it");
  harness.client.receiveMessage(
    assistantMessage("m1", [toolUse("e1", "Edit", { file_path: "/work/app/src/a.ts" })]),
  );
  harness.client.receiveMessage(toolResult("e1", "ok"));
  finishTurn(harness);
  await submitCommand(harness, "/view-diffs");
  expect(harness.client.lastOfType("workspace.diff.requested")?.paths).toEqual([
    "/work/app/src/a.ts",
  ]);
  harness.client.receive({
    type: "workspace.diff.received",
    files: [
      {
        path: "src/a.ts",
        patch: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old line\n+new line\n",
        additions: 1,
        deletions: 1,
      },
    ],
  });
  const output = await harness.frame();
  expect(output).toContain("Session diffs");
  expect(output).toContain("new line");
  harness.mockInput.pressEscape();
  expect(await harness.frame()).not.toContain("Session diffs");
});

test("/export and /search reach the daemon and search results open a picker", async () => {
  const harness = await createHarness();
  await submit(harness, "/export notes.md");
  expect(harness.client.lastOfType("session.export.requested")?.path).toBe("notes.md");
  await submit(harness, "/search webhook");
  expect(harness.client.lastOfType("session.search.requested")?.query).toBe("webhook");
  harness.client.receive({
    type: "session.search.received",
    query: "webhook",
    sessions: [{ id: "old", title: "…fix the webhook…", cwd: "/work/app", updatedAt: 0 }],
  });
  const output = await harness.frame();
  expect(output).toContain("Matching sessions");
  expect(output).toContain("fix the webhook");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("session.restore.requested")?.sessionId).toBe("old");
});

test("attaching syncs the live session instead of starting a new agent", async () => {
  const harness = await createHarness(100, 32, { attach: true });
  const types = harness.client.sent.map((request) => request.type);
  expect(types).toContain("session.sync.requested");
  expect(types).not.toContain("agent.session.create.requested");
  harness.client.receive({
    type: "session.synced",
    sessionId: "live",
    agentLive: true,
    events: [
      { timestamp: 1, event: { type: "agent.session.created", agentSessionId: "a9" } },
      {
        timestamp: 2,
        event: { type: "agent.prompt.requested", agentSessionId: "a9", content: "shared work" },
      },
    ],
  });
  expect(await harness.frame()).toContain("shared work");
  expect(harness.client.lastOfType("agent.session.resume.requested")).toBeUndefined();
});

test("attaching to a daemon without a live agent resumes the conversation", async () => {
  const harness = await createHarness(100, 32, { attach: true });
  harness.client.receive({
    type: "session.synced",
    sessionId: "stored",
    agentLive: false,
    events: [{ timestamp: 1, event: { type: "agent.session.created", agentSessionId: "a9" } }],
  });
  expect(harness.client.lastOfType("agent.session.resume.requested")?.agentSessionId).toBe("a9");
});

test("events from peers update the view without triggering local reactions", async () => {
  const harness = await createHarness();
  const before = harness.client.sent.length;
  harness.client.receive({ type: "session.created", sessionId: "s2" }, true);
  harness.client.receive(
    { type: "agent.prompt.requested", agentSessionId: "a1", content: "from a peer" },
    true,
  );
  expect(harness.client.sent.length).toBe(before);
  expect(await harness.frame()).toContain("from a peer");
});

test("pasting a big chunk of text shows a placeholder and sends the full text", async () => {
  const harness = await createHarness();
  const big = Array.from({ length: 8 }, (_, index) => `line ${index}`).join("\n");
  await harness.mockInput.pasteBracketedText(big);
  expect(await harness.frame()).toContain("[Pasted text #1 +8 lines]");
  await harness.mockInput.typeText(" please");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.prompt.requested")?.content).toBe(`${big} please`);
});

test("pasting an image file path attaches the image as a block", async () => {
  const path = `${tmpdir()}/claudin-paste-test.png`;
  await Bun.write(path, new Uint8Array([137, 80, 78, 71]));
  const harness = await createHarness();
  await harness.mockInput.pasteBracketedText(path);
  expect(await harness.frame()).toContain("[Image #1]");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.prompt.requested")?.content).toMatchObject([
    { type: "text", text: "[Image #1]" },
    { type: "image", source: { type: "base64", media_type: "image/png" } },
  ]);
});

test("short pastes are inserted as typed", async () => {
  const harness = await createHarness();
  await harness.mockInput.pasteBracketedText("small");
  harness.mockInput.pressEnter();
  expect(harness.client.lastOfType("agent.prompt.requested")?.content).toBe("small");
});

test("the typed prompt is saved to the history file after the debounce", async () => {
  const harness = await createHarness();
  await submit(harness, "sent one");
  await harness.mockInput.typeText("still typing");
  await new Promise((resolve) => setTimeout(resolve, 700));
  const lines = (await Bun.file(harness.historyPath).text()).trim().split("\n");
  expect(lines.map((line) => JSON.parse(line).text)).toEqual(["sent one", "still typing"]);
});
