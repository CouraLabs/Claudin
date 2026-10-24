import { tool } from "@anthropic-ai/claude-agent-sdk";
import { BATCH_EDIT_BASE_NAME } from "@kraude-kode/events";
import { batchEditShape } from "./batchEditSchema.ts";
import { runBatchEdit } from "./runBatchEdit.ts";

const DESCRIPTION = `Apply many exact-string edits across one or more files in a single call. Each edit works like Edit (file_path, old_string, new_string, replace_all). Edits run in order, and edits to the same file build on each other. The batch is all-or-nothing: if any edit fails validation, no file is changed.`;

export const batchEditTool = tool(
  BATCH_EDIT_BASE_NAME,
  DESCRIPTION,
  batchEditShape,
  async ({ edits }) => {
    const { isError, text } = await runBatchEdit(edits);
    return { isError, content: [{ type: "text", text }] };
  },
);
