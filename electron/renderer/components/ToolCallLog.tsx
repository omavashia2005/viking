import React from 'react';
import { CheckIcon, TriangleAlertIcon } from 'lucide-react';
import type { ToolProgress, ToolSummary } from '@/shared-types';
import { Marker, MarkerContent, MarkerIcon } from './ui/marker';
import { Spinner } from './ui/spinner';

export type ToolCallEntry = ToolProgress;

function clip(s: string): string {
  return s.length > 180 ? `${s.slice(0, 180)}...` : s;
}

function Preview({ lines }: { lines?: string[] }): JSX.Element | null {
  if (!lines?.length) return null;
  return <span className="text-muted-foreground"> · {clip(lines.join(' | '))}</span>;
}

function Summary({ summary }: { summary?: ToolSummary }): JSX.Element | null {
  if (!summary) return null;
  if (summary.type === 'search') {
    return (
      <>
        <span className="text-muted-foreground"> · query: {summary.query}</span>
        {summary.lineCount !== undefined && <span className="text-muted-foreground"> · {summary.lineCount} lines</span>}
        <Preview lines={summary.preview} />
      </>
    );
  }
  if (summary.type === 'read_file') {
    return (
      <span className="text-muted-foreground">
        {' '}· file: {summary.path}{summary.startLine ? `:${summary.startLine}${summary.endLine ? `-${summary.endLine}` : ''}` : ''}
      </span>
    );
  }
  if (summary.type === 'library') {
    return (
      <>
        {summary.libraryName && <span className="text-muted-foreground"> · library: {summary.libraryName}</span>}
        {summary.libraryId && <span className="text-muted-foreground"> · docs: {summary.libraryId}</span>}
        {summary.topic && <span className="text-muted-foreground"> · topic: {summary.topic}</span>}
        <Preview lines={summary.preview} />
      </>
    );
  }
  return (
    <>
      {summary.args && <span className="text-muted-foreground"> · args: {clip(JSON.stringify(summary.args))}</span>}
      <Preview lines={summary.preview} />
    </>
  );
}

export function ToolCallLog({ calls }: { calls: ToolCallEntry[] }): JSX.Element {
  if (calls.length === 0) {
    return (
      <Marker role="status" className="mt-[120px] justify-center">
        <MarkerIcon>
          <Spinner className="text-primary" />
        </MarkerIcon>
        <MarkerContent className="pulse lowercase tracking-[0.18em]">thinking</MarkerContent>
      </Marker>
    );
  }
  return (
    <>
      {calls.map(t => (
        <Marker
          key={t.id}
          variant="border"
          role={t.status === 'running' ? 'status' : undefined}
          className="py-2"
        >
          <MarkerIcon>
            {t.status === 'running' ? (
              <Spinner className="text-primary" />
            ) : t.status === 'error' ? (
              <TriangleAlertIcon className="text-destructive" />
            ) : (
              <CheckIcon />
            )}
          </MarkerIcon>
          <MarkerContent>
            <span className={t.status === 'running' ? 'text-foreground' : undefined}>{t.name}</span>
            <Summary summary={t.summary} />
            {t.error && <span className="text-destructive"> · {t.error}</span>}
          </MarkerContent>
        </Marker>
      ))}
    </>
  );
}
