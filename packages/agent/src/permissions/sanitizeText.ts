const isControlCode = (code: number): boolean => code < 32 || (code >= 127 && code <= 159);

export const sanitizeText = (text: unknown): string =>
  [...String(text ?? "")].map((char) => (isControlCode(char.charCodeAt(0)) ? " " : char)).join("");
