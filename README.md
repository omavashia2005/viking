# [WIP] viking

Floating overlay that shows 3–4 ways to write the snippet you're asking for.
Pulls live context from Context7 (language docs) and `fff-mcp` (codebase grep),
plus a screenshot of your screen. Any OpenAI-schema API works.

## Setup

```sh
npm install
```

Required env (any OpenAI-compatible provider):

```sh
export LLM_API_KEY=sk-...                       # or OPENAI_API_KEY
export LLM_BASE_URL=https://api.openai.com/v1   # optional, defaults to OpenAI
export LLM_MODEL=gpt-4o                         # optional
export VIKING_CWD=/path/to/your/project         # codebase fff greps against
```

`fff-mcp` is expected at `~/.local/bin/fff-mcp`. Change the path in
`src/electron/main/agent/config.ts` if yours lives elsewhere. Context7 runs via `npx`, no install.

## Run

```sh
npm start
```

## Hotkeys

| key       | what it does                                                |
| --------- | ----------------------------------------------------------- |
| `⌘ I`     | open the prompt. If results are visible, opens a follow-up referencing the active option. |
| `⌘ S`     | open settings → provider section (base URL, API key, model). Window-scoped.                |
| `⌘ K`     | open settings → keymaps section. Window-scoped.                                            |
| `⌘ 1..9`  | switch between rendered options                                                            |
| `⌘ C`     | copy the active option (defers to native copy if you have text selected)                   |
| `q`       | hide the overlay (ignored while typing in an input — use `esc` then)                       |

Settings (provider + keymaps) are saved to `<userData>/viking-settings.json` and override the defaults from `src/electron/main/agent/config.ts`.

Edit hotkeys in `src/electron/main/agent/config.ts`.

## Where to tweak

- `src/electron/main/agent/config.ts` — hotkeys, model, base URL, MCP paths, default language
- `src/electron/main/agent/prompts.ts` — system + user prompt
- `src/electron/main/agent/shared-types.ts` — zod schemas (Context, Option, LLMResponse)
- `src/electron/main/agent/llm.ts` — how context is gathered and the LLM is called
