import React from 'react';
import { Input } from './ui/input';

export type SettingsField = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
};

export function SettingsPanel({ fields, saved, hint, children }: {
  fields: SettingsField[];
  saved: boolean;
  hint: string;
  children?: React.ReactNode; // extra controls rendered after the fields
}): JSX.Element {
  return (
    <div className="settings">
      {fields.map(f => (
        <label key={f.label}>
          <span>{f.label}</span>
          <Input
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            placeholder={f.placeholder}
            type={f.type}
            spellCheck={false}
            autoFocus={f.autoFocus}
            className="bg-black/20 caret-primary"
          />
        </label>
      ))}
      {children}
      <div className="srow">
        <span className="autosave">{saved ? '✓ saved' : 'autosaves as you type'}</span>
        <span className="shint">{hint}</span>
      </div>
    </div>
  );
}
