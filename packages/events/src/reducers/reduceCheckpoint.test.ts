import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { expect, test } from "vitest";
import { createSessionState, type SessionState } from "../session/sessionState.ts";
import { listCheckpoints } from "./reduceCheckpoint.ts";
import { reduceSessionState } from "./reduceSessionState.ts";
import { listEditedFiles } from "./toolGroups.ts";

const prompt = (state: SessionState, content: string) =>
  reduceSessionState(state, { type: "agent.prompt.requested", agentSessionId: "a", content });

const echo = (state: SessionState, uuid: string, content: unknown) =>
  reduceSessionState(state, {
    type: "agent.message.received",
    message: { type: "user", uuid, parent_tool_use_id: null, message: { role: "user", content } },
  });

test("prompt echoes mark checkpoints on matching user entries in order", () => {
  const prompted = prompt(prompt(createSessionState("s"), "first"), "second");
  const marked = echo(echo(prompted, "u1", "first"), "u2", "second");
  expect(listCheckpoints(marked).map((entry) => [entry.text, entry.checkpointId])).toEqual([
    ["first", "u1"],
    ["second", "u2"],
  ]);
});

test("tool result echoes do not create checkpoints", () => {
  const prompted = prompt(createSessionState("s"), "first");
  const marked = echo(prompted, "u1", [{ type: "tool_result", tool_use_id: "t", content: "x" }]);
  expect(listCheckpoints(marked)).toEqual([]);
});

test("edited files come from completed write and edit calls", () => {
  const withCalls = reduceSessionState(createSessionState("s"), {
    type: "agent.message.received",
    message: {
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        id: "m",
        usage: { input_tokens: 1, output_tokens: 1 },
        content: [
          { type: "tool_use", id: "e1", name: "Edit", input: { file_path: "/a.ts" } },
          { type: "tool_use", id: "r1", name: "Read", input: { file_path: "/b.ts" } },
          { type: "tool_use", id: "w1", name: "Write", input: { file_path: "/c.ts" } },
        ],
      },
    } as unknown as SDKMessage,
  });
  const done = ["e1", "r1"].reduce(
    (state, id) =>
      reduceSessionState(state, {
        type: "agent.message.received",
        message: {
          type: "user",
          parent_tool_use_id: null,
          message: { content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] },
        },
      }),
    withCalls,
  );
  expect(listEditedFiles(done)).toEqual(["/a.ts"]);
});
