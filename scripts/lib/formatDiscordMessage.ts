import type { ReleaseChanges } from "./collectReleaseChanges";
import { PACKAGE_NAME } from "./paths";

const DISCORD_MESSAGE_LIMIT = 2000;

const formatSection = (title: string, items: string[]): string[] =>
  items.length ? ["", `**${title}**`, ...items.map((item) => `• ${item}`)] : [];

export const formatDiscordMessage = (version: string, changes: ReleaseChanges): string => {
  const link = `https://www.npmjs.com/package/${PACKAGE_NAME}/v/${version}`;
  const lines = [
    `📦 **${PACKAGE_NAME}@${version}** published`,
    link,
    ...formatSection("✨ New features", changes.features),
    ...formatSection("🐛 Bug fixes", changes.fixes),
  ];
  return lines.join("\n").slice(0, DISCORD_MESSAGE_LIMIT);
};
