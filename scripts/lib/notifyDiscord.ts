import type { ReleaseChanges } from "./collectReleaseChanges";
import { formatDiscordMessage } from "./formatDiscordMessage";

export const notifyDiscord = async (
  webhookUrl: string,
  version: string,
  changes: ReleaseChanges,
): Promise<void> => {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: formatDiscordMessage(version, changes) }),
  });
  if (!response.ok) throw new Error(`Discord webhook failed: ${response.status}`);
};
