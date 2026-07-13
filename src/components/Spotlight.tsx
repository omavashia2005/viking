import React from 'react';
import type { Option } from '../shared-types';

type Props = {
  prompt: string;
  refineFrom?: Option;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (v: string) => void;
  onSubmit: () => void;
  children?: React.ReactNode; // alert slot
};

export function Spotlight({ prompt, refineFrom, inputRef, onChange, onSubmit, children }: Props): JSX.Element {
  const growTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    window.viking.resize(el.scrollHeight + 48);
  };
  return (
    <div className="spot">
      <form className="prompt" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
        <span className="caret">›</span>
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={e => { onChange(e.target.value); growTextarea(e.target); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
          }}
          rows={1}
          placeholder={refineFrom ? `refine "${refineFrom.label}"…` : 'how do I…'}
          spellCheck={false}
          autoFocus
        />
        {refineFrom && <span className="chip">↻ {refineFrom.language}</span>}
      </form>
      {children}
    </div>
  );
}
