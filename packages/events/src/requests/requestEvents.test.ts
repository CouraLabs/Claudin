import { expect, test } from "vitest";
import { requestEventSchema } from "./requestEvents.ts";

test("parses agent and session requests", () => {
  expect(requestEventSchema.parse({ type: "session.create.requested" }).type).toBe(
    "session.create.requested",
  );
  expect(
    requestEventSchema.parse({
      type: "agent.prompt.steer.requested",
      agentSessionId: "a",
      content: "hi",
    }),
  ).toMatchObject({ content: "hi" });
});

test("parses model list and session restore requests", () => {
  expect(requestEventSchema.parse({ type: "agent.models.requested", agentSessionId: "a" })).toEqual(
    { type: "agent.models.requested", agentSessionId: "a" },
  );
  expect(requestEventSchema.parse({ type: "session.restore.requested", sessionId: "s" })).toEqual({
    type: "session.restore.requested",
    sessionId: "s",
  });
  expect(() => requestEventSchema.parse({ type: "agent.models.requested" })).toThrow();
});

test("rejects unknown request types", () => {
  expect(() => requestEventSchema.parse({ type: "nope" })).toThrow();
});
