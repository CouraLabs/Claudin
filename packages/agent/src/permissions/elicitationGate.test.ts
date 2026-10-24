import type { ElicitationRequest, ElicitationResult } from "@anthropic-ai/claude-agent-sdk";
import type { ResponseEvent } from "@kraude-kode/events";
import { expect, test } from "vitest";
import { ElicitationGate } from "./elicitationGate.ts";

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", title: "Name" },
    age: { type: "integer", title: "Age" },
    admin: { type: "boolean", title: "Admin" },
    color: {
      type: "string",
      oneOf: [
        { const: "r", title: "Red" },
        { const: "b", title: "Blue" },
      ],
    },
    tags: { type: "array", items: { enum: ["a", "b", "c"] } },
  },
};

function createFixture() {
  const events: ResponseEvent[] = [];
  const opened: string[] = [];
  const gate = new ElicitationGate("agent", async (url) => opened.push(url));
  gate.listen((event) => events.push(event));
  const ask = (request: Partial<ElicitationRequest>): Promise<ElicitResultLike> =>
    gate.handle(
      { serverName: "docs", message: "Please", ...request },
      { signal: new AbortController().signal, requestId: "r1" },
    ) as Promise<ElicitResultLike>;
  return { gate, events, opened, ask };
}

type ElicitResultLike = ElicitationResult;

const requiredQuestions = (events: ResponseEvent[]) =>
  events.flatMap((event) => (event.type === "agent.question.required" ? event.questions : []));

test("a form elicitation becomes questions and coerces the answers", async () => {
  const { gate, events, ask } = createFixture();
  const pending = ask({ mode: "form", requestedSchema: SCHEMA });
  const questions = requiredQuestions(events);
  expect(questions).toHaveLength(5);
  const text = (index: number) => questions[index]?.question ?? "";
  gate.answer("elicitation:r1", {
    [text(0)]: "Ada",
    [text(1)]: "36",
    [text(2)]: "Yes",
    [text(3)]: "Blue",
    [text(4)]: "a, c",
  });
  expect(await pending).toEqual({
    action: "accept",
    content: { name: "Ada", age: 36, admin: true, color: "b", tags: ["a", "c"] },
  });
  expect(events.at(-1)).toEqual({
    type: "agent.question.resolved",
    toolUseId: "elicitation:r1",
    answered: true,
  });
});

test("skipped fields are left out and a dismissal declines", async () => {
  const { gate, events, ask } = createFixture();
  const pending = ask({ mode: "form", requestedSchema: SCHEMA });
  const first = requiredQuestions(events)[0]?.question ?? "";
  gate.answer("elicitation:r1", { [first]: "Skip" });
  expect(await pending).toEqual({ action: "accept", content: {} });
  const dismissed = ask({ mode: "form", requestedSchema: SCHEMA });
  gate.answer("elicitation:r1", {});
  expect(await dismissed).toEqual({ action: "decline" });
});

test("a url elicitation opens the browser only when accepted", async () => {
  const { gate, events, opened, ask } = createFixture();
  const pending = ask({ mode: "url", url: "https://login.example/start" });
  const [question] = requiredQuestions(events);
  expect(question?.question).toContain("https://login.example/start");
  gate.answer("elicitation:r1", { [question?.question ?? ""]: "Open in browser" });
  expect(await pending).toEqual({ action: "accept" });
  expect(opened).toEqual(["https://login.example/start"]);
  const declined = ask({ mode: "url", url: "https://login.example/start" });
  gate.answer("elicitation:r1", { x: "Decline" });
  expect(await declined).toEqual({ action: "decline" });
  expect(opened).toHaveLength(1);
});

test("a url elicitation with an unsafe scheme is declined without asking", async () => {
  const { events, ask } = createFixture();
  expect(await ask({ mode: "url", url: "file:///etc/passwd" })).toEqual({ action: "decline" });
  expect(events).toHaveLength(0);
});

test("server text has control characters stripped", async () => {
  const { events, ask } = createFixture();
  void ask({ mode: "form", message: "hi\u001b[2Jthere", requestedSchema: {} });
  expect(requiredQuestions(events)[0]?.question).toBe("hi [2Jthere");
});

test("an aborted elicitation is declined and resolved", async () => {
  const { gate, events } = createFixture();
  const controller = new AbortController();
  const pending = gate.handle(
    { serverName: "docs", message: "Please", mode: "form" },
    { signal: controller.signal, requestId: "r2" },
  );
  controller.abort();
  expect(await pending).toEqual({ action: "decline" });
  expect(events.at(-1)).toMatchObject({ type: "agent.question.resolved", answered: false });
});
