import type { ModelInfo } from "@anthropic-ai/claude-agent-sdk";

export const pickNextModel = (models: ModelInfo[], current?: string): string | undefined =>
  models[(models.findIndex((model) => model.value === current) + 1) % models.length]?.value;
