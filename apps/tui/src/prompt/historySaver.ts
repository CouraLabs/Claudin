import { queuePromptHistory } from "@kraude-kode/events";
import { writeHistoryFile } from "./historyFile.ts";

const SAVE_DELAY_MS = 400;

export class HistorySaver {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: string[] | undefined;

  constructor(
    private readonly path: string,
    private readonly delayMs = SAVE_DELAY_MS,
  ) {}

  schedule(entries: string[], draft: string): void {
    this.pending = queuePromptHistory(entries, draft.trim());
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
  }

  async flush(): Promise<void> {
    clearTimeout(this.timer);
    const entries = this.pending;
    this.pending = undefined;
    if (entries) await writeHistoryFile(this.path, entries).catch(() => undefined);
  }
}
