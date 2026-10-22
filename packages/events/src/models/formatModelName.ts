const CONTEXT_SUFFIX = /\[\w+\]$/;
const DATE_SUFFIX = /-\d{8}$/;
const NUMERIC_PART = /^\d+$/;

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

export function formatModelName(model: string): string {
  if (!model.startsWith("claude-")) return model || "default";
  const parts = model.replace(CONTEXT_SUFFIX, "").replace(DATE_SUFFIX, "").split("-").slice(1);
  const words = parts.filter((part) => !NUMERIC_PART.test(part)).map(capitalize);
  const version = parts.filter((part) => NUMERIC_PART.test(part)).join(".");
  return ["Claude", ...words, version].filter(Boolean).join(" ");
}
