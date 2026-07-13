import React from 'react';
import type { Option } from '../shared-types';
import type { Phase } from './types';

type Props = {
  phase: Phase;
  options: Option[];
  active: number;
  onSelect: (i: number) => void;
};

export default function TitleBar({ phase, options, active, onSelect }: Props): JSX.Element {
  return (
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
            <button key={i} className={`tab ${i === active ? 'on' : ''}`} onClick={() => onSelect(i)}>
              <span className="num">⌘{i + 1}</span><span>{o.label}</span>
            </button>
          ))}
        </nav>
      )}
      <span className="hint">q</span>
    </header>
  );
}
