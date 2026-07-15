import os from 'node:os';
import path from 'node:path';

// All knobs live here. Edit me, don't bury settings in the rest of the code.
export const config = {
  hotkeys: {
    open: 'CommandOrControl+I', // global; opens a prompt (or follow-up if results visible)
    settings: 'CommandOrControl+K', // window-scoped; opens settings (⌘S also works)
    close: 'q',                     // window-scoped; ignored while typing in an input
    copy: 'c',                      // window-scoped: ⌘/Ctrl + this key copies the active option
  },
  // Any OpenAI-schema-compatible endpoint. Override via env.
  llm: {
    baseURL: process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'gpt-4o',
  },
  theme: 'onyx', // overlay theme; see electron/renderer/themes.css for the available blocks
  opacity: 0.62, // overlay glass opacity, 0..1
  numOptions: 4,
  // Default doc lookup; user retunes by editing.
  // ponytail: single language for v0, add detection from screenshot when one language stops being enough.
  defaultLanguage: 'typescript',
  defaultLibrary: 'microsoft/typescript',
  mcp: {
    fff: { command: path.join(os.homedir(), '.local/bin/fff-mcp'), args: [] as string[] },
    context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
  },
  cwd: process.env.VIKING_CWD ?? process.cwd(),
};
