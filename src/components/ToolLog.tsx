import React from 'react';
import type { ToolProgress } from '../llm';

export default function ToolLog({ toolCalls }: { toolCalls: ToolProgress[] }): JSX.Element {
  return (
    <div className="toollog">
      {toolCalls.length === 0 ? (
        <div className="pulse thinking">thinking</div>
      ) : (
        toolCalls.map(t => (
          <div key={t.id} className="toolrow">
            <span className={`toolmark ${t.status}`}>
              {t.status === 'error' ? '!' : t.status === 'running' ? '→' : '✓'}
            </span>{' '}
            <span>{t.name}</span>{' '}
            <span className="tooldetail">{t.detail}</span>
          </div>
        ))
      )}
    </div>
  );
}
