import { DEFAULT_THEME_NAME, THEME_NAMES } from "@claudin/events";
import { rgbToHex } from "@opentui/core";
import { expect, test } from "vitest";
import { applyTheme, Theme } from "./colors.ts";
import { buildPalette } from "./palette.ts";
import { resolveThemeColors } from "./resolveTheme.ts";
import { resolveNamedTheme } from "./themeCatalog.ts";

test("every theme in the catalog builds a complete palette", () => {
  for (const name of THEME_NAMES) {
    expect(() => buildPalette(resolveNamedTheme(name)), name).not.toThrow();
  }
});

test("applying a theme swaps the live palette", () => {
  applyTheme("dracula");
  expect(Theme.bg.default).toBe(buildPalette(resolveNamedTheme("dracula")).bg.default);
  applyTheme(DEFAULT_THEME_NAME);
  expect(Theme.bg.default).toBe("#00000000");
});

test("resolves defs references and per mode colors", () => {
  const colors = resolveThemeColors(
    {
      defs: { base: "#102030" },
      theme: {
        text: "base",
        primary: { dark: "#ffffff", light: "#000000" },
        accent: "primary",
        thinkingOpacity: 0.6,
      },
    },
    "dark",
  );
  expect(rgbToHex(colors.text!)).toBe("#102030");
  expect(rgbToHex(colors.primary!)).toBe("#ffffff");
  expect(rgbToHex(colors.accent!)).toBe("#ffffff");
  expect(colors.thinkingOpacity).toBeUndefined();
});

test("rejects circular color references", () => {
  expect(() => resolveThemeColors({ theme: { a: "b", b: "a" } }, "dark")).toThrow(
    "Circular color reference",
  );
});
