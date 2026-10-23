import type { CliRenderer, HostClipboardService, Selection } from "@opentui/core";
import type { PromptInput } from "../components/promptInput.ts";
import { readClipboardPaste } from "../prompt/clipboardPaste.ts";
import type { AppStore } from "../store/appStore.ts";
import { showToast } from "./toastActions.ts";

const UNAVAILABLE_NOTICE = "Clipboard unavailable, use your terminal's paste shortcut";
const COPIED_TOAST = "Copied to clipboard";
const COPY_FAILED_TOAST = "Could not copy to clipboard";

export async function pasteFromClipboard(
  store: AppStore,
  input: PromptInput,
  clipboard: HostClipboardService,
): Promise<void> {
  const content = await readClipboardPaste(clipboard);
  if (content) input.insertPasted(content);
  else showToast(store, UNAVAILABLE_NOTICE);
}

export async function copySelection(
  store: AppStore,
  renderer: CliRenderer,
  clipboard: HostClipboardService,
  selection: Selection,
): Promise<void> {
  const text = selection.getSelectedText();
  if (!text) return;
  const written = (await clipboard.writeText(text)).status === "written";
  const copied = written || renderer.copyToClipboardOSC52(text);
  showToast(store, copied ? COPIED_TOAST : COPY_FAILED_TOAST);
}
