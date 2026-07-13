export type Phase = 'hidden' | 'textbox' | 'loading' | 'results' | 'error' | 'provider' | 'keymaps';
export const THEMES = ['onyx', 'acid'] as const;
export type Theme = (typeof THEMES)[number];
export type LLM = { baseURL: string; apiKey: string; model: string };
export type Hotkeys = { open: string; settings: string; close: string; copy: string };
