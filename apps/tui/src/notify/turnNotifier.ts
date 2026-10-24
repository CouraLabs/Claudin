import type { AppEvent } from "@kraude-kode/events";
import type { CliRenderer } from "@opentui/core";
import { describeAlert } from "./describeAlert.ts";

const NOTIFICATION_TITLE = "KraudeKode";

function notifyMacDesktop(text: string): void {
  if (process.platform !== "darwin") return;
  const script = `display notification ${JSON.stringify(text)} with title "${NOTIFICATION_TITLE}"`;
  Bun.spawn(["osascript", "-e", script], { stdout: "ignore", stderr: "ignore" });
}

export class TurnNotifier {
  focused = true;

  constructor(private renderer: CliRenderer) {
    renderer.on("focus", () => {
      this.focused = true;
    });
    renderer.on("blur", () => {
      this.focused = false;
    });
  }

  notify(event: AppEvent): void {
    const text = describeAlert(event);
    if (!text || this.focused) return;
    if (!this.renderer.triggerNotification(text, NOTIFICATION_TITLE)) notifyMacDesktop(text);
  }
}
