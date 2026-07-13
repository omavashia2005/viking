import React from 'react';
import { Button } from '@/components/ui/button';
import { THEMES, type Theme } from '@/components/types';

export function ThemePicker({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }): JSX.Element {
  return (
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
  );
}
