import React, { useEffect, useMemo, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import type { Option } from './shared-types';
import { Button } from '@/components/ui/button';
import { CodeView } from '@/components/CodeView';
import { SettingsPanel } from '@/components/SettingsPanel';
import { SoftAlert } from '@/components/SoftAlert';
import { ToolCallLog, type ToolCallEntry } from '@/components/ToolCallLog';

declare global {
  interface Window {
    viking: {
      on: (ch: string, fn: (...a: any[]) => void) => void;
      submit: (p: { prompt: string; refineFrom?: Option }) => void;
      setActive: (idx: number) => void;
      resize: (height: number) => void;
      hide: () => void;
      getSettings: () => Promise<{ llm: LLM; hotkeys: Hotkeys }>;
      saveSettings: (s: { llm?: Partial<LLM>; hotkeys?: Partial<Hotkeys> }) => Promise<void>;
    };
  }
}

type Phase = 'hidden' | 'textbox' | 'loading' | 'results' | 'error' | 'provider' | 'keymaps';
type LLM = { baseURL: string; apiKey: string; model: string };
type Hotkeys = { open: string; settings: string; close: string; copy: string };

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
    window.viking.on('viking:tool', (event: ToolCallEntry) => {
      setToolCalls(prev => {
        const i = prev.findIndex(t => t.id === event.id);
        if (i < 0) return [...prev, event];
        const next = prev.slice();
        next[i] = { ...next[i], ...event, args: event.args ?? next[i].args };
        return next;
      });
    });
    window.viking.on('viking:result', (p: { options: Option[]; error?: string; softError?: string }) => {
      if (p.error) { setError(p.error); setPhase('error'); return; }
      if (p.softError) {
        setSoftError(p.softError);
        if (p.options.length === 0) { setPhase('textbox'); setTimeout(() => inputRef.current?.focus(), 50); return; }
      }
      setOptions(p.options); setActive(0); setPhase('results');
    });
    window.viking.on('viking:reset', () => setPhase('hidden'));
  }, []);

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
      await window.viking.saveSettings({ llm, hotkeys });
      if (!cancelled) { setSaved(true); setTimeout(() => setSaved(false), 1200); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [llm, hotkeys]);

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
    const growTextarea = (el: HTMLTextAreaElement) => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
      window.viking.resize(el.scrollHeight + 48);
    };
    return (
      <div className="spot">
        <form
          className="prompt"
          onSubmit={e => {
            e.preventDefault();
            if (prompt.trim()) window.viking.submit({ prompt: prompt.trim(), refineFrom });
          }}
        >
          <span className="caret">›</span>
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={e => { setPrompt(e.target.value); growTextarea(e.target); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (prompt.trim()) window.viking.submit({ prompt: prompt.trim(), refineFrom });
              }
            }}
            rows={1}
            placeholder={refineFrom ? `refine "${refineFrom.label}"…` : 'how do I…'}
            spellCheck={false}
            autoFocus
          />
          {refineFrom && <span className="chip">↻ {refineFrom.language}</span>}
        </form>
        {alertEl}
      </div>
    );
  }

  return (
    <div className="overlay">
      <header className="bar">
        <span className="brand">viking</span>
        <span className="sep">/</span>
        {phase === 'loading' && <span className="state pulse">gathering context · querying model</span>}
        {phase === 'error' && <span className="state err">error</span>}
        {phase === 'provider' && <span className="state">provider</span>}
        {phase === 'keymaps' && <span className="state">keymaps</span>}
        {phase === 'results' && (
          <nav className="tabs">
            {options.map((o, i) => (
              <Button
                key={i}
                size="sm"
                variant={i === active ? 'default' : 'outline'}
                className="h-6 gap-1.5 rounded-full px-2.5 font-normal lowercase text-[10.5px]"
                onClick={() => setActive(i)}
              >
                <span className="text-[9.5px] opacity-55">⌘{i + 1}</span><span>{o.label}</span>
              </Button>
            ))}
          </nav>
        )}
        <span className="hint">q</span>
      </header>

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

      {phase === 'error' && (
        <div className="errbody">
          <div className="errhead">something went wrong</div>
          <div className="errmsg">{error}</div>
          <div className="errhint">press q to dismiss · then retry with ⌘I</div>
        </div>
      )}

      {phase === 'provider' && (
        <SettingsPanel
          saved={saved}
          hint="q to close · ⌘K for keymaps"
          fields={[
            { label: 'base url', value: llm.baseURL, onChange: v => setLlm({ ...llm, baseURL: v }), placeholder: 'https://api.openai.com/v1', autoFocus: true },
            { label: 'api key', value: llm.apiKey, onChange: v => setLlm({ ...llm, apiKey: v }), placeholder: 'sk-…', type: 'password' },
            { label: 'model', value: llm.model, onChange: v => setLlm({ ...llm, model: v }), placeholder: 'gpt-4o' },
          ]}
        />
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
