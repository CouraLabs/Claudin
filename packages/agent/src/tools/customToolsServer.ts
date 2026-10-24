import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { CUSTOM_SERVER_NAME } from "@kraude-kode/events";
import { batchEditTool } from "./batchEdit/batchEditTool.ts";

export const CUSTOM_MCP_SERVERS = {
  [CUSTOM_SERVER_NAME]: createSdkMcpServer({
    name: CUSTOM_SERVER_NAME,
    tools: [batchEditTool],
    alwaysLoad: true,
  }),
};
