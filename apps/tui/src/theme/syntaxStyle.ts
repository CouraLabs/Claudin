import { type CliRenderer, SyntaxStyle } from "@opentui/core";
import { Theme } from "./colors.ts";
import { buildMutedSyntaxRules, buildSyntaxRules } from "./syntaxRules.ts";

export const createSyntaxStyle = (renderer: CliRenderer): SyntaxStyle =>
  SyntaxStyle.fromTheme(buildSyntaxRules(Theme), renderer.nativeScene);

export const createMutedSyntaxStyle = (renderer: CliRenderer): SyntaxStyle =>
  SyntaxStyle.fromTheme(buildMutedSyntaxRules(Theme), renderer.nativeScene);
