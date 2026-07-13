import React from 'react';

export default function Alert({ message, onDismiss }: { message: string; onDismiss: () => void }): JSX.Element | null {
  if (!message) return null;
  return (
    <div className="alert" role="status" aria-live="polite">
      <span className="alert-tag">alert</span>
      <span className="alert-msg">{message}</span>
      <button className="alert-x" onClick={onDismiss} aria-label="dismiss">×</button>
    </div>
  );
}
