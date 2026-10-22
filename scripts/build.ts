import { rm } from "node:fs/promises";
import { EXTERNAL_PACKAGES, writeDistManifest } from "./lib/distManifest";
import { BUNDLE_FILE, DIST_DIR, ENTRY_FILE, PACKAGE_NAME } from "./lib/paths";
import { readRootVersion } from "./lib/rootVersion";

export const buildApp = async (version: string): Promise<void> => {
  await rm(DIST_DIR, { recursive: true, force: true });
  const result = await Bun.build({
    entrypoints: [ENTRY_FILE],
    outdir: DIST_DIR,
    naming: BUNDLE_FILE,
    target: "bun",
    external: EXTERNAL_PACKAGES,
  });
  if (!result.success) throw new AggregateError(result.logs, "Bundle failed");
  await writeDistManifest(version);
};

if (import.meta.main) {
  const version = await readRootVersion();
  await buildApp(version);
  console.log(`Built ${PACKAGE_NAME}@${version} in ${DIST_DIR}`);
}
