import { BATCH_EDIT_TOOL_NAME, listBatchEditPaths, type ToolCall } from "@claudin/events";
import { truncateText } from "./truncateText.ts";

const VALUE_LENGTH = 200;

const formatInputValue = (value: unknown): string =>
  truncateText(typeof value === "string" ? value : JSON.stringify(value), VALUE_LENGTH);

const formatBatchEdit = ({ input }: ToolCall): string =>
  listBatchEditPaths(input)
    .map((path, index) => `${index + 1}. ${formatInputValue(path)}`)
    .join("\n");

export const formatToolInput = (call: ToolCall): string =>
  call.name === BATCH_EDIT_TOOL_NAME
    ? formatBatchEdit(call)
    : Object.entries(call.input)
        .map(([key, value]) => `${key}: ${formatInputValue(value)}`)
        .join("\n");
