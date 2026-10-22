import type { ToolCall } from "@claudin/events";
import { truncateText } from "./truncateText.ts";

const VALUE_LENGTH = 200;

const formatInputValue = (value: unknown): string =>
  truncateText(typeof value === "string" ? value : JSON.stringify(value), VALUE_LENGTH);

export const formatToolInput = ({ input }: ToolCall): string =>
  Object.entries(input)
    .map(([key, value]) => `${key}: ${formatInputValue(value)}`)
    .join("\n");
