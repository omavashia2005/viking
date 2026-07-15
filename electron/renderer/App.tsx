import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Option, ReasoningProgress, ToolProgress } from '@/shared-types';
import { CodeView } from './components/CodeView';
import { ErrorView } from './components/ErrorView';
import { ModelPicker } from './components/ModelPicker';
import { SettingsPanel } from './components/SettingsPanel';
import { SoftAlert } from './components/SoftAlert';
import { Spotlight } from './components/Spotlight';
import { TitleBar } from './components/TitleBar';
import { ToolCallLog, type ToolCallEntry } from './components/ToolCallLog';
import { ThemePicker } from './components/ThemePicker';
import { THEMES, type Hotkeys, type LLM, type Phase, type Theme, type VikingState } from './components/types';
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
      expand: () => void;
      resize: (height: number) => void; // spotlight-only prompt growth
      hide: () => void;
      getSettings: () => Promise<{ llm: LLM; hotkeys: Hotkeys; theme: Theme; opacity: number }>;
      saveSettings: (s: { llm?: Partial<LLM>; hotkeys?: Partial<Hotkeys>; theme?: Theme; opacity?: number }) => Promise<void>;
    };
  }
}

export default function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [vikingState, setVikingState] = useState<VikingState>('main');
  const [options, setOptions] = useState<Option[]>([]);
  const [active, setActive] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [softError, setSoftError] = useState('');
  const [refineFrom, setRefineFrom] = useState<Option | undefined>();
  const [llm, setLlm] = useState<LLM>({ apiKey: '', model: '' });
  const [hotkeys, setHotkeys] = useState<Hotkeys>({ open: '', settings: '', home: 'CommandOrControl+Shift+I', close: '', copy: '' });
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [reasoning, setReasoning] = useState<ReasoningProgress[]>([]);
  const [theme, setTheme] = useState<Theme>('onyx');
  const [opacity, setOpacity] = useState(0.62);
  const [saved, setSaved] = useState(false);
  const [closing, setClosing] = useState(false);
  const hideTimer = useRef<number>();
  const settingsReady = useRef(false);
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
      setError(''); setSoftError(''); setPrompt(''); setToolCalls([]); setReasoning([]);
      setPhase('textbox');
      setVikingState('main');
      setRefineFrom(mode === 'followup' ? refineFrom : undefined);
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    window.viking.on('viking:loading', () => { setSoftError(''); setToolCalls([]); setReasoning([]); setPhase('loading'); });
    window.viking.on('viking:tool', (event: ToolProgress) => setToolCalls(prev => mergeToolCall(prev, event)));
    window.viking.on('viking:reasoning', (event: ReasoningProgress) => setReasoning(prev => [...prev, event]));
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
    window.viking.getSettings().then(s => {
      setLlm(s.llm);
      setHotkeys({ ...s.hotkeys, home: s.hotkeys.home ?? 'CommandOrControl+Shift+I' });
      if (THEMES.includes(s.theme)) setTheme(s.theme);
      if (typeof s.opacity === 'number') setOpacity(s.opacity);
    });
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.style.setProperty('--glass-alpha', String(opacity)); }, [opacity]);

  useEffect(() => { window.viking.setActive(active); }, [active]);

  // Loading is a live tail: keep the newest work visible as content grows or the window resizes.
  useEffect(() => {
    const el = logRef.current;
    if (vikingState === 'main' && phase === 'loading' && el) el.scrollTop = el.scrollHeight;
  }, [phase, reasoning, toolCalls, vikingState]);

  useEffect(() => {
    const el = logRef.current;
    if (vikingState !== 'main' || phase !== 'loading' || !el) return;
    const observer = new ResizeObserver(() => { el.scrollTop = el.scrollHeight; });
    observer.observe(el);
    return () => observer.disconnect();
  }, [phase, vikingState]);

  // Auto-dismiss the soft alert after ~5s. Timer resets whenever a new softError arrives.
  useEffect(() => {
    if (!softError) return;
    const t = setTimeout(() => setSoftError(''), 5000);
    return () => clearTimeout(t);
  }, [softError]);

  // Autosave settings on change. ponytail: per-keystroke write, debounce when disk thrash matters.
  useEffect(() => {
    if (!settingsReady.current) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      await window.viking.saveSettings({ llm, hotkeys, theme, opacity });
      if (!cancelled) { setSaved(true); setTimeout(() => setSaved(false), 1200); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [llm, hotkeys, theme, opacity]);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (matchesShortcut(e, hotkeys.home)) { e.preventDefault(); setVikingState('main'); return; }
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      const editable = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      // The configured shortcut closes when no input is focused; Esc stays the escape-hatch while typing.
      if (!editable && matchesShortcut(e, hotkeys.close)) { e.preventDefault(); return close(); }
      if (editable && e.key === 'Escape') return close();
      const pane = matchesShortcut(e, hotkeys.settings)
        ? 'keymaps'
        : mod ? ({ s: 'provider', t: 'theme' } as const)[e.key.toLowerCase()] : undefined;
      if (pane) {
        e.preventDefault();
        settingsReady.current = false;
        const s = await window.viking.getSettings();
        setLlm(s.llm); setHotkeys({ ...s.hotkeys, home: s.hotkeys.home ?? 'CommandOrControl+Shift+I' });
        if (THEMES.includes(s.theme)) setTheme(s.theme);
        if (typeof s.opacity === 'number') setOpacity(s.opacity);
        setSaved(false);
        setVikingState(pane);
        window.viking.expand();
        // mark ready after the populated state has flushed, so the autosave effect skips the load.
        setTimeout(() => { settingsReady.current = true; }, 0);
        return;
      }
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
  if (vikingState === 'main' && phase === 'textbox') {
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
      <TitleBar phase={vikingState === 'main' ? phase : vikingState} options={options} />

      {phase === 'loading' && (
        <div className={vikingState === 'main' ? 'toollog' : 'toollog hidden'} ref={logRef}>
          <ToolCallLog calls={toolCalls} reasoning={reasoning} />
        </div>
      )}

      {phase === 'results' && options.map((option, i) => (
        <TabsContent key={i} value={String(i)} className={vikingState === 'main' ? 'flex min-h-0' : 'hidden'}>
          <CodeView option={option} />
        </TabsContent>
      ))}

      {vikingState === 'main' && phase === 'error' && <ErrorView message={error} />}

      {vikingState === 'provider' && (
        <SettingsPanel
          saved={saved}
          hint={`${hotkeys.close} to close · ${hotkeys.settings} keymaps · ⌘T theme · ${hotkeys.home} main`}
          fields={[
            { label: 'AI Gateway API key', value: llm.apiKey, onChange: v => setLlm({ ...llm, apiKey: v }), placeholder: 'AI_GATEWAY_API_KEY', type: 'password' },
          ]}
        >
          <ModelPicker value={llm.model} onChange={model => setLlm({ ...llm, model })} />
        </SettingsPanel>
      )}

      {vikingState === 'theme' && (
        <SettingsPanel saved={saved} hint={`${hotkeys.close} to close · ⌘S provider · ${hotkeys.settings} keymaps · ${hotkeys.home} main`} fields={[]}>
          <ThemePicker theme={theme} onChange={setTheme} opacity={opacity} onOpacity={setOpacity} />
        </SettingsPanel>
      )}

      {vikingState === 'keymaps' && (
        <SettingsPanel
          saved={saved}
          hint={`${hotkeys.close} to close · ⌘S provider · ⌘T theme · ${hotkeys.home} main`}
          fields={[
            { label: 'open prompt (global)', value: hotkeys.open, onChange: v => setHotkeys({ ...hotkeys, open: v }), options: ['CommandOrControl+I', 'CommandOrControl+Space', 'Alt+I'], autoFocus: true },
            { label: 'open settings (window)', value: hotkeys.settings, onChange: v => setHotkeys({ ...hotkeys, settings: v }), options: ['CommandOrControl+K', 'CommandOrControl+,', 'CommandOrControl+Shift+K'] },
            { label: 'return home (window)', value: hotkeys.home, onChange: v => setHotkeys({ ...hotkeys, home: v }), options: ['CommandOrControl+Shift+I', 'CommandOrControl+Shift+V', 'Alt+Shift+I'] },
            { label: 'close key (window, ignored while typing)', value: hotkeys.close, onChange: v => setHotkeys({ ...hotkeys, close: v }), options: ['q', 'Escape'] },
            { label: 'copy active (⌘/Ctrl + …)', value: hotkeys.copy, onChange: v => setHotkeys({ ...hotkeys, copy: v }), options: ['c', 'y', 'p'] },
          ]}
        />
      )}
      {alertEl}
    </Tabs>
  );
}
