# [WIP] viking

Floating overlay that shows as many useful alternatives as your request warrants.
Pulls live context from Context7 (language docs) and `fff-mcp` (codebase grep),
plus a screenshot of your screen. Models run through Vercel AI Gateway.

## Setup

```sh
npm install
```

Choose a model and enter a Vercel AI Gateway key from the in-app model settings (`⌘ S`).
The key can also be provided by env:

```sh
export AI_GATEWAY_API_KEY=...                         # optional when saved in settings
export LLM_MODEL=anthropic/claude-opus-4.8            # optional
export VIKING_CWD=/path/to/your/project         # codebase fff greps against
```

`fff-mcp` is expected at `~/.local/bin/fff-mcp`. Change the path in
`electron/main/agent/config.ts` if yours lives elsewhere. Context7 runs via `npx`, no install.

## Run

```sh
npm start
```

## Desktop releases

Inspect local packages with `npm run pack` or `npm run pack:mac`; build installers with
`npm run dist`, `npm run dist:mac`, or `npm run dist:win`.

Prepare a version commit on a short-lived branch:

```sh
npm run release:prepare:patch # or :minor / :major
```

Merge that branch into `main`, sync local `main`, then publish the tag:

```sh
npm run release:patch
```

The tag workflow builds Apple Silicon DMG/ZIP and Windows x64 NSIS/ZIP artifacts,
uploads the updater manifests, and creates the GitHub Release. macOS requires
`CSC_LINK`, `CSC_KEY_PASSWORD`, and either the three `APPLE_API_*` secrets or
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.

## Hotkeys

| key       | what it does                                                |
| --------- | ----------------------------------------------------------- |
| `⌘ I`     | open the prompt. If results are visible, opens a follow-up referencing the active option. |
| `⌘ S`     | open settings → choose an AI Gateway model and enter your Gateway key. Window-scoped.      |
| `⌘ K`     | open settings → keymaps section. Window-scoped.                                            |
| `⌘ 1..9`  | switch between rendered options                                                            |
| `⌘ C`     | copy the active option (defers to native copy if you have text selected)                   |
| `q`       | hide the overlay (ignored while typing in an input — use `esc` then)                       |

Settings (model, AI Gateway key, and keymaps) are saved to `<userData>/viking-settings.json` and override the defaults from `electron/main/agent/config.ts`.

Edit hotkeys in `electron/main/agent/config.ts`.

## Where to tweak

- `electron/main/agent/config.ts` — hotkeys, model, MCP paths, default language
- `electron/main/agent/prompts.ts` — system + user prompt
- `electron/main/agent/shared-types.ts` — zod schemas (Context, Option, LLMResponse)
- `electron/main/agent/llm.ts` — how context is gathered and the LLM is called
