import { expect, test } from "vitest";
import { buildImageBlock } from "./imageBlock.ts";
import { PasteAttachments } from "./pasteAttachments.ts";

const image = buildImageBlock("image/png", new Uint8Array([1, 2, 3]));

test("pasted text becomes a placeholder that expands on compose", () => {
  const attachments = new PasteAttachments();
  const placeholder = attachments.addText("a\nb\nc");
  expect(placeholder).toBe("[Pasted text #1 +3 lines]");
  expect(attachments.compose(`look: ${placeholder} $& done`).text).toBe("look: a\nb\nc $& done");
});

test("files expand to their path", () => {
  const attachments = new PasteAttachments();
  const placeholder = attachments.addFile("/work/app/src/index.ts");
  expect(placeholder).toBe("[File #1 index.ts]");
  expect(attachments.compose(placeholder).text).toBe("/work/app/src/index.ts");
});

test("images stay in the text and travel as blocks in order of appearance", () => {
  const attachments = new PasteAttachments();
  const first = attachments.addImage(image);
  const second = attachments.addImage(buildImageBlock("image/jpeg", new Uint8Array([9])));
  const draft = attachments.compose(`${second} then ${first}`);
  expect(draft.text).toBe("[Image #2] then [Image #1]");
  expect(draft.images.map((block) => block.source.media_type)).toEqual(["image/jpeg", "image/png"]);
});

test("deleted placeholders drop their attachments and reset restarts numbering", () => {
  const attachments = new PasteAttachments();
  attachments.addImage(image);
  expect(attachments.compose("no image here").images).toEqual([]);
  attachments.reset();
  expect(attachments.addText("x")).toBe("[Pasted text #1 +1 lines]");
});
