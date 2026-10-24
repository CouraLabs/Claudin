import type { SessionState } from "../session/sessionState.ts";
import { formatModelName } from "./formatModelName.ts";

export function readModelLabel({ model, models }: Pick<SessionState, "model" | "models">): string {
  const row = models.find((candidate) => candidate.value === model);
  return formatModelName(row?.resolvedModel ?? model);
}
