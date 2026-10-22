import { expect, test } from "vitest";
import { reduceSessionState } from "../reducers/reduceSessionState.ts";
import { isSharedEvent } from "./eventSharing.ts";
import { createSessionState } from "./sessionState.ts";
import { renderTranscriptMarkdown } from "./transcriptMarkdown.ts";

test("conversation events are shared while pickers and lookups stay private", () => {
  expect(isSharedEvent({ type: "agent.prompt.requested", agentSessionId: "a", content: "x" })).toBe(
    true,
  );
  expect(isSharedEvent({ type: "session.list.requested" })).toBe(false);
  expect(isSharedEvent({ type: "workspace.files.requested", query: "" })).toBe(false);
});

test("the markdown transcript lists prompts, notices and tool calls", () => {
  const state = reduceSessionState(
    reduceSessionState(createSessionState("s1"), {
      type: "agent.prompt.requested",
      agentSessionId: "a",
      content: "Add login",
    }),
    { type: "ui.notice.posted", text: "Model set" },
  );
  const markdown = renderTranscriptMarkdown(state);
  expect(markdown).toContain("- Session: s1");
  expect(markdown).toContain("## You\n\nAdd login");
  expect(markdown).toContain("> Model set");
});
