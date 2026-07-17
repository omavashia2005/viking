import React from 'react';

export function ErrorView({ message }: { message: string }): React.ReactNode {
  return (
    <div className="errbody">
      <div className="errhead">something went wrong</div>
      <div className="errmsg">{message}</div>
      <div className="errhint">press q to dismiss · then retry with ⌘I</div>
    </div>
  );
}
