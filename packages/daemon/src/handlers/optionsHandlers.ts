import { readOptions, saveBackground, saveTheme } from "../persistence/optionsFile.ts";
import type { RequestHandlers } from "../server/requestHandler.ts";

export const optionsHandlers: Pick<
  RequestHandlers,
  "options.load.requested" | "options.background.save.requested" | "options.theme.save.requested"
> = {
  async *"options.load.requested"({ optionsPath }) {
    const { background, theme } = await readOptions(optionsPath);
    yield { type: "options.loaded", background, theme };
  },
  async *"options.background.save.requested"({ optionsPath }, request) {
    await saveBackground(optionsPath, request.color);
    yield { type: "options.background.saved", color: request.color };
  },
  async *"options.theme.save.requested"({ optionsPath }, request) {
    await saveTheme(optionsPath, request.theme);
    yield { type: "options.theme.saved", theme: request.theme };
  },
};
