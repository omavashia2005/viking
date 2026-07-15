import React from 'react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export type SettingsField = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  options?: readonly string[];
};

export function SettingsPanel({ fields, saved, hint, children }: {
  fields: SettingsField[];
  saved: boolean;
  hint: string;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="settings">
      {children}
      {fields.map(f => {
        const options = f.options && f.value && !f.options.includes(f.value)
          ? [f.value, ...f.options.slice(0, 2)]
          : f.options;
        return <label key={f.label}>
          <span>{f.label}</span>
          {options ? (
            <Select value={f.value} onValueChange={f.onChange}>
              <SelectTrigger className="w-full" autoFocus={f.autoFocus} aria-label={f.label}>
                <SelectValue placeholder={f.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={f.value}
              onChange={e => f.onChange(e.target.value)}
              placeholder={f.placeholder}
              type={f.type}
              spellCheck={false}
              autoFocus={f.autoFocus}
              className="bg-black/20 caret-primary"
            />
          )}
        </label>;
      })}
      <div className="srow">
        <span className="autosave">{saved ? '✓ saved' : 'autosaves as you type'}</span>
        <span className="shint">{hint}</span>
      </div>
    </div>
  );
}
