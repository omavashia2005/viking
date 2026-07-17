import React from 'react';
import type { Option } from '@/shared-types';
import { TabsList, TabsTrigger } from '@/electron/renderer/components/ui/tabs';
import type { Phase } from '../shared-types';

export function TitleBar({ phase, options }: {
  phase: Phase;
  options: Option[];
}): React.ReactNode {
  return (
    <header className="bar">
      <span className="brand">viking</span>
      <span className="sep">/</span>
      {phase === 'error' && <span className="state err">error</span>}
      {phase === 'results' && (
        <TabsList aria-label="Code options" className="ml-3 flex h-7 min-w-0 flex-1 overflow-hidden [-webkit-app-region:no-drag]">
          {options.map((o, i) => (
            <TabsTrigger key={`${o.file}:${o.startLine}:${o.label}:${o.code}`} value={String(i)} title={o.label} className="min-w-0 px-2 text-[10.5px] font-normal lowercase">
              <span className="shrink-0 text-[9.5px] opacity-55">⌘{i + 1}</span>
              <span className="truncate">{o.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      <span className="hint">q</span>
    </header>
  );
}
