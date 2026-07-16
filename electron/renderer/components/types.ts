export type Phase = 'hidden' | 'textbox' | 'loading' | 'results' | 'error';
export const THEMES = ['onyx', 'acid', 'ivory'] as const;
export type Theme = (typeof THEMES)[number];
export type LLM = { apiKey: string; model: string };
export type Hotkeys = { open: string; settings: string; close: string; copy: string; back: string };
