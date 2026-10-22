import { appendFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { AppEvent } from "./appEvent.ts";
import { matchSession } from "./sessionSearch.ts";
import { type SessionSummary, type StoredEvent, summarizeSession } from "./sessionSummary.ts";

export interface SessionStore {
  append(sessionId: string, event: AppEvent, at: number): Promise<void>;
  read(sessionId: string): Promise<StoredEvent[]>;
  list(): Promise<SessionSummary[]>;
  search(query: string): Promise<SessionSummary[]>;
  copy(sourceId: string, targetId: string): Promise<void>;
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
    const recent = (await this.listIds()).slice(0, LISTED_SESSIONS);
    const summaries = await Promise.all(
      recent.map(async (id) => summarizeSession(id, await this.read(id))),
    );
    return summaries.filter((summary) => summary.title !== "");
  }

  async search(query: string): Promise<SessionSummary[]> {
    const ids = await this.listIds();
    const matches = await Promise.all(
      ids.map(async (id) => matchSession(id, await this.read(id), query)),
    );
    return matches.filter((match) => match !== undefined).slice(0, LISTED_SESSIONS);
  }

  async copy(sourceId: string, targetId: string): Promise<void> {
    const source = Bun.file(this.pathFor(sourceId));
    if (await source.exists()) await Bun.write(this.pathFor(targetId), source);
  }

  async listIds(): Promise<string[]> {
    const names = await readdir(this.directory).catch(() => [] as string[]);
    return names
      .filter((name) => name.endsWith(FILE_SUFFIX))
      .map((name) => name.slice(0, -FILE_SUFFIX.length))
      .map((id) => ({ id, modified: Bun.file(this.pathFor(id)).lastModified }))
      .sort((a, b) => b.modified - a.modified)
      .map(({ id }) => id);
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
