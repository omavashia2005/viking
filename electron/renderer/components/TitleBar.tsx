import React from 'react';
import type { Option } from '@/shared-types';
import { TabsList, TabsTrigger } from './ui/tabs';
import type { Phase } from './types';

export function TitleBar({ phase, options }: {
  phase: Phase;
  options: Option[];
}): JSX.Element {
  return (
    <header className="bar">
      <span className="brand">viking</span>
      <span className="sep">/</span>
      {phase === 'loading' && <span className="state pulse">gathering context · querying model</span>}
      {phase === 'error' && <span className="state err">error</span>}
      {phase === 'provider' && <span className="state">model</span>}
      {phase === 'keymaps' && <span className="state">keymaps</span>}
      {phase === 'theme' && <span className="state">theme</span>}
      {phase === 'results' && (
        <TabsList aria-label="Code options" className="ml-3 h-7 [-webkit-app-region:no-drag]">
          {options.map((o, i) => (
            <TabsTrigger key={i} value={String(i)} className="px-2 text-[10.5px] font-normal lowercase">
              <span className="text-[9.5px] opacity-55">⌘{i + 1}</span>
              <span>{o.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      <span className="hint">q</span>
    </header>
  );
}
