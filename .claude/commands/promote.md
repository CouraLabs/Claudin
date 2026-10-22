---
description: Build claudin, publish it to npm and announce the version on Discord
argument-hint: "[patch|minor|major] [--dry-run]"
allowed-tools: Bash(bun scripts/promotion.ts:*), Bash(git status:*), Bash(git diff:*)
---

Publish a new claudin version.

1. Run `git status --short` and tell me if there are uncommitted changes before publishing.
2. Run `bun scripts/promotion.ts $ARGUMENTS` (the bump defaults to `patch`; add `--dry-run` to skip publishing and Discord).
3. The script builds `dist/` with `scripts/build.ts`, publishes it with `bun publish` using `NPM_TOKEN`, bumps `version` in the root `package.json`, then posts to the `PICOBU_DISCORD_WEBHOOK_URL` Discord webhook.
4. Report the published version, or the exact error if any step failed. Do not retry a failed publish without asking me.
