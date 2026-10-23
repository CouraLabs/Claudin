import { ROOT_DIR } from "./paths";

export type ReleaseChanges = { features: string[]; fixes: string[] };

const FIX_PATTERN = /\b(fix|fixes|fixed|bug|bugs|hotfix)\b/i;
const IGNORED_PATTERN = /^bump version/i;
const FALLBACK_COMMIT_COUNT = 20;

const runText = async (command: ReturnType<typeof Bun.$>): Promise<string> =>
  (await command.cwd(ROOT_DIR).nothrow().quiet().text()).trim();

const findLatestTag = (): Promise<string> =>
  runText(Bun.$`gh release list --limit 1 --json tagName --jq ${".[0].tagName // empty"}`);

const listSubjectsSince = async (tag: string): Promise<string[]> => {
  const range = tag ? [`${tag}..HEAD`] : [`-${FALLBACK_COMMIT_COUNT}`];
  if (tag) await runText(Bun.$`git fetch origin tag ${tag} --no-tags --quiet`);
  const output = await runText(Bun.$`git log --no-merges --pretty=%s ${range}`);
  return output.split("\n").filter((subject) => subject && !IGNORED_PATTERN.test(subject));
};

export const collectReleaseChanges = async (): Promise<ReleaseChanges> => {
  const subjects = await listSubjectsSince(await findLatestTag());
  return {
    fixes: subjects.filter((subject) => FIX_PATTERN.test(subject)),
    features: subjects.filter((subject) => !FIX_PATTERN.test(subject)),
  };
};
