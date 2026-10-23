export const CUSTOM_SERVER_NAME = "claudin";

export const BATCH_EDIT_BASE_NAME = "BatchEdit";

export const BATCH_EDIT_TOOL_NAME = `mcp__${CUSTOM_SERVER_NAME}__${BATCH_EDIT_BASE_NAME}`;

const CUSTOM_PREFIX = `mcp__${CUSTOM_SERVER_NAME}__`;

export const stripCustomPrefix = (toolName: string): string =>
  toolName.startsWith(CUSTOM_PREFIX) ? toolName.slice(CUSTOM_PREFIX.length) : toolName;
