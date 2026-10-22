const FILETYPES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  md: "markdown",
};

export const detectFiletype = (path: string): string | undefined =>
  FILETYPES[path.split(".").pop() ?? ""];
