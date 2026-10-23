import type { HostClipboardService } from "@opentui/core";
import type { PastedContent } from "./planPaste.ts";

const PREFERRED_TYPES = ["image/png", "text/plain"] as const;

export async function readClipboardPaste(
  clipboard: HostClipboardService,
): Promise<PastedContent | undefined> {
  const result = await clipboard.read({ preferredTypes: PREFERRED_TYPES });
  if (result.status !== "read") return undefined;
  const { mimeType, bytes } = result.representation;
  if (bytes.length === 0) return undefined;
  return { bytes, metadata: { mimeType, kind: mimeType.startsWith("text/") ? "text" : "binary" } };
}
