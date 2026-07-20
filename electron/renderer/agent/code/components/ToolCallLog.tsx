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
import { Spinner } from "@/electron/renderer/components/ui/spinner";

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

function ToolActivity({ elapsed }: { elapsed: number }): React.ReactNode {
  const verb = TOOL_PROGRESS_VERBS[Math.floor(elapsed / 3) % TOOL_PROGRESS_VERBS.length];
  return (
    <TaskItem
      aria-label="Work in progress"
      className="mt-2 flex items-center gap-2 text-sm"
      role="status"
    >
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

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function withPreview(text: string, lines?: string[]): string {
  return lines?.length ? `${text} — ${clip(lines.join(" | "))}` : text;
}

export function formatToolSummary(name: string, summary?: ToolSummary): string {
  if (!summary) return "";
  if (summary.type === "search") {
    return withPreview(
      `Searched for “${clip(summary.query)}”${summary.lineCount !== undefined ? ` (${summary.lineCount} lines)` : ""}`,
      summary.preview,
    );
  }
  if (summary.type === "read_file") {
    const range = summary.startLine
      ? `:${summary.startLine}${summary.endLine ? `-${summary.endLine}` : ""}`
      : "";
    return `Read ${summary.path}${range}`;
  }
  if (summary.type === "library") {
    const subject = summary.libraryName ?? summary.libraryId ?? "library docs";
    const topic = summary.topic ? ` about ${summary.topic}` : "";
    return withPreview(`Read docs for ${subject}${topic}`, summary.preview);
  }
  const args = summary.args
    ? Object.entries(summary.args)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${clip(formatValue(value))}`)
      .join(", ")
    : "";
  if (name === "webSearch" && typeof summary.args?.query === "string") {
    return `Searched for “${clip(summary.args.query)}”`;
  }
  return withPreview(args, summary.preview);
}

function Summary({ name, summary }: { name: string; summary?: ToolSummary }): React.ReactNode {
  const text = formatToolSummary(name, summary);
  return text ? <span className="text-muted-foreground"> — {text}</span> : null;
}

export function ToolCallLog({
  calls,
}: {
  calls: ToolCallEntry[];
}): React.ReactNode {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const completed = calls.filter((call) => call.status !== "running").length;
  return (
    <Task defaultOpen>
      <TaskTrigger title={`Tools (${completed}/${calls.length})`} />
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
              <Summary name={call.name} summary={call.summary} />
              {call.error && (
                <span className="text-destructive"> — {call.error}</span>
              )}
            </span>
          </TaskItem>
        ))}
        <ToolActivity elapsed={elapsed} />
      </TaskContent>
    </Task>
  );
}
