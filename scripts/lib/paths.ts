import { resolve } from "node:path";

export const ROOT_DIR = resolve(import.meta.dir, "..", "..");
export const DIST_DIR = resolve(ROOT_DIR, "dist");
export const ENTRY_FILE = resolve(ROOT_DIR, "apps/cli/src/index.ts");
export const ROOT_MANIFEST = resolve(ROOT_DIR, "package.json");
export const PACKAGE_NAME = "@couralabs/claudin";
export const BIN_NAME = "claudin";
export const BUNDLE_FILE = `${BIN_NAME}.js`;
