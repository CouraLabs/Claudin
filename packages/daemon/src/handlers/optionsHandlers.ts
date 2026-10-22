import { readOptions, saveBackground } from "../persistence/optionsFile.ts";
import type { RequestHandlers } from "../server/requestHandler.ts";

export const optionsHandlers: Pick<
  RequestHandlers,
  "options.load.requested" | "options.background.save.requested"
> = {
  async *"options.load.requested"({ optionsPath }) {
    const { background } = await readOptions(optionsPath);
    yield { type: "options.loaded", background };
  },
  async *"options.background.save.requested"({ optionsPath }, request) {
    await saveBackground(optionsPath, request.color);
    yield { type: "options.background.saved", color: request.color };
  },
};
