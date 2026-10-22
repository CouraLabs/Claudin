import { type BackgroundColor, TRANSPARENT_BACKGROUND } from "@claudin/events";
import { type RGBA, rgbToHex } from "@opentui/core";
import { tint, toBackgroundHex } from "./color.ts";
import type { ResolvedColors } from "./resolveTheme.ts";

export type Palette = {
  bg: { default: string; surface: string; header: string; highlight: string };
  fg: { primary: string; secondary: string; muted: string };
  border: { subtle: string; focus: string; separator: string };
  accent: { brand: string; highlight: string };
  status: { success: string; danger: string; warning: string; info: string };
  diff: { addedBg: string; removedBg: string };
};

const SECONDARY_TEXT_WEIGHT = 0.3;

const requireColor = (colors: ResolvedColors, key: string): RGBA => {
  const value = colors[key];
  if (!value) throw new Error(`Theme is missing color "${key}"`);
  return value;
};

export function buildPalette(
  colors: ResolvedColors,
  background: BackgroundColor = TRANSPARENT_BACKGROUND,
): Palette {
  const color = (key: string) => requireColor(colors, key);
  const hex = (key: string) => rgbToHex(color(key));
  return {
    bg: {
      default: toBackgroundHex(background),
      surface: hex("backgroundPanel"),
      header: toBackgroundHex(background),
      highlight: hex("backgroundElement"),
    },
    fg: {
      primary: hex("text"),
      secondary: rgbToHex(tint(color("text"), color("textMuted"), SECONDARY_TEXT_WEIGHT)),
      muted: hex("textMuted"),
    },
    border: { subtle: hex("borderSubtle"), focus: hex("borderActive"), separator: hex("border") },
    accent: { brand: hex("primary"), highlight: hex("accent") },
    status: {
      success: hex("success"),
      danger: hex("error"),
      warning: hex("warning"),
      info: hex("info"),
    },
    diff: { addedBg: hex("diffAddedBg"), removedBg: hex("diffRemovedBg") },
  };
}
