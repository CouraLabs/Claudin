import { type PromptContent, readPromptText } from "@claudin/events";
import { SEPARATOR } from "./glyphs.ts";
import { truncateText } from "./truncateText.ts";

export const MAX_QUEUE_ROWS = 5;

const QUEUE_TEXT_LENGTH = 80;

export const buildQueueRows = (queued: PromptContent[]): string[] =>
  queued
    .slice(0, MAX_QUEUE_ROWS)
    .map(
      (content, index) =>
        `${index + 1}. ${truncateText(readPromptText(content), QUEUE_TEXT_LENGTH)}`,
    );

export const buildQueueHeader = (queued: PromptContent[]): string =>
  `Queued${SEPARATOR}${queued.length} waiting`;

export const countHiddenQueued = (queued: PromptContent[]): number =>
  Math.max(queued.length - MAX_QUEUE_ROWS, 0);
