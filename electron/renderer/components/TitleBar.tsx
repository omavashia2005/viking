import React from 'react';
import type { Option } from '@/shared-types';
import { Button } from './ui/button';
import type { Phase } from './types';

export function TitleBar({ phase, options, active, onSelect }: {
  phase: Phase;
  options: Option[];
  active: number;
  onSelect: (i: number) => void;
}): JSX.Element {
  return (
    <header className="bar">
      <span className="brand">viking</span>
      <span className="sep">/</span>
      {phase === 'loading' && <span className="state pulse">gathering context · querying model</span>}
      {phase === 'error' && <span className="state err">error</span>}
      {phase === 'provider' && <span className="state">provider</span>}
      {phase === 'keymaps' && <span className="state">keymaps</span>}
      {phase === 'theme' && <span className="state">theme</span>}
      {phase === 'results' && (
        <nav className="tabs">
          {options.map((o, i) => (
            <Button
              key={i}
              size="sm"
              variant={i === active ? 'default' : 'outline'}
              className="h-6 gap-1.5 rounded-full px-2.5 font-normal lowercase text-[10.5px]"
              onClick={() => onSelect(i)}
            >
              <span className="text-[9.5px] opacity-55">⌘{i + 1}</span><span>{o.label}</span>
            </Button>
          ))}
        </nav>
      )}
      <span className="hint">q</span>
    </header>
  );
}
