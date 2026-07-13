import React from 'react';
import type { Option } from '../shared-types';

export function CodeView({ option, lines, copied, onCopy }: {
  option: Option;
  lines: string[];
  copied: boolean;
  onCopy: () => void;
}): JSX.Element {
  return (
    <div className="codewrap">
      <div className="codehead">
        <span className="lang">{option.language}</span>
        {option.file && (
          <span className="file" title={option.file}>
            {option.file.split('/').pop()}{option.startLine ? `:${option.startLine}` : ''}
          </span>
        )}
        <span className="copyhint">{copied ? '✓ copied' : 'click or ⌘C to copy'}</span>
      </div>
      <pre
        className="code"
        title="click to copy"
        onClick={() => {
          if (window.getSelection()?.toString()) return; // user is selecting, don't hijack
          onCopy();
        }}
      >
        <code>
          {lines.map((line, i) => (
            <div key={i} className="ln">
              <span className="gutter">{(option.startLine ?? 1) + i}</span>
              <span className="lc" dangerouslySetInnerHTML={{ __html: line || ' ' }} />
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
