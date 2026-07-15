import React from 'react';
import { THEMES, type Theme } from './types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function ThemePicker({ theme, onChange }: {
  theme: Theme;
  onChange: (t: Theme) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] lowercase tracking-[0.16em] text-muted-foreground">theme</span>
      <Select value={theme} onValueChange={value => onChange(value as Theme)}>
        <SelectTrigger aria-label="theme" className="w-full lowercase">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {THEMES.map(t => (
            <SelectItem key={t} value={t} className="lowercase">{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
