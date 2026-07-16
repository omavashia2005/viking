import React from "react";
import { CodeLanguage, type Option } from "@/shared-types";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/electron/renderer/components/ai-elements/code-block";
import { FileIcon } from "lucide-react";

export function CodeView({ option }: { option: Option }): JSX.Element {
  const parsedLanguage = CodeLanguage.safeParse(option.language);
  const language = parsedLanguage.success ? parsedLanguage.data : "text";
  const filename = option.file.split("/").pop() ?? option.file;

  return (
    <div className="codewrap p-4">
      <CodeBlock
        className="flex min-h-0 flex-1 flex-col [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1"
        code={option.code}
        language={language}
        showLineNumbers
        startLine={option.startLine}
      >
        <CodeBlockHeader>
          <CodeBlockTitle title={option.file}>
            <FileIcon className="size-3.5" />
            <CodeBlockFilename>
              {filename}
              {option.startLine ? `:${option.startLine}` : ""}
            </CodeBlockFilename>
            <span>{option.language}</span>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    </div>
  );
}
