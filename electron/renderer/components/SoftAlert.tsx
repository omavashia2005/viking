import React from 'react';
import { TriangleAlertIcon, XIcon } from 'lucide-react';
import { Marker, MarkerContent, MarkerIcon } from './ui/marker';

// Pinned bottom-right; positioning comes from the .alert rules in styles.css.
export function SoftAlert({ message, onDismiss }: { message: string; onDismiss: () => void }): JSX.Element | null {
  if (!message) return null;
  return (
    <Marker role="status" aria-live="polite" className="alert w-auto items-start">
      <MarkerIcon className="mt-0.5 text-warning">
        <TriangleAlertIcon />
      </MarkerIcon>
      <MarkerContent className="line-clamp-2 text-[11.5px] leading-[1.45] text-foreground">
        {message}
      </MarkerContent>
      <button
        className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        onClick={onDismiss}
        aria-label="dismiss"
      >
        <XIcon className="size-3.5" />
      </button>
    </Marker>
  );
}
