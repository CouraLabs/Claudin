import type { ThemeTokenStyle } from "@opentui/core";
import type { Palette } from "./palette.ts";

type RuleStyle = Omit<ThemeTokenStyle["style"], "foreground">;

const rule = (scope: string[], foreground: string, style: RuleStyle = {}): ThemeTokenStyle => ({
  scope,
  style: { foreground, ...style },
});

export const buildMutedSyntaxRules = (palette: Palette): ThemeTokenStyle[] =>
  buildSyntaxRules(palette).map(({ scope, style }) => ({
    scope,
    style: { ...style, foreground: palette.fg.muted },
  }));

export const buildSyntaxRules = ({ fg, status, syntax, markdown, diff, bg }: Palette): ThemeTokenStyle[] => [
  rule(["default"], fg.primary),
  rule(["comment", "comment.documentation"], syntax.comment, { italic: true }),
  rule(["string", "symbol", "character.special", "character"], syntax.string),
  rule(["number", "boolean", "constant", "float"], syntax.number),
  rule(["keyword.return", "keyword.conditional", "keyword.repeat", "keyword.coroutine"], syntax.keyword, {
    italic: true,
  }),
  rule(["keyword.type"], syntax.type, { bold: true, italic: true }),
  rule(["keyword.function", "function.method"], syntax.function),
  rule(["keyword"], syntax.keyword, { italic: true }),
  rule(
    ["keyword.import", "string.escape", "string.regexp", "tag.attribute", "keyword.export"],
    syntax.keyword,
  ),
  rule(
    ["operator", "keyword.operator", "punctuation.delimiter", "keyword.conditional.ternary"],
    syntax.operator,
  ),
  rule(
    ["variable", "variable.parameter", "function.method.call", "function.call", "property", "parameter", "field"],
    syntax.variable,
  ),
  rule(["variable.member", "function", "constructor"], syntax.function),
  rule(["type", "module", "class", "namespace"], syntax.type),
  rule(["type.definition"], syntax.type, { bold: true }),
  rule(["punctuation", "punctuation.bracket"], syntax.punctuation),
  rule(
    ["variable.builtin", "type.builtin", "function.builtin", "module.builtin", "constant.builtin", "variable.super"],
    status.danger,
  ),
  rule(["keyword.directive", "keyword.modifier", "keyword.exception"], syntax.keyword, { italic: true }),
  rule(["punctuation.special", "tag.delimiter"], syntax.operator),
  rule(
    ["markup.heading", "markup.heading.2", "markup.heading.3", "markup.heading.4", "markup.heading.5", "markup.heading.6"],
    markdown.heading,
    { bold: true },
  ),
  rule(["markup.heading.1"], markdown.heading, { bold: true, underline: true }),
  rule(["markup.bold", "markup.strong"], markdown.strong, { bold: true }),
  rule(["markup.italic"], markdown.emphasis, { italic: true }),
  rule(["markup.list"], markdown.listItem),
  rule(["markup.quote"], markdown.blockQuote, { italic: true }),
  rule(["markup.raw", "markup.raw.block"], markdown.code),
  rule(["markup.raw.inline"], markdown.code, { background: bg.surface }),
  rule(["markup.link", "markup.link.url", "string.special", "string.special.url"], markdown.link, {
    underline: true,
  }),
  rule(["markup.link.label"], markdown.linkText, { underline: true }),
  rule(["label"], markdown.linkText),
  rule(["spell", "nospell"], fg.primary),
  rule(["markup.underline"], fg.primary, { underline: true }),
  rule(["comment.error"], status.danger, { italic: true, bold: true }),
  rule(["comment.warning"], status.warning, { italic: true, bold: true }),
  rule(["comment.todo", "comment.note"], status.info, { italic: true, bold: true }),
  rule(["attribute", "annotation"], status.warning),
  rule(["tag"], status.danger),
  rule(["markup.strikethrough", "markup.list.unchecked", "debug"], fg.muted),
  rule(["markup.list.checked"], status.success),
  rule(["diff.plus"], diff.addedText, { background: diff.addedBg }),
  rule(["diff.minus"], diff.removedText, { background: diff.removedBg }),
  rule(["diff.delta"], diff.contextText, { background: diff.contextBg }),
  rule(["error"], status.danger, { bold: true }),
  rule(["warning"], status.warning, { bold: true }),
  rule(["info"], status.info),
];
