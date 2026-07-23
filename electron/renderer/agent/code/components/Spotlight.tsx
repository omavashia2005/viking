import React from 'react';
import { Search } from 'lucide-react';
import type { Option } from '@/shared-types';

type Props = {
  prompt: string;
  refineFrom?: Option;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (v: string) => void;
  onSubmit: () => void;
  className?: string;
  children?: React.ReactNode; // alert slot
};

const growTextarea = (el: HTMLTextAreaElement): void => {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
  window.viking.resize(el.scrollHeight + 48);
};

export function Spotlight({ prompt, refineFrom, inputRef, onChange, onSubmit, className, children }: Props): React.ReactNode {
  return (
    <div className={className ? `spot ${className}` : 'spot'}>
      <form className="prompt" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
        <Search className="caret" size={17} />
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={e => { onChange(e.target.value); growTextarea(e.target); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
          }}
          rows={1}
          placeholder={refineFrom ? `refine "${refineFrom.label}"…` : 'ask viking anything'}
          spellCheck={false}
        />
        {refineFrom && <span className="chip">↻ {refineFrom.language}</span>}
      </form>
      {children}
    </div>
  );
}
