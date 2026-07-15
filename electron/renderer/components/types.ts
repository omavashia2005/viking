export type Phase = 'hidden' | 'textbox' | 'loading' | 'results' | 'error';
export type VikingState = 'main' | 'provider' | 'keymaps' | 'theme';
export const THEMES = ['onyx', 'acid'] as const;
export type Theme = (typeof THEMES)[number];
export type LLM = { apiKey: string; model: string };
export type Hotkeys = { open: string; settings: string; home: string; close: string; copy: string };
