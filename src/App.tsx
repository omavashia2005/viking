import React, { useEffect, useRef, useState } from 'react';
import type { Option } from './shared-types';

declare global {
  interface Window {
    viking: {
      on: (ch: string, fn: (...a: any[]) => void) => void;
      submit: (prompt: string) => void;
      hide: () => void;
    };
  }
}

type Phase = 'hidden' | 'textbox' | 'loading' | 'results' | 'error';

export default function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [options, setOptions] = useState<Option[]>([]);
  const [active, setActive] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.viking.on('viking:show', ({ mode }: { mode: 'textbox' | 'direct' }) => {
      setPhase(mode === 'textbox' ? 'textbox' : 'loading');
      setOptions([]); setActive(0); setError(''); setPrompt('');
      if (mode === 'textbox') setTimeout(() => inputRef.current?.focus(), 50);
    });
    window.viking.on('viking:loading', () => setPhase('loading'));
    window.viking.on('viking:result', (p: { options: Option[]; error?: string }) => {
      if (p.error) { setError(p.error); setPhase('error'); return; }
      setOptions(p.options); setActive(0); setPhase('results');
    });
    window.viking.on('viking:reset', () => setPhase('hidden'));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return window.viking.hide();
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        const i = +e.key - 1;
        if (i < options.length) setActive(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options]);

  if (phase === 'hidden') return <div style={{ display: 'none' }} />;
  const current = options[active];

  return (
    <div className="overlay">
      <header className="bar">
        <span className="brand">viking</span>
        <span className="sep">/</span>
        {phase === 'textbox' && <span className="state">awaiting query</span>}
        {phase === 'loading' && <span className="state pulse">gathering context · querying model</span>}
        {phase === 'error' && <span className="state err">{error}</span>}
        {phase === 'results' && (
          <nav className="tabs">
            {options.map((o, i) => (
              <button key={i} className={`tab ${i === active ? 'on' : ''}`} onClick={() => setActive(i)}>
                <span className="num">⌘{i + 1}</span><span>{o.label}</span>
              </button>
            ))}
          </nav>
        )}
        <span className="hint">esc</span>
      </header>

      {phase === 'textbox' && (
        <form className="prompt" onSubmit={e => { e.preventDefault(); if (prompt.trim()) window.viking.submit(prompt.trim()); }}>
          <span className="caret">›</span>
          <input ref={inputRef} value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="how do I…" spellCheck={false} autoFocus />
        </form>
      )}
      {phase === 'loading' && <div className="loading pulse">thinking</div>}
      {phase === 'results' && current && <pre className="code"><code>{current.code}</code></pre>}
      {phase === 'error' && (
        <div className="errbody">
          <div className="errhead">something went wrong</div>
          <div className="errmsg">{error}</div>
          <div className="errhint">press esc to dismiss · then retry with ⌘I or ⌘⇧I</div>
        </div>
      )}
      <div className="grip" />
    </div>
  );
}
