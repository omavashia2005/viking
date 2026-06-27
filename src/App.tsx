import React, { useEffect, useMemo, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import type { Option } from './shared-types';

declare global {
  interface Window {
    viking: {
      on: (ch: string, fn: (...a: any[]) => void) => void;
      submit: (p: { prompt: string; refineFrom?: Option }) => void;
      setActive: (idx: number) => void;
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
  const [refineFrom, setRefineFrom] = useState<Option | undefined>();
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.viking.on('viking:show', ({ mode, refineFrom }: { mode: 'textbox' | 'direct' | 'followup'; refineFrom?: Option }) => {
      setError(''); setPrompt(''); setCopied(false);
      if (mode === 'textbox' || mode === 'followup') {
        setPhase('textbox');
        setRefineFrom(mode === 'followup' ? refineFrom : undefined);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        setPhase('loading'); setOptions([]); setActive(0); setRefineFrom(undefined);
      }
    });
    window.viking.on('viking:loading', () => setPhase('loading'));
    window.viking.on('viking:result', (p: { options: Option[]; error?: string }) => {
      if (p.error) { setError(p.error); setPhase('error'); return; }
      setOptions(p.options); setActive(0); setPhase('results');
    });
    window.viking.on('viking:reset', () => setPhase('hidden'));
  }, []);

  useEffect(() => { window.viking.setActive(active); }, [active]);

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

  if (phase === 'hidden') return <div style={{ display: 'none' }} />;

  // Spotlight layout for textbox / follow-up phase
  if (phase === 'textbox') {
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
          <input ref={inputRef} value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder={refineFrom ? `refine "${refineFrom.label}"…` : 'how do I…'}
            spellCheck={false} autoFocus />
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

      {phase === 'loading' && <div className="loading pulse">thinking</div>}

      {phase === 'results' && current && (
        <div className="codewrap">
          <div className="codehead">
            <span className="lang">{current.language}</span>
            <span className="copyhint">{copied ? '✓ copied' : 'click code to copy'}</span>
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
          <div className="errhint">press esc to dismiss · then retry with ⌘I or ⌘⇧I</div>
        </div>
      )}
      <div className="grip" />
    </div>
  );
}
