export const THEMES = ['onyx', 'acid', 'ivory'] as const;
export type Theme = (typeof THEMES)[number];
export type LLM = { apiKey: string; model: string };
export type ConnectorSettings = { exa: { apiKey: string }; composio: { apiKey: string } };
export type Hotkeys = { open: string; settings: string; close: string; copy: string; back: string };
