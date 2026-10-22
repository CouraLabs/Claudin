import { ROOT_DIR } from "./paths";

export const createGithubRelease = async (version: string): Promise<void> => {
  const tag = `v${version}`;
  const { exitCode, stderr } =
    await Bun.$`gh release create ${tag} --title ${tag} --generate-notes`
      .cwd(ROOT_DIR)
      .nothrow()
      .quiet();
  if (exitCode !== 0) throw new Error(`gh release create failed: ${stderr.toString().trim()}`);
};
