import { homedir } from "node:os";
import { join } from "node:path";
import { type BackgroundColor, type OptionsFile, optionsFileSchema } from "@claudin/events";

export const OPTIONS_PATH = join(homedir(), ".claudin", "options.json");

export async function readOptions(path: string): Promise<OptionsFile> {
  const stored = await Bun.file(path)
    .json()
    .catch(() => ({}));
  const parsed = optionsFileSchema.safeParse(stored);
  return parsed.success ? parsed.data : {};
}

export async function saveBackground(path: string, background: BackgroundColor): Promise<void> {
  await Bun.write(path, JSON.stringify({ ...(await readOptions(path)), background }, null, 2));
}
