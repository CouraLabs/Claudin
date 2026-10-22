import semver from "semver";
import { BIN_NAME, BUNDLE_FILE, DIST_DIR, PACKAGE_NAME, ROOT_DIR } from "./paths";

export const EXTERNAL_PACKAGES = ["@opentui/core", "@anthropic-ai/claude-agent-sdk"];

const WORKSPACE_GLOB = "{apps,packages}/*/package.json";

const higherRange = (first: string, second: string): string =>
  semver.gt(semver.minVersion(first) ?? "0.0.0", semver.minVersion(second) ?? "0.0.0")
    ? first
    : second;

const collectRanges = async (): Promise<Record<string, string>> => {
  const ranges: Record<string, string> = {};
  for await (const file of new Bun.Glob(WORKSPACE_GLOB).scan({ cwd: ROOT_DIR, absolute: true })) {
    const { dependencies = {} } = await Bun.file(file).json();
    for (const name of EXTERNAL_PACKAGES) {
      const range: string | undefined = dependencies[name];
      if (range) ranges[name] = ranges[name] ? higherRange(ranges[name], range) : range;
    }
  }
  return ranges;
};

export const writeDistManifest = async (version: string): Promise<void> => {
  const manifest = {
    name: PACKAGE_NAME,
    version,
    type: "module",
    bin: { [BIN_NAME]: BUNDLE_FILE },
    files: [BUNDLE_FILE],
    engines: { bun: ">=1.4.0" },
    publishConfig: { access: "public" },
    dependencies: await collectRanges(),
  };
  await Bun.write(`${DIST_DIR}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);
};
