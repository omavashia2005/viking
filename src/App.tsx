import React, { useEffect, useMemo, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import type { Option, ToolProgress } from './shared-types';
import { CodeView } from '@/components/CodeView';
import { ErrorView } from '@/components/ErrorView';
import { SettingsPanel } from '@/components/SettingsPanel';
import { SoftAlert } from '@/components/SoftAlert';
import { Spotlight } from '@/components/Spotlight';
import { TitleBar } from '@/components/TitleBar';
import { ToolCallLog, type ToolCallEntry } from '@/components/ToolCallLog';
import { ThemePicker } from '@/components/ThemePicker';
import { THEMES, type Hotkeys, type LLM, type Phase, type Theme } from '@/components/types';

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
      resize: (height: number) => void;
      hide: () => void;
      getSettings: () => Promise<{ llm: LLM; hotkeys: Hotkeys; theme: Theme }>;
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
  const [copied, setCopied] = useState(false);
  const [llm, setLlm] = useState<LLM>({ baseURL: '', apiKey: '', model: '' });
  const [hotkeys, setHotkeys] = useState<Hotkeys>({ open: '', settings: '', close: '', copy: '' });
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [theme, setTheme] = useState<Theme>('onyx');
  const [saved, setSaved] = useState(false);
  const settingsReady = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!window.viking) {
      console.error('[viking] preload bridge missing — window.viking is undefined. Check preload path / contextIsolation.');
      return;
    }
    window.viking.on('viking:show', ({ mode, refineFrom }: { mode: 'textbox' | 'followup'; refineFrom?: Option }) => {
      console.log('[viking] show', mode);
      setError(''); setSoftError(''); setPrompt(''); setCopied(false); setToolCalls([]);
      setPhase('textbox');
      setRefineFrom(mode === 'followup' ? refineFrom : undefined);
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    window.viking.on('viking:loading', () => { setSoftError(''); setToolCalls([]); setPhase('loading'); });
    window.viking.on('viking:tool', (event: ToolProgress) => setToolCalls(prev => mergeToolCall(prev, event)));
    window.viking.on('viking:result', (p: { options: Option[]; error?: string; softError?: string }) => {
      if (p.error) { setError(p.error); setPhase('error'); return; }
      if (p.softError) {
        setSoftError(p.softError);
        if (p.options.length === 0) { setPhase('textbox'); setTimeout(() => inputRef.current?.focus(), 50); return; }
      }
      setOptions(p.options); setActive(0); setPhase('results');
    });
    window.viking.on('viking:reset', () => setPhase('hidden'));
    window.viking.getSettings().then(s => { if (THEMES.includes(s.theme)) setTheme(s.theme); });
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  useEffect(() => { window.viking.setActive(active); }, [active]);

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
      await window.viking.saveSettings({ llm, hotkeys, theme });
      if (!cancelled) { setSaved(true); setTimeout(() => setSaved(false), 1200); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [llm, hotkeys, theme]);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const editable = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      // q closes when no input is focused; Esc kept as the escape-hatch while typing.
      if (!editable && (e.key === 'q' || e.key === 'Q')) { e.preventDefault(); return window.viking.hide(); }
      if (editable && e.key === 'Escape') return window.viking.hide();
      if (mod && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        settingsReady.current = false;
        const s = await window.viking.getSettings();
        setLlm(s.llm); setHotkeys(s.hotkeys);
        if (THEMES.includes(s.theme)) setTheme(s.theme);
        setSaved(false);
        setPhase(e.key.toLowerCase() === 'k' ? 'keymaps' : 'provider');
        window.viking.resize(380);
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
        setCopied(true); setTimeout(() => setCopied(false), 1400);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, active]);

  const current = options[active];
  const highlightedLines = useMemo(() => {
    if (!current) return [] as string[];
    let html = current.code;
    try {
      const lang = current.language && hljs.getLanguage(current.language) ? current.language : undefined;
      html = lang
        ? hljs.highlight(current.code, { language: lang, ignoreIllegals: true }).value
        : hljs.highlightAuto(current.code).value;
    } catch {}
    // ponytail: naive split — a multi-line hljs span (block comment, template string) can bleed styling
    // across the newline. Swap for per-line highlighting if visible in real snippets.
    return html.split('\n');
  }, [current]);

  // Grow window to fit the rendered code, capped in main.
  useEffect(() => {
    if (phase !== 'results' || !current) return;
    requestAnimationFrame(() => {
      const bar = document.querySelector('.bar') as HTMLElement | null;
      const head = document.querySelector('.codehead') as HTMLElement | null;
      const code = document.querySelector('.code') as HTMLElement | null;
      if (!code) return;
      const want = (bar?.offsetHeight ?? 36) + (head?.offsetHeight ?? 36) + code.scrollHeight + 24;
      window.viking.resize(want);
    });
  }, [phase, active, highlightedLines, current]);

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
          className="loading"
          style={{ display: 'block', padding: 18, overflowY: 'auto', textTransform: 'none', letterSpacing: 0 }}
        >
          <ToolCallLog calls={toolCalls} />
        </div>
      )}

      {phase === 'results' && current && (
        <CodeView
          option={current}
          lines={highlightedLines}
          copied={copied}
          onCopy={async () => {
            await navigator.clipboard.writeText(current.code);
            setCopied(true); setTimeout(() => setCopied(false), 1400);
          }}
        />
      )}

      {phase === 'error' && <ErrorView message={error} />}

      {phase === 'provider' && (
        <SettingsPanel
          saved={saved}
          hint="q to close · ⌘K for keymaps"
          fields={[
            { label: 'base url', value: llm.baseURL, onChange: v => setLlm({ ...llm, baseURL: v }), placeholder: 'https://api.openai.com/v1', autoFocus: true },
            { label: 'api key', value: llm.apiKey, onChange: v => setLlm({ ...llm, apiKey: v }), placeholder: 'sk-…', type: 'password' },
            { label: 'model', value: llm.model, onChange: v => setLlm({ ...llm, model: v }), placeholder: 'gpt-4o' },
          ]}
        >
          <ThemePicker theme={theme} onChange={setTheme} />
        </SettingsPanel>
      )}

      {phase === 'keymaps' && (
        <SettingsPanel
          saved={saved}
          hint="q to close · ⌘S for provider"
          fields={[
            { label: 'open prompt (global)', value: hotkeys.open, onChange: v => setHotkeys({ ...hotkeys, open: v }), placeholder: 'CommandOrControl+I', autoFocus: true },
            { label: 'open settings (window)', value: hotkeys.settings, onChange: v => setHotkeys({ ...hotkeys, settings: v }), placeholder: 'CommandOrControl+K' },
            { label: 'close key (window, ignored while typing)', value: hotkeys.close, onChange: v => setHotkeys({ ...hotkeys, close: v }), placeholder: 'q' },
            { label: 'copy active (⌘/Ctrl + …)', value: hotkeys.copy, onChange: v => setHotkeys({ ...hotkeys, copy: v }), placeholder: 'c' },
          ]}
        />
      )}
      <div className="grip" />
      {alertEl}
    </div>
  );
}
