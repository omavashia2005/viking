import React from "react";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import type {
  ReasoningProgress,
  ToolProgress,
  ToolSummary,
} from "@/shared-types";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/src/components/ai-elements/chain-of-thought";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/src/components/ai-elements/task";
import { Shimmer } from "@/src/components/ai-elements/shimmer";
import { Spinner } from "./ui/spinner";

export type ToolCallEntry = ToolProgress;

const TOOL_PROGRESS_VERBS = [
  "Searching",
  "Reading",
  "Inspecting",
  "Tracing",
  "Checking",
  "Comparing",
  "Resolving",
  "Analyzing",
  "Validating",
  "Planning",
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

function ToolActivity(): JSX.Element {
  const [verb, setVerb] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setInterval(
      () => setVerb((index) => (index + 1) % TOOL_PROGRESS_VERBS.length),
      1600,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <TaskItem
      aria-label="Work in progress"
      className="mt-2 pl-6 text-xs"
      role="status"
    >
      <span aria-hidden="true">
        <Shimmer as="span" duration={1.6}>
          {`${TOOL_PROGRESS_VERBS[verb]}…`}
        </Shimmer>
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
  reasoning,
}: {
  calls: ToolCallEntry[];
  reasoning: ReasoningProgress[];
}): JSX.Element {
  if (calls.length === 0 && reasoning.length === 0) {
    return (
      <Task defaultOpen className="mx-auto mt-[100px] max-w-sm" role="status">
        <TaskTrigger title="Thinking" />
        <TaskContent>
          <TaskItem className="flex items-center gap-2">
            <Spinner className="text-primary" />
            Gathering context and querying the model
          </TaskItem>
          <ToolActivity />
        </TaskContent>
      </Task>
    );
  }

  const completed = calls.filter((call) => call.status !== "running").length;
  const toolTask = calls.length > 0 && (
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
      </TaskContent>
    </Task>
  );

  if (reasoning.length === 0) return <>{toolTask}<ToolActivity /></>;

  return (
    <ChainOfThought defaultOpen>
      <ChainOfThoughtHeader>
        {calls.length > 0 ? "Reasoning and tools" : "Reasoning"}
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {reasoning.map((step, index) => (
          <ChainOfThoughtStep
            key={step.id}
            label={<span className="whitespace-pre-wrap">{step.text}</span>}
            status={index === reasoning.length - 1 ? "active" : "complete"}
          />
        ))}
        {toolTask}
        <ToolActivity />
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}
