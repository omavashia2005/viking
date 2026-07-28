import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  formatToolSummary,
  resolveTool,
  ToolCallLog,
  toolCallState,
} from "./ToolCallLog";

assert.equal(toolCallState("running"), "input-available");
assert.equal(toolCallState("done"), "output-available");
assert.equal(toolCallState("error"), "output-error");

assert.equal(
  resolveTool({
    id: "read",
    name: "read_file",
    status: "running",
    args: { path: "src/app.ts" },
  }).name,
  "Read file",
);

const exaTool = resolveTool({
  id: "search",
  name: "COMPOSIO_MULTI_EXECUTE_TOOL",
  status: "running",
  args: {
    tools: [{ tool_slug: "EXA_SEARCH", arguments: { query: "AI news" } }],
  },
});
assert.equal(exaTool.id, "exa");
assert.match(exaTool.name, /^Exa/);

assert.equal(
  formatToolSummary("grep_codebase", {
    type: "search",
    query: "ToolCallLog",
    lineCount: 2,
  }),
  "Searched for “ToolCallLog” (2 lines)",
);

assert.equal(
  formatToolSummary("COMPOSIO_MULTI_EXECUTE_TOOL", {
    type: "raw",
    args: {
      tools: [{
        tool_slug: "EXA_SEARCH",
        arguments: { query: "AI news", limit: 5 },
      }],
    },
  }),
  "Ran Exa Search — Query: AI news",
);

const html = renderToStaticMarkup(
  <ToolCallLog
    calls={[
      {
        id: "running",
        name: "COMPOSIO_SEARCH_TOOLS",
        status: "running",
        args: { thought: "Find a web search tool" },
        summary: {
          type: "raw",
          args: { thought: "Find a web search tool" },
        },
      },
      {
        id: "done",
        name: "grep_codebase",
        status: "done",
        args: { query: "ToolCallLog" },
        summary: {
          type: "search",
          query: "ToolCallLog",
          lineCount: 2,
        },
      },
      {
        id: "error",
        name: "read_file",
        status: "error",
        args: { path: "missing.ts" },
        error: "File not found",
      },
    ]}
  />,
);

assert.match(html, /data-state="input-available"/);
assert.match(html, /data-state="output-available"/);
assert.match(html, /data-state="output-error"/);
assert.match(html, />Find tools</);
assert.match(html, />Search codebase</);
assert.match(html, /Found tools for “Find a web search tool”/);
assert.match(html, /Searched for “ToolCallLog” \(2 lines\)/);
assert.match(html, /Used Read file — Path: missing.ts/);
assert.match(html, /File not found/);
assert.doesNotMatch(html, />Input</);
assert.doesNotMatch(html, />Output</);
assert.doesNotMatch(html, /&quot;thought&quot;/);
