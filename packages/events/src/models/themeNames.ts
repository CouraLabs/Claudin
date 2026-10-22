import { z } from "zod";

export const THEME_NAMES = [
  "aura",
  "ayu",
  "carbonfox",
  "catppuccin",
  "catppuccin-frappe",
  "catppuccin-macchiato",
  "cobalt2",
  "cursor",
  "dracula",
  "everforest",
  "flexoki",
  "github",
  "gruvbox",
  "kanagawa",
  "lucent-orng",
  "material",
  "matrix",
  "mercury",
  "monokai",
  "nightowl",
  "nord",
  "one-dark",
  "orng",
  "osaka-jade",
  "palenight",
  "rosepine",
  "solarized",
  "synthwave84",
  "tokyonight",
  "vercel",
  "vesper",
  "zenburn",
] as const;

export const themeNameSchema = z.enum(THEME_NAMES);

export type ThemeName = z.infer<typeof themeNameSchema>;

export const DEFAULT_THEME_NAME: ThemeName = "vesper";
