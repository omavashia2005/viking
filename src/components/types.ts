export type Phase = 'hidden' | 'textbox' | 'loading' | 'results' | 'error' | 'provider' | 'keymaps';
export type LLM = { baseURL: string; apiKey: string; model: string };
export type Hotkeys = { open: string; settings: string; close: string; copy: string };
