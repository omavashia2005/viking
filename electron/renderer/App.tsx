import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GatewayModel, Option, ToolProgress } from '@/shared-types';
import { CodeView } from './components/CodeView';
import { ErrorView } from './components/ErrorView';
import { SoftAlert } from './components/SoftAlert';
import { Spotlight } from './components/Spotlight';
import { TitleBar } from './components/TitleBar';
import { ToolCallLog, type ToolCallEntry } from './components/ToolCallLog';
import { THEMES, type Hotkeys, type LLM, type Phase, type Theme } from './components/types';
import { Tabs, TabsContent } from './components/ui/tabs';

function mergeToolCall(prev: ToolCallEntry[], event: ToolProgress): ToolCallEntry[] {
  const i = prev.findIndex(t => t.id === event.id);
  if (i < 0) return [...prev, event];
  const next = prev.slice();
  next[i] = { ...next[i], ...event, args: event.args ?? next[i].args };
  return next;
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
      on: (ch: string, fn: (...a: any[]) => void) => void;
      submit: (p: { prompt: string; refineFrom?: Option }) => void;
      setActive: (idx: number) => void;
      resize: (height: number) => void; // content-driven window height (both modes)
      hide: () => void;
      openSettings: () => void;
      getSettings: () => Promise<{ llm: LLM; hotkeys: Hotkeys; theme: Theme }>;
      getModels: () => Promise<GatewayModel[]>;
      saveSettings: (s: { llm?: Partial<LLM>; hotkeys?: Partial<Hotkeys>; theme?: Theme }) => Promise<void>;
    };
  }
}

export default function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [options, setOptions] = useState<Option[]>([]);
  const [active, setActive] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [softError, setSoftError] = useState('');
  const [refineFrom, setRefineFrom] = useState<Option | undefined>();
  const [hotkeys, setHotkeys] = useState<Hotkeys>({ open: '', settings: '', close: '', copy: '' });
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [theme, setTheme] = useState<Theme>('onyx');
  const [closing, setClosing] = useState(false);
  const hideTimer = useRef<number>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!window.viking) {
      console.error('[viking] preload bridge missing — window.viking is undefined. Check preload path / contextIsolation.');
      return;
    }
    window.viking.on('viking:show', ({ mode, refineFrom }: { mode: 'textbox' | 'followup'; refineFrom?: Option }) => {
      console.log('[viking] show', mode);
      clearTimeout(hideTimer.current); setClosing(false); // reopened mid-close: cancel the pending hide
      setError(''); setSoftError(''); setPrompt(''); setToolCalls([]);
      setPhase('textbox');
      setRefineFrom(mode === 'followup' ? refineFrom : undefined);
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    window.viking.on('viking:loading', () => { setSoftError(''); setToolCalls([]); setPhase('loading'); });
    window.viking.on('viking:tool', (event: ToolProgress) => setToolCalls(prev => mergeToolCall(prev, event)));
    window.viking.on('viking:result', (p: { options: Option[]; error?: string; softError?: string }) => {
      setToolCalls([]);
      if (p.error) { setError(p.error); setPhase('error'); return; }
      if (p.softError) {
        setSoftError(p.softError);
        if (p.options.length === 0) { setPhase('textbox'); setTimeout(() => inputRef.current?.focus(), 50); return; }
      }
      setOptions(p.options); setActive(0); setPhase('results');
    });
    window.viking.on('viking:reset', () => { setPhase('hidden'); setClosing(false); });
    // settings live in their own window now; mirror whatever it saves.
    window.viking.on('viking:settings', (p: { llm: LLM; hotkeys: Hotkeys; theme: Theme }) => {
      setHotkeys(p.hotkeys);
      if (THEMES.includes(p.theme)) setTheme(p.theme);
    });
    window.viking.getSettings().then(s => {
      setHotkeys(s.hotkeys);
      if (THEMES.includes(s.theme)) setTheme(s.theme);
    });
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
    const t = setTimeout(() => setSoftError(''), 5000);
    return () => clearTimeout(t);
  }, [softError]);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Settings open in their own window; works while typing, like the old panes did.
      if (matchesShortcut(e, hotkeys.settings)) { e.preventDefault(); window.viking.openSettings(); return; }
      const t = e.target as HTMLElement | null;
      const editable = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      // The configured shortcut closes when no input is focused; Esc stays the escape-hatch while typing.
      if (!editable && matchesShortcut(e, hotkeys.close)) { e.preventDefault(); return close(); }
      if (editable && e.key === 'Escape') return close();
      if (mod && /^[1-9]$/.test(e.key)) {
        const i = +e.key - 1;
        if (i < options.length) setActive(i);
        return;
      }
      if (matchesShortcut(e, hotkeys.copy, true) && options[active]) {
        if (window.getSelection()?.toString()) return; // user is doing a real copy
        e.preventDefault();
        await navigator.clipboard.writeText(options[active].code);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [options, active, hotkeys]);

  // Spotlight-style dismiss: let overlay-out (140ms) finish before the window hides.
  function close(): void {
    setClosing(true);
    hideTimer.current = window.setTimeout(() => window.viking.hide(), 150);
  }

  if (phase === 'hidden') return <div style={{ display: 'none' }} />;

  const alertEl = <SoftAlert message={softError} onDismiss={() => setSoftError('')} />;

  // Spotlight layout for textbox / follow-up phase
  if (phase === 'textbox') {
    return (
      <Spotlight
        prompt={prompt}
        refineFrom={refineFrom}
        inputRef={inputRef}
        onChange={setPrompt}
        onSubmit={() => { if (prompt.trim()) window.viking.submit({ prompt: prompt.trim(), refineFrom }); }}
        className={closing ? 'closing' : undefined}
      >
        {alertEl}
      </Spotlight>
    );
  }

  return (
    <Tabs value={String(active)} onValueChange={value => setActive(Number(value))} className={closing ? 'overlay gap-0 closing' : 'overlay gap-0'}>
      <TitleBar phase={phase} options={options} />

      {phase === 'loading' && (
        <div className="toollog" ref={logRef}>
          <ToolCallLog calls={toolCalls} />
        </div>
      )}

      {phase === 'results' && options.map((option, i) => (
        <TabsContent key={i} value={String(i)} className="flex min-h-0">
          <CodeView option={option} />
        </TabsContent>
      ))}

      {phase === 'error' && <ErrorView message={error} />}
      {alertEl}
    </Tabs>
  );
}
