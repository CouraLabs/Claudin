import { buildApp } from "./build";
import { collectReleaseChanges } from "./lib/collectReleaseChanges";
import { createGithubRelease } from "./lib/createGithubRelease";
import { nextVersion, parseBump } from "./lib/nextVersion";
import { notifyDiscord } from "./lib/notifyDiscord";
import { DIST_DIR, PACKAGE_NAME } from "./lib/paths";
import { readRootVersion, writeRootVersion } from "./lib/rootVersion";

const NPMRC_CONTENT = "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
};

const publishDist = async (dryRun: boolean): Promise<void> => {
  await Bun.write(`${DIST_DIR}/.npmrc`, NPMRC_CONTENT);
  const flags = dryRun ? ["--dry-run"] : [];
  const { exitCode } = await Bun.$`bun publish --access public ${flags}`.cwd(DIST_DIR).nothrow();
  if (exitCode !== 0) throw new Error(`bun publish exited with ${exitCode}`);
};

const args = process.argv.slice(2);
const bumpInput = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");

requireEnv("NPM_TOKEN");
const webhookUrl = requireEnv("PICOBU_DISCORD_WEBHOOK_URL");
const version = nextVersion(await readRootVersion(), parseBump(bumpInput));

const changes = await collectReleaseChanges();

await buildApp(version);
await publishDist(dryRun);

if (dryRun) {
  console.log(`Dry run complete for ${PACKAGE_NAME}@${version}`);
} else {
  await writeRootVersion(version);
  await createGithubRelease(version);
  await notifyDiscord(webhookUrl, version, changes);
  console.log(`Published ${PACKAGE_NAME}@${version}`);
}
