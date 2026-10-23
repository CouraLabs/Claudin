---
description: Build claudin, publish it to npm, create the GitHub release, announce the version on Discord and commit and push the version bump
argument-hint: "[patch|minor|major] [--dry-run]"
allowed-tools: Bash(bun scripts/promotion.ts:*), Bash(git status:*), Bash(git diff:*), Bash(git add package.json), Bash(git commit:*), Bash(git push:*), Bash(gh release:*)
---

Publish a new claudin version.

1. Run `git status --short` and tell me if there are uncommitted changes before publishing.
2. Run `bun scripts/promotion.ts $ARGUMENTS` (the bump defaults to `patch`; add `--dry-run` to skip publishing, the GitHub release and Discord).
3. The script builds `dist/` with `scripts/build.ts`, publishes it with `bun publish` using `NPM_TOKEN`, bumps `version` in the root `package.json`, creates the `v<version>` GitHub release with `gh release create --generate-notes` (requires `gh` authenticated), then posts to the `PICOBU_DISCORD_WEBHOOK_URL` Discord webhook. The Discord message lists new features and bug fixes, taken from the commit subjects since the previous GitHub release (subjects mentioning fix/bug are bug fixes, the rest are features).
4. Unless `--dry-run` was passed, commit and push the version bump: run `git add package.json`, then `git commit -m "Bump version to <version>"` followed by the commit attribution lines, then `git push`. Stage only `package.json`; leave any other uncommitted changes alone. If the commit or push fails, report the exact error and do not force-push.
5. Report the published version, or the exact error if any step failed. Do not retry a failed publish without asking me.
