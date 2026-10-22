import type { PromptContent } from "./sdkValue.ts";

type TextLike = { type: string; text?: string; content?: unknown };

export const MAX_OUTPUT_LENGTH = 20_000;

export function joinBlocks(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content === undefined ? "" : JSON.stringify(content);
  return (content as TextLike[])
    .map((block) => (block.type === "text" ? (block.text ?? "") : `[${block.type}]`))
    .join("\n");
}

export const readPromptText = (content: PromptContent): string => joinBlocks(content);

export const clipOutput = (text: string): string => text.slice(0, MAX_OUTPUT_LENGTH);
