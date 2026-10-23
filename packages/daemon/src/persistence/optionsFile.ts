import { homedir } from "node:os";
import { join } from "node:path";
import {
  type BackgroundColor,
  type OptionsFile,
  optionsFileSchema,
  type ThemeName,
} from "@claudin/events";

export const OPTIONS_PATH = join(homedir(), ".claudin", "options.json");

export async function readOptions(path: string): Promise<OptionsFile> {
  const stored = await Bun.file(path)
    .json()
    .catch(() => ({}));
  const parsed = optionsFileSchema.safeParse(stored);
  return parsed.success ? parsed.data : {};
}

const saveOption = async (path: string, option: OptionsFile): Promise<void> => {
  await Bun.write(path, JSON.stringify({ ...(await readOptions(path)), ...option }, null, 2));
};

export const saveBackground = (path: string, background: BackgroundColor): Promise<void> =>
  saveOption(path, { background });

export const saveTheme = (path: string, theme: ThemeName): Promise<void> =>
  saveOption(path, { theme });
