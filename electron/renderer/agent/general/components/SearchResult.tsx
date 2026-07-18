import React from 'react';
import {
  Artifact,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from '@/electron/renderer/components/ai-elements/artifact';

export function SearchResult({ answer }: { answer: string }): React.ReactNode {
  return (
    <div className="flex max-h-[620px] flex-1 p-4 [-webkit-app-region:no-drag]">
      <Artifact className="min-h-0 flex-1 bg-card shadow-none">
        <ArtifactHeader>
          <div>
            <ArtifactTitle>Search result</ArtifactTitle>
            <ArtifactDescription>Exa web search</ArtifactDescription>
          </div>
        </ArtifactHeader>
        <ArtifactContent className="select-text whitespace-pre-wrap text-sm leading-relaxed">
          {answer}
        </ArtifactContent>
      </Artifact>
    </div>
  );
}
