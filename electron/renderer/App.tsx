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
import { THEMES, type Hotkeys, type LLM, type Phase, type Theme } from './components/types';

function mergeToolCall(prev: ToolCallEntry[], event: ToolProgress): ToolCallEntry[] {
  const i = prev.findIndex(t => t.id === event.id);
  if (i < 0) return [...prev, event];
  const next = prev.slice();
  next[i] = { ...next[i], ...event, args: event.args ?? next[i].args };
  return next;
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
  const [options, setOptions] = useState<Option[]>([]);
  const [active, setActive] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [softError, setSoftError] = useState('');
  const [refineFrom, setRefineFrom] = useState<Option | undefined>();
  const [llm, setLlm] = useState<LLM>({ baseURL: '', apiKey: '', model: '' });
  const [hotkeys, setHotkeys] = useState<Hotkeys>({ open: '', settings: '', close: '', copy: '' });
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [reasoning, setReasoning] = useState<ReasoningProgress[]>([]);
  const [theme, setTheme] = useState<Theme>('onyx');
  const [opacity, setOpacity] = useState(0.62);
  const [saved, setSaved] = useState(false);
  const settingsReady = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useLayoutEffect(() => {
    if (!window.viking) {
      console.error('[viking] preload bridge missing — window.viking is undefined. Check preload path / contextIsolation.');
      return;
    }
    window.viking.on('viking:show', ({ mode, refineFrom }: { mode: 'textbox' | 'followup'; refineFrom?: Option }) => {
      console.log('[viking] show', mode);
      setError(''); setSoftError(''); setPrompt(''); setToolCalls([]); setReasoning([]);
      setPhase('textbox');
      setRefineFrom(mode === 'followup' ? refineFrom : undefined);
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    window.viking.on('viking:loading', () => { setSoftError(''); setToolCalls([]); setReasoning([]); stickToBottom.current = true; setPhase('loading'); });
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
    window.viking.on('viking:reset', () => setPhase('hidden'));
    window.viking.getSettings().then(s => {
      setLlm(s.llm);
      setHotkeys(s.hotkeys);
      if (THEMES.includes(s.theme)) setTheme(s.theme);
      if (typeof s.opacity === 'number') setOpacity(s.opacity);
    });
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.style.setProperty('--glass-alpha', String(opacity)); }, [opacity]);

  useEffect(() => { window.viking.setActive(active); }, [active]);

  // Follow the tool log as it grows, unless the user scrolled away from the bottom.
  useEffect(() => {
    const el = logRef.current;
    if (phase === 'loading' && el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [phase, reasoning, toolCalls]);

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
      const t = e.target as HTMLElement | null;
      const editable = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      // q closes when no input is focused; Esc kept as the escape-hatch while typing.
      if (!editable && (e.key === 'q' || e.key === 'Q')) { e.preventDefault(); return window.viking.hide(); }
      if (editable && e.key === 'Escape') return window.viking.hide();
      const pane = ({ s: 'provider', k: 'keymaps', t: 'theme' } as const)[e.key.toLowerCase()];
      if (mod && pane) {
        e.preventDefault();
        settingsReady.current = false;
        const s = await window.viking.getSettings();
        setLlm(s.llm); setHotkeys(s.hotkeys);
        if (THEMES.includes(s.theme)) setTheme(s.theme);
        if (typeof s.opacity === 'number') setOpacity(s.opacity);
        setSaved(false);
        setPhase(pane);
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
      if (mod && e.key.toLowerCase() === 'c' && options[active]) {
        if (window.getSelection()?.toString()) return; // user is doing a real copy
        e.preventDefault();
        await navigator.clipboard.writeText(options[active].code);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, active]);

  const current = options[active];

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
      >
        {alertEl}
      </Spotlight>
    );
  }

  return (
    <div className="overlay">
      <TitleBar phase={phase} options={options} active={active} onSelect={setActive} />

      {phase === 'loading' && (
        <div
          className="toollog"
          ref={logRef}
          onScroll={e => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
        >
          <ToolCallLog calls={toolCalls} reasoning={reasoning} />
        </div>
      )}

      {phase === 'results' && current && (
        <CodeView option={current} />
      )}

      {phase === 'error' && <ErrorView message={error} />}

      {phase === 'provider' && (
        <SettingsPanel
          saved={saved}
          hint="q to close · ⌘K keymaps · ⌘T theme"
          fields={[
            { label: 'base url', value: llm.baseURL, onChange: v => setLlm({ ...llm, baseURL: v }), placeholder: 'https://api.openai.com/v1', autoFocus: true },
            { label: 'api key', value: llm.apiKey, onChange: v => setLlm({ ...llm, apiKey: v }), placeholder: 'sk-…', type: 'password' },
          ]}
        >
          <ModelPicker value={llm.model} onChange={model => setLlm({ ...llm, model })} />
        </SettingsPanel>
      )}

      {phase === 'theme' && (
        <SettingsPanel saved={saved} hint="q to close · ⌘S provider · ⌘K keymaps" fields={[]}>
          <ThemePicker theme={theme} onChange={setTheme} opacity={opacity} onOpacity={setOpacity} />
        </SettingsPanel>
      )}

      {phase === 'keymaps' && (
        <SettingsPanel
          saved={saved}
          hint="q to close · ⌘S provider · ⌘T theme"
          fields={[
            { label: 'open prompt (global)', value: hotkeys.open, onChange: v => setHotkeys({ ...hotkeys, open: v }), placeholder: 'CommandOrControl+I', autoFocus: true },
            { label: 'open settings (window)', value: hotkeys.settings, onChange: v => setHotkeys({ ...hotkeys, settings: v }), placeholder: 'CommandOrControl+K' },
            { label: 'close key (window, ignored while typing)', value: hotkeys.close, onChange: v => setHotkeys({ ...hotkeys, close: v }), placeholder: 'q' },
            { label: 'copy active (⌘/Ctrl + …)', value: hotkeys.copy, onChange: v => setHotkeys({ ...hotkeys, copy: v }), placeholder: 'c' },
          ]}
        />
      )}
      {alertEl}
    </div>
  );
}
