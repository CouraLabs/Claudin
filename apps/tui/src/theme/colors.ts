import {
  type BackgroundColor,
  DEFAULT_THEME_NAME,
  type ThemeName,
  TRANSPARENT_BACKGROUND,
} from "@claudin/events";
import { buildPalette, type Palette } from "./palette.ts";
import { resolveNamedTheme } from "./themeCatalog.ts";

export const Theme: Palette = buildPalette(resolveNamedTheme(DEFAULT_THEME_NAME));

export function applyTheme(
  name: ThemeName,
  background: BackgroundColor = TRANSPARENT_BACKGROUND,
): void {
  Object.assign(Theme, buildPalette(resolveNamedTheme(name), background));
}
