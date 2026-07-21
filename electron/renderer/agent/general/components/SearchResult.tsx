import React from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Artifact,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from '@/electron/renderer/components/ai-elements/artifact';

const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => (
    <a {...props} rel="noreferrer" target="_blank" />
  ),
};

export function SearchResult({ answer }: { answer: string }): React.ReactNode {
  return (
    <div className="flex max-h-[620px] flex-1 p-4 [-webkit-app-region:no-drag]">
      <Artifact className="min-h-0 flex-1 bg-card shadow-none">
        <ArtifactHeader>
          <div>
            <ArtifactTitle>Search result</ArtifactTitle>
            <ArtifactDescription>Composio tools</ArtifactDescription>
          </div>
        </ArtifactHeader>
        <ArtifactContent className="select-text text-sm leading-relaxed">
          <div className="search-markdown">
            <Markdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {answer}
            </Markdown>
          </div>
        </ArtifactContent>
      </Artifact>
    </div>
  );
}
