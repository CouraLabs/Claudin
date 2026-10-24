import type { ResponseEvent } from "@kraude-kode/events";
import { expect, test } from "vitest";
import { PermissionGate } from "./permissionGate.ts";

type ToolOptions = Parameters<PermissionGate["canUseTool"]>[2];

const QUESTIONS = [
  {
    question: "Which library?",
    header: "Library",
    options: [
      { label: "A", description: "first" },
      { label: "B", description: "second" },
    ],
  },
];

function createGate() {
  const events: ResponseEvent[] = [];
  const gate = new PermissionGate("a1");
  gate.listen((event) => events.push(event));
  const useTool = (
    name: string,
    id: string,
    input: Record<string, unknown> = { command: "npm test" },
    signal = new AbortController().signal,
  ) => gate.canUseTool(name, input, { toolUseID: id, signal } as ToolOptions);
  const ask = (id: string, signal?: AbortSignal, questions: unknown = QUESTIONS) =>
    useTool("AskUserQuestion", id, { questions }, signal);
  return { gate, events, useTool, ask };
}

test("safe tools are allowed without asking", async () => {
  const { useTool, events } = createGate();
  expect(await useTool("Read", "t1")).toMatchObject({ behavior: "allow" });
  expect(await useTool("Agent", "t2")).toMatchObject({ behavior: "allow" });
  expect(events).toEqual([]);
});

test("risky tools wait for an approval decision", async () => {
  const { gate, useTool, events } = createGate();
  const result = useTool("Bash", "t1");
  expect(events).toEqual([
    {
      type: "agent.tool.approval.required",
      agentSessionId: "a1",
      toolUseId: "t1",
      toolName: "Bash",
      input: { command: "npm test" },
    },
  ]);
  gate.answerApproval("t1", "approve");
  expect(await result).toEqual({ behavior: "allow", updatedInput: { command: "npm test" } });
  expect(events.at(-1)).toEqual({
    type: "agent.tool.approval.resolved",
    toolUseId: "t1",
    decision: "approve",
  });
});

test("rejecting denies the tool call", async () => {
  const { gate, useTool } = createGate();
  const result = useTool("Edit", "t1");
  gate.answerApproval("t1", "reject");
  expect(await result).toMatchObject({ behavior: "deny" });
});

test("approve all settles pending approvals and skips future prompts", async () => {
  const { gate, useTool, events } = createGate();
  const first = useTool("Bash", "t1");
  const second = useTool("Write", "t2");
  gate.answerApproval("t1", "approve_all");
  expect(await Promise.all([first, second])).toEqual([
    expect.objectContaining({ behavior: "allow" }),
    expect.objectContaining({ behavior: "allow" }),
  ]);
  const before = events.length;
  expect(await useTool("Bash", "t3")).toMatchObject({ behavior: "allow" });
  expect(events).toHaveLength(before);
});

test("aborting denies a pending call and unknown answers are ignored", async () => {
  const { gate, useTool, events } = createGate();
  const controller = new AbortController();
  const result = useTool("Bash", "t1", undefined, controller.signal);
  gate.answerApproval("missing", "approve");
  controller.abort();
  expect(await result).toMatchObject({ behavior: "deny" });
  expect(events.at(-1)).toMatchObject({ type: "agent.tool.approval.resolved", decision: "reject" });
});

test("asking emits the questions and waits for answers", async () => {
  const { gate, ask, events } = createGate();
  const result = ask("t1");
  expect(events).toEqual([
    {
      type: "agent.question.required",
      agentSessionId: "a1",
      toolUseId: "t1",
      questions: QUESTIONS,
    },
  ]);
  gate.answerQuestion("t1", { "Which library?": "A" });
  expect(await result).toEqual({
    behavior: "allow",
    updatedInput: { questions: QUESTIONS, answers: { "Which library?": "A" } },
  });
  expect(events.at(-1)).toEqual({
    type: "agent.question.resolved",
    toolUseId: "t1",
    answered: true,
  });
});

test("empty answers dismiss the questions", async () => {
  const { gate, ask, events } = createGate();
  const result = ask("t1");
  gate.answerQuestion("t1", {});
  expect(await result).toMatchObject({
    behavior: "deny",
    message: expect.stringContaining("plain text"),
  });
  expect(events.at(-1)).toMatchObject({ type: "agent.question.resolved", answered: false });
});

test("malformed questions are denied without asking", async () => {
  const { ask, events } = createGate();
  expect(await ask("t1", undefined, [])).toMatchObject({ behavior: "deny" });
  expect(events).toEqual([]);
});

test("approvals and questions do not answer each other", async () => {
  const { gate, useTool, ask } = createGate();
  const approval = useTool("Bash", "t1");
  const question = ask("t2");
  gate.answerQuestion("t1", { x: "y" });
  gate.answerApproval("t2", "approve");
  gate.answerApproval("t1", "approve_all");
  expect(await approval).toMatchObject({ behavior: "allow" });
  expect(gate.pending.has("t2")).toBe(true);
  gate.rejectAll();
  expect(await question).toMatchObject({ behavior: "deny" });
});

test("abort and rejectAll dismiss pending questions and approvals", async () => {
  const { gate, useTool, ask } = createGate();
  const controller = new AbortController();
  const aborted = ask("t1", controller.signal);
  const dismissed = ask("t2");
  const rejected = useTool("Bash", "t3");
  controller.abort();
  gate.rejectAll();
  const results = await Promise.all([aborted, dismissed, rejected]);
  expect(results.map((r) => r?.behavior)).toEqual(["deny", "deny", "deny"]);
  expect(gate.pending.size).toBe(0);
});

test("answering a prompt removes its abort listener", async () => {
  const { gate } = createGate();
  const signal = new AbortController().signal;
  const removed: string[] = [];
  const original = signal.removeEventListener.bind(signal);
  signal.removeEventListener = ((...args: Parameters<typeof original>) => {
    removed.push(args[0]);
    return original(...args);
  }) as typeof original;
  const result = gate.canUseTool("Bash", { command: "ls" }, {
    toolUseID: "t1",
    signal,
  } as ToolOptions);
  gate.answerApproval("t1", "approve");
  await result;
  expect(removed).toEqual(["abort"]);
});
