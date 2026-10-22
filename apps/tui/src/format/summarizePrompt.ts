const SUMMARY_WORDS = 6;

export function summarizePrompt(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const head = words.slice(0, SUMMARY_WORDS).join(" ");
  return words.length > SUMMARY_WORDS ? `${head}…` : head;
}
