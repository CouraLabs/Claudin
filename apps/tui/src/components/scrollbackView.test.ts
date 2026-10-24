import { createSessionState, type SessionState, type TranscriptEntry } from "@kraude-kode/events";
import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, expect, test } from "vitest";
import { createSyntaxStyle } from "../theme/syntaxStyle.ts";
import { ScrollbackView } from "./scrollbackView.ts";

let destroy: (() => void) | undefined;

afterEach(() => destroy?.());

const userEntry = (id: string): TranscriptEntry => ({
  kind: "user",
  id,
  at: 0,
  text: `prompt ${id}`,
});
const noticeRun = (id: string): TranscriptEntry[] =>
  Array.from({ length: 6 }, (_, index) => ({
    kind: "notice",
    id: `${id}-${index}`,
    at: 0,
    text: `line ${id}-${index}`,
  }));

async function setupScrollback() {
  const setup = await createTestRenderer({ width: 60, height: 12 });
  destroy = () => setup.renderer.destroy();
  const syntaxStyle = createSyntaxStyle(setup.renderer);
  const scrollback = new ScrollbackView(setup.renderer, {
    syntaxStyle,
    mutedSyntaxStyle: syntaxStyle,
    hooks: { syntaxStyle, onDecision: () => {}, onToggle: () => {}, onSelectRow: () => {} },
  });
  setup.renderer.root.add(scrollback.renderable);
  const transcript = ["a", "b"].flatMap((id) => [userEntry(id), ...noticeRun(id)]);
  scrollback.update({ ...createSessionState("s"), transcript } as SessionState);
  await setup.renderOnce();
  return { scrollback, ...setup };
}

test("pins the last scrolled-past prompt and swaps at the next one", async () => {
  const { scrollback, renderOnce } = await setupScrollback();
  scrollback.renderable.scrollTo(0);
  await renderOnce();
  expect(scrollback.pinnedPrompt.renderable.visible).toBe(false);

  scrollback.renderable.scrollTo(4);
  await renderOnce();
  expect(scrollback.pinnedPrompt.renderable.visible).toBe(true);
  expect(scrollback.pinnedPrompt.shown?.id).toBe("a");

  scrollback.renderable.scrollTo(scrollback.renderable.scrollHeight);
  await renderOnce();
  expect(scrollback.pinnedPrompt.shown?.id).toBe("b");
});

test("pinned prompt is drawn on the first row", async () => {
  const { scrollback, renderOnce, captureCharFrame } = await setupScrollback();
  scrollback.renderable.scrollTo(4);
  await renderOnce();
  expect(captureCharFrame().split("\n")[0]).toContain("prompt a");
});
