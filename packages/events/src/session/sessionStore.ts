import { appendFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { AppEvent } from "./appEvent.ts";
import { type SessionSummary, type StoredEvent, summarizeSession } from "./sessionSummary.ts";

export interface SessionStore {
  append(sessionId: string, event: AppEvent, at: number): Promise<void>;
  read(sessionId: string): Promise<StoredEvent[]>;
  list(): Promise<SessionSummary[]>;
}

const LISTED_SESSIONS = 50;
const FILE_SUFFIX = ".jsonl";

export class FileSessionStore implements SessionStore {
  constructor(private directory: string) {}

  async append(sessionId: string, event: AppEvent, at: number): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const line = JSON.stringify({ timestamp: at, event });
    await appendFile(this.pathFor(sessionId), `${line}\n`);
  }

  async list(): Promise<SessionSummary[]> {
    const names = await readdir(this.directory).catch(() => [] as string[]);
    const ids = names.filter((name) => name.endsWith(FILE_SUFFIX)).map((n) => n.slice(0, -6));
    const recent = ids
      .map((id) => ({ id, modified: Bun.file(this.pathFor(id)).lastModified }))
      .sort((a, b) => b.modified - a.modified)
      .slice(0, LISTED_SESSIONS);
    const summaries = await Promise.all(
      recent.map(async ({ id }) => summarizeSession(id, await this.read(id))),
    );
    return summaries.filter((summary) => summary.title !== "");
  }

  async read(sessionId: string): Promise<StoredEvent[]> {
    const file = Bun.file(this.pathFor(sessionId));
    if (!(await file.exists())) return [];
    const lines = (await file.text()).split("\n").filter(Boolean);
    return lines.map((line) => JSON.parse(line) as StoredEvent);
  }

  pathFor(sessionId: string): string {
    return join(this.directory, `${sessionId}${FILE_SUFFIX}`);
  }
}
