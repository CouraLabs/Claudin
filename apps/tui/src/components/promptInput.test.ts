import { rgbToHex } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, expect, test } from "vitest";
import { Theme } from "../theme/colors.ts";
import { PromptInput } from "./promptInput.ts";

let destroy: (() => void) | undefined;

afterEach(() => destroy?.());

async function setupPrompt() {
  const setup = await createTestRenderer({ width: 80, height: 10 });
  destroy = () => setup.renderer.destroy();
  const prompt = new PromptInput(setup.renderer, { onSubmit: () => {}, onChange: () => {} });
  setup.renderer.root.add(prompt.renderable);
  prompt.setFocused(true);
  return { prompt, ...setup };
}

test("backspace removes a whole attachment placeholder", async () => {
  const { prompt, mockInput, renderOnce } = await setupPrompt();
  await mockInput.typeText("see ");
  prompt.textarea.insertText(prompt.attachments.addText("a\nb\nc\nd\ne\nf"));
  await renderOnce();
  expect(prompt.text).toBe("see [Pasted text #1 +6 lines]");
  mockInput.pressBackspace();
  expect(prompt.text).toBe("see ");
});

test("attachment placeholders are highlighted", async () => {
  const { prompt, renderOnce } = await setupPrompt();
  prompt.textarea.insertText(
    prompt.attachments.addImage({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "" },
    }),
  );
  await renderOnce();
  expect(prompt.textarea.extmarks.getVirtual()).toHaveLength(1);
});

test("only the placeholder gets the accent color", async () => {
  const { prompt, renderOnce, captureSpans } = await setupPrompt();
  prompt.textarea.insertText(`plain ${prompt.attachments.addText("a\nb\nc\nd\ne\nf")}`);
  await renderOnce();
  await renderOnce();
  const spans = captureSpans().lines[1]?.spans ?? [];
  const colored = spans.filter((span) => rgbToHex(span.fg) === Theme.accent.highlight);
  expect(colored.map((span) => span.text)).toEqual(["[Pasted text #1 +6 lines]"]);
});
