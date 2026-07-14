import React from 'react';
import { THEMES, type Theme } from './types';
import { Button } from './ui/button';

export function ThemePicker({ theme, onChange, opacity, onOpacity }: {
  theme: Theme;
  onChange: (t: Theme) => void;
  opacity: number;
  onOpacity: (o: number) => void;
}): JSX.Element {
  return (
    <>
      <label>
        <span>theme</span>
        <div className="flex gap-1.5 pt-0.5">
          {THEMES.map(t => (
            <Button
              key={t}
              size="sm"
              variant={t === theme ? 'default' : 'outline'}
              className="h-6 rounded-full px-2.5 font-normal lowercase text-[10.5px]"
              onClick={() => onChange(t)}
            >
              {t}
            </Button>
          ))}
        </div>
      </label>
      <label>
        <span>opacity · {Math.round(opacity * 100)}%</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={opacity}
          onChange={e => onOpacity(+e.target.value)}
        />
      </label>
    </>
  );
}
