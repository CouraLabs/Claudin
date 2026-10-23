# Claudin

A terminal UI for Claude, built on the Claude Agent SDK.

A local daemon owns the agent session. The TUI connects to it over WebSocket, so a session keeps running when the UI closes, and other terminals can attach to it.

The agent uses an ADHD-shaped system prompt: replies lead with the next action, use numbered steps, and end with one concrete action. See `packages/agent/src/profile/adhdSystemPrompt.ts`.

## Requirements

- Bun 1.4.3 (pinned in `package.json`)
- Claude access for the Claude Agent SDK. The app does not read an API key itself; the SDK handles authentication.

## Install

```bash
bun add -g @couralabs/claudin
claudin
```

Requires Bun 1.4.0 or newer.

## Quick start

```bash
bun install
bun run dev
```

This starts the daemon on port `7777` and opens the TUI in the same terminal.

## Commands

| Command | What it does |
| --- | --- |
| `claudin` | Start the daemon and the TUI together |
| `claudin --session <id>` | Resume a stored session |
| `claudin daemon` | Run the daemon only, with no UI |
| `claudin attach` | Attach a TUI to a running daemon's live session |
| `claudin replay <sessionId>` | Replay a stored session, read-only (`--speed <factor>`) |

Options: `-p, --port <port>` sets the daemon port (default `7777`).

From source, run any command with `bun apps/cli/src/index.ts <command>`. For example: `bun apps/cli/src/index.ts daemon`.

## Slash commands

Type these in the TUI prompt.

**Session**
- `/clear`: start a fresh session
- `/session`: switch to a previous session
- `/fork`: branch this conversation into a new session
- `/search <text>`: search past sessions
- `/export [path]`: export the transcript as markdown

**Files and code**
- `/diffs`: review git changes, or this session's edits when there are none
- `/rewind`: restore edited files to before an earlier prompt
- `/cd <path>`: change directory and start a fresh session there

**Agent settings**
- `/model [name]`: pick a model, or set one directly
- `/effort [level]`: show or set reasoning effort
- `/permission [mode]`: show or set the permission mode
- `/mcp`: list MCP servers. Also `/mcp login <name>` and `/mcp callback <name> <url>`

**Appearance**
- `/theme [name]`: show a theme picker, or switch themes
- `/theme-background`: pick the background color with RGBA sliders

**Exit**
- `/quit` (aliases: `/exit`, `/q`, `/leave`)

## Keys

- `Shift+Tab`: open the model picker
- `Enter` while the agent is busy: steer the running turn with the prompt
- `Ctrl+Q`: queue a prompt while the agent is busy; queued prompts send one per idle turn
- `Esc` twice: interrupt a busy turn
- `Shift+Up` / `Shift+Down`: recall earlier prompts for this directory
- `Ctrl+R`: search prompt history
- `Ctrl+V`: paste clipboard text
- `Ctrl+C` twice: exit

## Where data lives

All paths are under your home directory.

- `~/.claudin/sessions/`: stored sessions
- `~/.claudin/prompts/`: prompt history, kept per directory
- `~/.claudin/options.json`: saved options
- `~/.claudin/rate-limits.json`: cached rate-limit data

## Project layout

- `apps/cli`: entry point. Wires the daemon and the TUI together.
- `apps/tui`: terminal renderer, input handling, and themes.
- `packages/daemon`: WebSocket server, request handlers, persistence, and workspace access.
- `packages/agent`: Agent SDK runtime, system prompt, subagents, permissions, and MCP login.
- `packages/events`: event schemas, session state, and reducers. Shared by all packages.
- `scripts`: build and release scripts.

Every request and response passes as an event defined in `packages/events`.

## Development

```bash
bun run dev          # run the app with watch mode
bun run test         # run tests across all packages (Vitest)
bun check            # type check
bun run lint         # lint with Biome
bun run format       # format with Biome
bun run build:app    # bundle to dist/claudin.js
```

## Release

```bash
bun run promote [patch|minor|major] [--dry-run]
```

Defaults to `patch`. Builds the bundle, publishes `@couralabs/claudin` to npm, bumps the root version, creates a GitHub release, and posts the changes to Discord.

Required environment variables:
- `NPM_TOKEN`
- `PICOBU_DISCORD_WEBHOOK_URL`

With `--dry-run`, the build and `bun publish --dry-run` still run. The version bump, GitHub release, and Discord post are skipped.

## Conventions

Project rules live in `CLAUDE.md`. The main ones:
- No code comments.
- Method, variable, and property names say what they do in four words or fewer.
- Components stay small and focused.

## Agent docs

- `docs/agents/issue-tracker.md`: how issues and specs are stored
- `docs/agents/triage-labels.md`: triage label definitions
- `docs/agents/domain.md`: domain documentation layout
