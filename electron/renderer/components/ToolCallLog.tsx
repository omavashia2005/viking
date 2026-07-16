import React from "react";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import type {
  ToolProgress,
  ToolSummary,
} from "@/shared-types";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/electron/renderer/components/ai-elements/task";
import { Shimmer } from "@/electron/renderer/components/ai-elements/shimmer";
import { Spinner } from "./ui/spinner";

export type ToolCallEntry = ToolProgress;

const TOOL_PROGRESS_VERBS = [
  "Working",
  "Searching",
  "Reading",
  "Inspecting",
  "Tracing",
  "Checking",
  "Comparing",
  "Resolving",
  "Analyzing",
  "Validating",
  "Drafting",
  "Building",
  "Testing",
  "Reviewing",
  "Refining",
  "Formatting",
  "Summarizing",
  "Organizing",
  "Connecting",
  "Finishing",
] as const;

function ToolActivity({ elapsed }: { elapsed: number }): JSX.Element {
  const verb = TOOL_PROGRESS_VERBS[Math.floor(elapsed / 3) % TOOL_PROGRESS_VERBS.length];
  return (
    <TaskItem
      aria-label="Work in progress"
      className="mt-2 flex items-center gap-3 text-sm"
      role="status"
    >
      <span aria-hidden="true" className="text-foreground">•</span>
      <span aria-hidden="true">
        <Shimmer as="span" className="font-semibold" duration={1.6}>
          {verb}
        </Shimmer>
        <span className="text-muted-foreground"> ({elapsed}s)</span>
      </span>
    </TaskItem>
  );
}

function clip(s: string): string {
  return s.length > 180 ? `${s.slice(0, 180)}...` : s;
}

function Preview({ lines }: { lines?: string[] }): JSX.Element | null {
  if (!lines?.length) return null;
  return (
    <span className="text-muted-foreground"> · {clip(lines.join(" | "))}</span>
  );
}

function Summary({ summary }: { summary?: ToolSummary }): JSX.Element | null {
  if (!summary) return null;
  if (summary.type === "search") {
    return (
      <>
        <span className="text-muted-foreground"> · query: {summary.query}</span>
        {summary.lineCount !== undefined && (
          <span className="text-muted-foreground">
            {" "}
            · {summary.lineCount} lines
          </span>
        )}
        <Preview lines={summary.preview} />
      </>
    );
  }
  if (summary.type === "read_file") {
    return (
      <span className="text-muted-foreground">
        {" "}
        · file: {summary.path}
        {summary.startLine
          ? `:${summary.startLine}${summary.endLine ? `-${summary.endLine}` : ""}`
          : ""}
      </span>
    );
  }
  if (summary.type === "library") {
    return (
      <>
        {summary.libraryName && (
          <span className="text-muted-foreground">
            {" "}
            · library: {summary.libraryName}
          </span>
        )}
        {summary.libraryId && (
          <span className="text-muted-foreground">
            {" "}
            · docs: {summary.libraryId}
          </span>
        )}
        {summary.topic && (
          <span className="text-muted-foreground">
            {" "}
            · topic: {summary.topic}
          </span>
        )}
        <Preview lines={summary.preview} />
      </>
    );
  }
  return (
    <>
      {summary.args && (
        <span className="text-muted-foreground">
          {" "}
          · args: {clip(JSON.stringify(summary.args))}
        </span>
      )}
      <Preview lines={summary.preview} />
    </>
  );
}

export function ToolCallLog({
  calls,
}: {
  calls: ToolCallEntry[];
}): JSX.Element {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const completed = calls.filter((call) => call.status !== "running").length;
  return (
    <Task defaultOpen>
      <TaskTrigger title={`Tools · ${completed}/${calls.length}`} />
      <TaskContent>
        {calls.map((call) => (
          <TaskItem
            key={call.id}
            role={call.status === "running" ? "status" : undefined}
            className="flex items-start gap-2"
          >
            {call.status === "running" ? (
              <Spinner className="mt-0.5 shrink-0 text-primary" />
            ) : call.status === "error" ? (
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : (
              <CheckIcon className="mt-0.5 size-4 shrink-0" />
            )}
            <span>
              <span
                className={
                  call.status === "running" ? "text-foreground" : undefined
                }
              >
                {call.name}
              </span>
              <Summary summary={call.summary} />
              {call.error && (
                <span className="text-destructive"> · {call.error}</span>
              )}
            </span>
          </TaskItem>
        ))}
        <ToolActivity elapsed={elapsed} />
      </TaskContent>
    </Task>
  );
}
