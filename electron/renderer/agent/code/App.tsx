import React, { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { GatewayModel, Option, ToolProgress } from '@/shared-types';
import { CodeView } from './components/CodeView';
import { Spotlight } from './components/Spotlight';
import { TitleBar } from './components/TitleBar';
import { ErrorView } from '@/electron/renderer/components/ErrorView';
import { SoftAlert } from '@/electron/renderer/components/SoftAlert';
import { Tabs, TabsContent } from '@/electron/renderer/components/ui/tabs';
import { THEMES, type ConnectorSettings, type Hotkeys, type LLM, type Theme } from '../../shared-types';
import type { Phase } from './shared-types';
import { ToolCallLog, type ToolCallEntry } from './components/ToolCallLog';
import { SearchResult } from '../general/components/SearchResult';

function mergeToolCall(prev: ToolCallEntry[], event: ToolProgress): ToolCallEntry[] {
  const i = prev.findIndex(t => t.id === event.id);
  if (i < 0) return [...prev, event];
  const next = prev.slice();
  next[i] = { ...next[i], ...event, args: event.args ?? next[i].args };
  return next;
}

type ResultPayload = { options?: Option[]; answer?: string; error?: string; softError?: string };

type AgentState = {
  phase: Phase;
  options: Option[];
  answer: string;
  active: number;
  prompt: string;
  error: string;
  softError: string;
  refineFrom?: Option;
  toolCalls: ToolCallEntry[];
  closing: boolean;
};

type AgentAction =
  | { type: 'show'; refineFrom?: Option }
  | { type: 'loading' }
  | { type: 'tool'; event: ToolProgress }
  | { type: 'result'; payload: ResultPayload }
  | { type: 'reset' }
  | { type: 'back' }
  | { type: 'setActive'; active: number }
  | { type: 'setPrompt'; prompt: string }
  | { type: 'dismissSoftError' }
  | { type: 'close' };

export const initialAgentState: AgentState = {
  phase: 'hidden',
  options: [],
  answer: '',
  active: 0,
  prompt: '',
  error: '',
  softError: '',
  refineFrom: undefined,
  toolCalls: [],
  closing: false,
};

export function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case 'show':
      return { ...state, phase: 'textbox', error: '', softError: '', prompt: '', answer: '', toolCalls: [], refineFrom: action.refineFrom, closing: false };
    case 'loading':
      return { ...state, phase: 'loading', softError: '', answer: '', toolCalls: [] };
    case 'tool':
      return { ...state, toolCalls: mergeToolCall(state.toolCalls, action.event) };
    case 'result': {
      const { options = [], answer = '', error, softError } = action.payload;
      if (error) return { ...state, phase: 'error', error, toolCalls: [] };
      if (softError && options.length === 0 && !answer) return { ...state, phase: 'textbox', softError, toolCalls: [] };
      return { ...state, phase: 'results', options, answer, active: 0, softError: softError ?? state.softError, toolCalls: [] };
    }
    case 'reset':
      return { ...state, phase: 'hidden', answer: '', closing: false };
    case 'back':
      return { ...state, phase: 'results', refineFrom: undefined };
    case 'setActive':
      return { ...state, active: action.active };
    case 'setPrompt':
      return { ...state, prompt: action.prompt };
    case 'dismissSoftError':
      return { ...state, softError: '' };
    case 'close':
      return { ...state, closing: true };
  }
}

export function matchesShortcut(e: KeyboardEvent, shortcut: string | undefined, implicitMod = false): boolean {
  if (!shortcut) return false;
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop();
  const has = (part: string) => parts.includes(part);
  const commandOrControl = implicitMod || has('commandorcontrol');
  const pressedKey = e.key === ' ' ? 'space' : e.key.toLowerCase();
  if (!key || pressedKey !== key) return false;
  if (commandOrControl ? !(e.metaKey || e.ctrlKey) : e.metaKey !== has('command') || e.ctrlKey !== has('control')) return false;
  return e.altKey === has('alt') && e.shiftKey === has('shift');
}

declare global {
  interface Window {
    viking: {
      receive: (ch: string, fn: (...a: any[]) => void) => () => void;
      submit: (p: { prompt: string; refineFrom?: Option }) => void;
      setActive: (idx: number) => void;
      resize: (height: number) => void; // content-driven window height (both modes)
      hide: () => void;
      back: () => void;
      openSettings: () => void;
      getSettings: () => Promise<{ llm: LLM; connectors: ConnectorSettings; hotkeys: Hotkeys; theme: Theme; growth: 'down' | 'up' }>;
      getModels: () => Promise<GatewayModel[]>;
      saveSettings: (s: { llm?: Partial<LLM>; connectors?: ConnectorSettings; hotkeys?: Partial<Hotkeys>; theme?: Theme; growth?: 'down' | 'up' }) => Promise<void>;
    };
  }
}

export default function CodeAgentApp(): React.ReactNode {
  const [state, dispatch] = useReducer(agentReducer, initialAgentState);
  const { phase, options, answer, active, prompt, error, softError, refineFrom, toolCalls, closing } = state;
  const [hotkeys, setHotkeys] = useState<Hotkeys>({ open: '', settings: '', close: '', copy: '', back: '' });
  const [theme, setTheme] = useState<Theme>('onyx');
  const hideTimer = useRef<number>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!window.viking) {
      console.error('[viking] preload bridge missing — window.viking is undefined. Check preload path / contextIsolation.');
      return;
    }
    let lifecycleActive = true;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const focusInput = () => {
      if (focusTimer !== undefined) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => inputRef.current?.focus(), 50);
    };
    const offShow = window.viking.receive('viking:show', ({ mode, refineFrom }: { mode: 'textbox' | 'followup'; refineFrom?: Option }) => {
      console.log('[viking] show', mode);
      clearTimeout(hideTimer.current);
      dispatch({ type: 'show', refineFrom: mode === 'followup' ? refineFrom : undefined });
      focusInput();
    });
    const offLoading = window.viking.receive('viking:loading', () => dispatch({ type: 'loading' }));
    const offTool = window.viking.receive('viking:tool', (event: ToolProgress) => dispatch({ type: 'tool', event }));
    const offResult = window.viking.receive('viking:result', (p: ResultPayload) => {
      dispatch({ type: 'result', payload: p });
      if (p.softError && !p.options?.length && !p.answer) focusInput();
    });
    const offReset = window.viking.receive('viking:reset', () => dispatch({ type: 'reset' }));
    // settings live in their own window now; mirror whatever it saves.
    const offSettings = window.viking.receive('viking:settings', (p: { llm: LLM; hotkeys: Hotkeys; theme: Theme }) => {
      setHotkeys(p.hotkeys);
      if (THEMES.includes(p.theme)) setTheme(p.theme);
    });
    window.viking.getSettings().then(s => {
      if (!lifecycleActive) return;
      setHotkeys(s.hotkeys);
      if (THEMES.includes(s.theme)) setTheme(s.theme);
    });
    return () => {
      lifecycleActive = false;
      offShow();
      offLoading();
      offTool();
      offResult();
      offReset();
      offSettings();
      if (focusTimer !== undefined) clearTimeout(focusTimer);
      if (hideTimer.current !== undefined) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  useEffect(() => { window.viking.setActive(active); }, [active]);

  // Loading is a live tail: keep the newest work visible as content grows or the window resizes.
  useEffect(() => {
    const el = logRef.current;
    if (phase === 'loading' && el) el.scrollTop = el.scrollHeight;
  }, [phase, toolCalls]);

  useEffect(() => {
    const el = logRef.current;
    if (phase !== 'loading' || !el) return;
    const observer = new ResizeObserver(() => { el.scrollTop = el.scrollHeight; });
    observer.observe(el);
    return () => observer.disconnect();
  }, [phase]);

  // Content height drives the window: watch whichever root (.spot / .overlay) is mounted.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.spot, .overlay');
    if (!el) return;
    const observer = new ResizeObserver(() => window.viking.resize(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [phase]);

  // Auto-dismiss the soft alert after ~5s. Timer resets whenever a new softError arrives.
  useEffect(() => {
    if (!softError) return;
    const t = setTimeout(() => dispatch({ type: 'dismissSoftError' }), 5000);
    return () => clearTimeout(t);
  }, [softError]);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Settings open in their own window; works while typing, like the old panes did.
      if (matchesShortcut(e, hotkeys.settings)) { e.preventDefault(); window.viking.openSettings(); return; }
      // Back out of a follow-up prompt to the still-cached results; works while typing, like settings.
      if (matchesShortcut(e, hotkeys.back) && phase === 'textbox' && options.length > 0) {
        e.preventDefault();
        window.viking.back(); // main widens the window back to full mode
        dispatch({ type: 'back' });
        return;
      }
      const t = e.target as HTMLElement | null;
      const editable = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      // The configured shortcut closes when no input is focused; Esc stays the escape-hatch while typing.
      if (!editable && matchesShortcut(e, hotkeys.close)) { e.preventDefault(); return close(); }
      if (editable && e.key === 'Escape') return close();
      if (mod && /^[1-9]$/.test(e.key)) {
        const i = +e.key - 1;
        if (i < options.length) dispatch({ type: 'setActive', active: i });
        return;
      }
      const copyText = options[active]?.code ?? answer;
      if (matchesShortcut(e, hotkeys.copy, true) && copyText) {
        if (window.getSelection()?.toString()) return; // user is doing a real copy
        e.preventDefault();
        await navigator.clipboard.writeText(copyText);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [options, answer, active, hotkeys, phase]);

  // Spotlight-style dismiss: let overlay-out (140ms) finish before the window hides.
  function close(): void {
    dispatch({ type: 'close' });
    hideTimer.current = window.setTimeout(() => window.viking.hide(), 150);
  }

  if (phase === 'hidden') return <div style={{ display: 'none' }} />;

  const alertEl = <SoftAlert message={softError} onDismiss={() => dispatch({ type: 'dismissSoftError' })} />;

  // Spotlight layout for textbox / follow-up phase
  if (phase === 'textbox') {
    return (
      <Spotlight
        prompt={prompt}
        refineFrom={refineFrom}
        inputRef={inputRef}
        onChange={prompt => dispatch({ type: 'setPrompt', prompt })}
        onSubmit={() => { if (prompt.trim()) window.viking.submit({ prompt: prompt.trim(), refineFrom }); }}
        className={closing ? 'closing' : undefined}
      >
        {alertEl}
      </Spotlight>
    );
  }

  return (
    <Tabs value={String(active)} onValueChange={value => dispatch({ type: 'setActive', active: Number(value) })} className={closing ? 'overlay gap-0 closing' : 'overlay gap-0'}>
      {phase !== 'loading' && <TitleBar phase={phase} options={options} />}

      {phase === 'loading' && (
        <div className="toollog" ref={logRef}>
          <ToolCallLog calls={toolCalls} />
        </div>
      )}

      {phase === 'results' && options.map((option, i) => (
        <TabsContent key={`${option.file}:${option.startLine}:${option.label}:${option.code}`} value={String(i)} className="flex min-h-0">
          <CodeView option={option} />
        </TabsContent>
      ))}

      {phase === 'results' && answer && <SearchResult answer={answer} />}
      {phase === 'error' && <ErrorView message={error} />}
      {alertEl}
    </Tabs>
  );
}
