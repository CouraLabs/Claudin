# KraudeKode

A terminal UI for Claude, built on the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk), by Anthropic.

A local daemon owns the agent session. The TUI connects to it over WebSocket, so a session keeps running when the UI closes, and other terminals can attach to it.

The agent uses an ADHD-shaped system prompt: replies lead with the next action, use numbered steps, and end with one concrete action. See `packages/agent/src/profile/adhdSystemPrompt.ts`.

Built-in subagents handle focused work so the main agent keeps its context: Scout explores the codebase, CodeReview reviews changes against standards and spec, Coder writes production-grade code, and QA tests flows in a real browser through the browser-use skill.

## Requirements

- Bun 1.4.3 (pinned in `package.json`)
- Claude access for the Claude Agent SDK. The app does not read an API key itself; the SDK handles authentication.

## Install

```bash
bun add -g @couralabs/kraude-code
kraude
```

Requires Bun 1.4.0 or newer.

## Quick start

```bash
bun install
bun run dev
```

This connects to a running daemon on port `7777` or spawns one in the background, then opens the TUI.

## Commands

| Command | What it does |
| --- | --- |
| `kraude` | Connect to the daemon (spawning a detached one if needed) and open the TUI with a fresh session |
| `kraude --session <id>` | Resume a stored session |
| `kraude daemon` | Run the daemon only, with no UI |
| `kraude attach --token <token>` | Attach a TUI to a running daemon's live session (token from `kraude daemon`, or `KRAUDE_TOKEN`) |
| `kraude replay <sessionId>` | Replay a stored session, read-only (`--speed <factor>`) |

Options: `-p, --port <port>` sets the daemon port (default `7777`).

The daemon listens on `127.0.0.1` only and rejects browser origins. Every connection must present the daemon's access token and a run id that is generated when each `kraude` process starts. `kraude` on its own handles both for you. `kraude daemon` prints the token that each `kraude attach` needs.

The daemon runs detached from the terminal, so closing one client never kills another client's session. Each client connects with its own run id and gets its own session; `attach` shares the live session instead. Launching `kraude` while a spawned daemon sits idle with no connected clients restarts that daemon with a fresh session. Manual `kraude daemon` processes are left alone and run until you stop them.

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
- `Tab`: cycle the reasoning effort level (low, medium, high, xhigh, max)
- `Enter` while the agent is busy: steer the running turn with the prompt
- `Ctrl+Q`: queue a prompt while the agent is busy; queued prompts send one per idle turn
- `Esc` twice: interrupt a busy turn
- `Shift+Up` / `Shift+Down`: recall earlier prompts for this directory
- `Ctrl+R`: search prompt history
- `Ctrl+V`: paste clipboard text
- `Ctrl+C` twice: exit

## Where data lives

All paths are under your home directory.

- `~/.kraude/sessions/`: stored sessions
- `~/.kraude/prompts/`: prompt history, kept per directory
- `~/.kraude/options.json`: saved options
- `~/.kraude/rate-limits.json`: cached rate-limit data

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
bun run build:app    # bundle to dist/kraude.js
```

## Release

```bash
bun run promote [patch|minor|major] [--dry-run]
```

Defaults to `patch`. Builds the bundle, publishes `@couralabs/kraude-code` to npm, bumps the root version, creates a GitHub release, and posts the changes to Discord.

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

## Acknowledgments

Powered by the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) by [Anthropic](https://github.com/anthropics).
