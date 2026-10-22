import { ROOT_MANIFEST } from "./paths";

export const readRootVersion = async (): Promise<string> =>
  (await Bun.file(ROOT_MANIFEST).json()).version;

export const writeRootVersion = async (version: string): Promise<void> => {
  const manifest = await Bun.file(ROOT_MANIFEST).json();
  await Bun.write(ROOT_MANIFEST, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
};
