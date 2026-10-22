import { PACKAGE_NAME } from "./paths";

export const notifyDiscord = async (webhookUrl: string, version: string): Promise<void> => {
  const link = `https://www.npmjs.com/package/${PACKAGE_NAME}/v/${version}`;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: `📦 **${PACKAGE_NAME}@${version}** published\n${link}` }),
  });
  if (!response.ok) throw new Error(`Discord webhook failed: ${response.status}`);
};
