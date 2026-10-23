import { expect, test } from "vitest";
import { createSessionState } from "../session/sessionState.ts";
import { dismissToast, postToast } from "./reduceToast.ts";

test("a posted toast replaces the previous one", () => {
  const first = postToast(createSessionState(""), { id: "a", text: "Copied" });
  const second = postToast(first, { id: "b", text: "Other" });
  expect(second.ui.toast).toEqual({ id: "b", text: "Other" });
});

test("only the matching toast id dismisses the toast", () => {
  const shown = postToast(createSessionState(""), { id: "b", text: "Other" });
  expect(dismissToast(shown, "a").ui.toast).not.toBeNull();
  expect(dismissToast(shown, "b").ui.toast).toBeNull();
});
