import { RGBA } from "@opentui/core";

export type ThemeMode = "dark" | "light";

export type ColorValue = string | { dark: ColorValue; light: ColorValue };

export type ThemeSource = {
  defs?: Record<string, ColorValue>;
  theme: Record<string, ColorValue | number>;
};

export type ResolvedColors = Record<string, RGBA>;

export function resolveThemeColors(source: ThemeSource, mode: ThemeMode): ResolvedColors {
  const defs = source.defs ?? {};

  const resolveValue = (value: ColorValue, chain: string[]): RGBA => {
    if (typeof value !== "string") return resolveValue(value[mode], chain);
    if (value === "transparent" || value === "none") return RGBA.fromInts(0, 0, 0, 0);
    if (value.startsWith("#")) return RGBA.fromHex(value);
    if (chain.includes(value)) {
      throw new Error(`Circular color reference: ${[...chain, value].join(" -> ")}`);
    }
    const next = defs[value] ?? source.theme[value];
    if (next === undefined || typeof next === "number") {
      throw new Error(`Color reference "${value}" not found in defs or theme`);
    }
    return resolveValue(next, [...chain, value]);
  };

  return Object.fromEntries(
    Object.entries(source.theme)
      .filter((entry): entry is [string, ColorValue] => typeof entry[1] !== "number")
      .map(([key, value]) => [key, resolveValue(value, [])]),
  );
}
