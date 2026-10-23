import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { decodePasteBytes, type PasteEvent } from "@opentui/core";
import { buildImageBlock, type ImageMediaType, readImageMediaType } from "./imageBlock.ts";
import type { PasteAttachments } from "./pasteAttachments.ts";
import { parsePastedPaths } from "./pastedPaths.ts";

const LONG_PASTE_LINES = 5;
const LONG_PASTE_CHARS = 500;

const IMAGE_TYPES: Record<string, ImageMediaType> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const isLongPaste = (text: string): boolean =>
  text.length > LONG_PASTE_CHARS || text.split("\n").length > LONG_PASTE_LINES;

function attachPath(path: string, attachments: PasteAttachments): string {
  const mediaType = IMAGE_TYPES[extname(path).toLowerCase()];
  if (!mediaType) return attachments.addFile(path);
  return attachments.addImage(buildImageBlock(mediaType, readFileSync(path)));
}

export type PastedContent = Pick<PasteEvent, "bytes" | "metadata">;

export function planPaste(event: PastedContent, attachments: PasteAttachments): string | undefined {
  const mediaType = readImageMediaType(event.metadata?.mimeType);
  if (mediaType) {
    return attachments.addImage(buildImageBlock(mediaType, event.bytes));
  }
  if (event.metadata?.kind === "binary") return undefined;
  const text = decodePasteBytes(event.bytes);
  const paths = parsePastedPaths(text);
  if (paths.length > 0) return paths.map((path) => attachPath(path, attachments)).join(" ");
  return isLongPaste(text) ? attachments.addText(text) : undefined;
}
