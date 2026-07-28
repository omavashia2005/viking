import React from "react";
import {
  ToolCallCard,
  ToolFunction,
  toolCatalog,
  type Tool,
  type ToolCallState,
} from "ai-tool-elements";
import type { ToolProgress, ToolSummary } from "@/shared-types";

export type ToolCallEntry = ToolProgress;

const TOOL_LABELS: Record<string, string> = {
  grep_codebase: "Search codebase",
  find_files: "Find files",
  read_file: "Read file",
  resolve_library_id: "Resolve library",
  get_library_docs: "Read library docs",
  COMPOSIO_SEARCH_TOOLS: "Find tools",
  COMPOSIO_MULTI_EXECUTE_TOOL: "Run tools",
  COMPOSIO_MANAGE_CONNECTIONS: "Manage connections",
  COMPOSIO_WAIT_FOR_CONNECTIONS: "Wait for connections",
  COMPOSIO_REMOTE_WORKBENCH: "Use workbench",
  COMPOSIO_REMOTE_BASH_TOOL: "Run command",
  COMPOSIO_GET_TOOL_SCHEMAS: "Read tool schemas",
};

const catalogTools = toolCatalog
  .map((tool) => ({ normalizedId: normalizeIdentifier(tool.id), tool }))
  .sort((a, b) => b.normalizedId.length - a.normalizedId.length);

function normalizeIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/^COMPOSIO_/, "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function toolSlugs(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      return toolSlugs(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value.flatMap(toolSlugs);
  const item = recordValue(value);
  if (!item) return [];
  const slug = item.tool_slug ?? item.toolSlug ?? item.slug;
  return typeof slug === "string" ? [slug] : toolSlugs(item.tools);
}

function catalogToolFor(identifier: string): Tool | undefined {
  const normalized = normalizeIdentifier(identifier);
  return catalogTools.find(({ normalizedId }) =>
    normalized === normalizedId || normalized.startsWith(normalizedId)
  )?.tool;
}

function toolWithAction(tool: Tool, identifier: string): Tool {
  const normalizedToolId = normalizeIdentifier(tool.id);
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (normalizedIdentifier === normalizedToolId) return tool;

  const action = identifier
    .split(/[_\s-]+/)
    .filter(Boolean)
    .slice(Math.max(1, tool.id.split(/[_\s-]+/).filter(Boolean).length))
    .join("_");

  return action
    ? { ...tool, name: `${tool.name} · ${humanizeIdentifier(action)}` }
    : tool;
}

export function resolveTool(call: ToolCallEntry): Tool {
  const nestedSlugs = call.name === "COMPOSIO_MULTI_EXECUTE_TOOL"
    ? toolSlugs(call.args?.tools ?? call.args)
    : [];
  const identifier = nestedSlugs[0] ?? call.name;
  const catalogTool = catalogToolFor(identifier);

  if (catalogTool) {
    const resolved = toolWithAction(catalogTool, identifier);
    return nestedSlugs.length > 1
      ? { ...resolved, name: `${resolved.name} +${nestedSlugs.length - 1}` }
      : resolved;
  }

  return {
    ...ToolFunction,
    id: normalizeIdentifier(call.name) || ToolFunction.id,
    name: TOOL_LABELS[call.name] ?? humanizeIdentifier(call.name),
  };
}

export function toolCallState(status: ToolCallEntry["status"]): ToolCallState {
  if (status === "done") return "output-available";
  if (status === "error") return "output-error";
  return "input-available";
}

function clip(value: string): string {
  return value.length > 180 ? `${value.slice(0, 180)}...` : value;
}

const PRIVATE_ARGUMENT = /auth|cookie|credential|password|secret|token/i;

function argumentDetail(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const detail = argumentDetail(item);
      if (detail) return detail;
    }
    return undefined;
  }

  const item = recordValue(value);
  if (!item) return undefined;
  for (const [key, child] of Object.entries(item)) {
    if (PRIVATE_ARGUMENT.test(key) || /^(tool_?slug|slug)$/i.test(key)) continue;
    if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
      const text = clip(String(child).replace(/\s+/g, " ").trim());
      if (text) return `${humanizeIdentifier(key)}: ${text}`;
    } else {
      const detail = argumentDetail(child);
      if (detail) return detail;
    }
  }
  return undefined;
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

  if (
    (name === "COMPOSIO_SEARCH_TOOLS" || name === "webSearch") &&
    typeof (summary.args?.thought ?? summary.args?.query) === "string"
  ) {
    const query = String(summary.args?.thought ?? summary.args?.query);
    const action = name === "COMPOSIO_SEARCH_TOOLS" ? "Found tools" : "Searched";
    return `${action} for “${clip(query)}”`;
  }

  const slugs = toolSlugs(summary.args);
  const action = slugs.length
    ? `Ran ${slugs.map(humanizeIdentifier).join(", ")}`
    : `Used ${TOOL_LABELS[name] ?? humanizeIdentifier(name)}`;
  const detail = argumentDetail(summary.args);
  return detail ? `${action} — ${detail}` : action;
}

function toolCallSummary(call: ToolCallEntry): string {
  return formatToolSummary(
    call.name,
    call.summary ?? { type: "raw", args: call.args },
  );
}

const TOOL_CARD_CLASS_NAME = [
  "gap-0 py-0",
  "[&_[data-slot=card-header]]:items-center",
  "[&_[data-slot=card-header]]:px-3",
  "[&_[data-slot=card-header]]:py-3",
  "[&_[data-slot=card-header]>img]:size-7",
  "[&_[data-slot=card-content]]:px-3",
  "[&_[data-slot=card-content]]:pb-3",
  "[&_[data-slot=card-content]_pre]:mt-1",
  "[&_[data-slot=card-content]_pre]:max-h-32",
  "[&_[data-slot=card-footer]]:border-0",
  "[&_[data-slot=card-footer]]:px-3",
  "[&_[data-slot=card-footer]]:pb-3",
  "[&_[data-slot=card-footer]]:pt-0",
  "[&_[role=status]]:py-0.5",
].join(" ");

export function ToolCallLog({
  calls,
}: {
  calls: ToolCallEntry[];
}): React.ReactNode {
  if (calls.length === 0) {
    return (
      <p className="m-0 text-sm text-muted-foreground" role="status">
        Preparing tools…
      </p>
    );
  }

  return (
    <div aria-label="Tool calls" className="flex flex-col gap-2">
      {calls.map((call) => (
        <ToolCallCard
          className={TOOL_CARD_CLASS_NAME}
          errorText={call.error}
          footer={(
            <p className="m-0 line-clamp-2 text-sm text-muted-foreground">
              {toolCallSummary(call)}
            </p>
          )}
          key={call.id}
          state={toolCallState(call.status)}
          tool={resolveTool(call)}
        />
      ))}
    </div>
  );
}
