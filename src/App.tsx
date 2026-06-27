import React, { useEffect, useMemo, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import type { Option } from './shared-types';

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
  const [refineFrom, setRefineFrom] = useState<Option | undefined>();
  const [copied, setCopied] = useState(false);
  const [llm, setLlm] = useState<LLM>({ baseURL: '', apiKey: '', model: '' });
  const [hotkeys, setHotkeys] = useState<Hotkeys>({ open: '', settings: '', close: '', copy: '' });
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
      setError(''); setPrompt(''); setCopied(false);
      setPhase('textbox');
      setRefineFrom(mode === 'followup' ? refineFrom : undefined);
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    window.viking.on('viking:loading', () => setPhase('loading'));
    window.viking.on('viking:result', (p: { options: Option[]; error?: string }) => {
      if (p.error) { setError(p.error); setPhase('error'); return; }
      setOptions(p.options); setActive(0); setPhase('results');
    });
    window.viking.on('viking:reset', () => setPhase('hidden'));
  }, []);

  useEffect(() => { window.viking.setActive(active); }, [active]);

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
  const highlighted = useMemo(() => {
    if (!current) return '';
    try {
      const lang = current.language && hljs.getLanguage(current.language) ? current.language : undefined;
      return lang
        ? hljs.highlight(current.code, { language: lang, ignoreIllegals: true }).value
        : hljs.highlightAuto(current.code).value;
    } catch { return current.code; }
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
  }, [phase, active, highlighted, current]);

  if (phase === 'hidden') return <div style={{ display: 'none' }} />;

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
              <button key={i} className={`tab ${i === active ? 'on' : ''}`} onClick={() => setActive(i)}>
                <span className="num">⌘{i + 1}</span><span>{o.label}</span>
              </button>
            ))}
          </nav>
        )}
        <span className="hint">q</span>
      </header>

      {phase === 'loading' && <div className="loading pulse">thinking</div>}

      {phase === 'results' && current && (
        <div className="codewrap">
          <div className="codehead">
            <span className="lang">{current.language}</span>
            <span className="copyhint">{copied ? '✓ copied' : 'click or ⌘C to copy'}</span>
          </div>
          <pre
            className="code"
            title="click to copy"
            onClick={async () => {
              if (window.getSelection()?.toString()) return; // user is selecting, don't hijack
              await navigator.clipboard.writeText(current.code);
              setCopied(true); setTimeout(() => setCopied(false), 1400);
            }}
          ><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
        </div>
      )}

      {phase === 'error' && (
        <div className="errbody">
          <div className="errhead">something went wrong</div>
          <div className="errmsg">{error}</div>
          <div className="errhint">press q to dismiss · then retry with ⌘I</div>
        </div>
      )}

      {phase === 'provider' && (
        <div className="settings">
          <label><span>base url</span>
            <input value={llm.baseURL} onChange={e => setLlm({ ...llm, baseURL: e.target.value })}
              placeholder="https://api.openai.com/v1" spellCheck={false} autoFocus />
          </label>
          <label><span>api key</span>
            <input value={llm.apiKey} onChange={e => setLlm({ ...llm, apiKey: e.target.value })}
              placeholder="sk-…" type="password" spellCheck={false} />
          </label>
          <label><span>model</span>
            <input value={llm.model} onChange={e => setLlm({ ...llm, model: e.target.value })}
              placeholder="gpt-4o" spellCheck={false} />
          </label>
          <div className="srow">
            <span className="autosave">{saved ? '✓ saved' : 'autosaves as you type'}</span>
            <span className="shint">q to close · ⌘K for keymaps</span>
          </div>
        </div>
      )}

      {phase === 'keymaps' && (
        <div className="settings">
          <label><span>open prompt (global)</span>
            <input value={hotkeys.open} onChange={e => setHotkeys({ ...hotkeys, open: e.target.value })}
              placeholder="CommandOrControl+I" spellCheck={false} autoFocus />
          </label>
          <label><span>open settings (window)</span>
            <input value={hotkeys.settings} onChange={e => setHotkeys({ ...hotkeys, settings: e.target.value })}
              placeholder="CommandOrControl+K" spellCheck={false} />
          </label>
          <label><span>close key (window, ignored while typing)</span>
            <input value={hotkeys.close} onChange={e => setHotkeys({ ...hotkeys, close: e.target.value })}
              placeholder="q" spellCheck={false} />
          </label>
          <label><span>copy active (⌘/Ctrl + …)</span>
            <input value={hotkeys.copy} onChange={e => setHotkeys({ ...hotkeys, copy: e.target.value })}
              placeholder="c" spellCheck={false} />
          </label>
          <div className="srow">
            <span className="autosave">{saved ? '✓ saved' : 'autosaves as you type'}</span>
            <span className="shint">q to close · ⌘S for provider</span>
          </div>
        </div>
      )}
      <div className="grip" />
    </div>
  );
}
