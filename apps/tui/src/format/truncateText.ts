export const truncateText = (text: string, maxLength: number): string => {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 1)}…` : singleLine;
};

export const clipLines = (text: string, maxLines: number): string => {
  const lines = text.trimEnd().split("\n");
  if (lines.length <= maxLines) return lines.join("\n");
  const hidden = lines.length - maxLines;
  return [...lines.slice(0, maxLines), `… ${hidden} more lines`].join("\n");
};
