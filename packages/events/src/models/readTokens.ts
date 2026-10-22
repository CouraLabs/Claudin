import type { TokenUsage } from "../session/transcriptTypes.ts";

export type UsageFields = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export const readTokens = (usage: UsageFields, previous: TokenUsage): TokenUsage => ({
  ...previous,
  input: usage.input_tokens ?? previous.input,
  output: usage.output_tokens ?? previous.output,
  cacheRead: usage.cache_read_input_tokens ?? previous.cacheRead,
  cacheWrite: usage.cache_creation_input_tokens ?? previous.cacheWrite,
});

export const countContextTokens = (tokens: TokenUsage): number =>
  tokens.input + tokens.cacheRead + tokens.cacheWrite + tokens.output;

export const readCacheHitPercent = ({ input, cacheRead, cacheWrite }: TokenUsage): number => {
  const prompt = input + cacheRead + cacheWrite;
  return prompt > 0 ? Math.round((cacheRead / prompt) * 100) : 0;
};
