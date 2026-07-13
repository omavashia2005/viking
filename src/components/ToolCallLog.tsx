import React from 'react';
import { CheckIcon, TriangleAlertIcon } from 'lucide-react';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Spinner } from '@/components/ui/spinner';

export type ToolCallEntry = {
  id: string;
  name: string;
  status: 'running' | 'done' | 'error';
  args?: Record<string, unknown>;
  detail?: string;
  error?: string;
};

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
            {t.detail && <span> · {t.detail}</span>}
            {t.error && <span className="text-destructive"> · {t.error}</span>}
          </MarkerContent>
        </Marker>
      ))}
    </>
  );
}
