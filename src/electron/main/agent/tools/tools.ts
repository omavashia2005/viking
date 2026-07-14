import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import fs from 'node:fs';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from '../config';
import { ToolTypes, type Tools, type RegisteredTool , ToolContext, LibraryArgs, ReadFileArgs, QueryArgs,  ToolSummary} from './shared-types';

const registeredTools = new Map<string, RegisteredTool<ToolContext>>();

async function callTool(client: Client, tool: string, args: Record<string, unknown>): Promise<string> {
  const res = await client.callTool({ name: tool, arguments: args });
  const content = (res.content as Array<{ type: string; text?: string }>) ?? [];
  return content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n');
}


async function mcpCall(spec: { command: string; args: string[] }, tool: string, args: Record<string, unknown>): Promise<string> {
  const client = await openMcp(spec);
  try { return await callTool(client, tool, args); } finally { await client.close(); }
}


function readFileTool(cwd: string, args: { path: string; startLine?: number; endLine?: number }): string {
  const abs = args.path.startsWith('/') ? args.path : `${cwd.replace(/\/$/, '')}/${args.path}`;
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const start = Math.max(1, args.startLine ?? 1);
  const end = Math.min(lines.length, args.endLine ?? start + 399);
  return lines.slice(start - 1, end).map((l, i) => `${start + i}: ${l}`).join('\n');
}


function preview(result?: string): string[] | undefined {
  const lines = result?.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 4);
  return lines?.length ? lines : undefined;
}

export function toolSummary(name: string, args: Record<string, unknown>, result?: string): ToolSummary {
  if (name === 'grep_codebase' || name === 'find_files') {
    const parsed = QueryArgs.safeParse(args);
    return parsed.success
      ? { type: 'search', query: parsed.data.query, preview: preview(result), lineCount: result?.split('\n').filter(Boolean).length }
      : { type: 'raw', args, preview: preview(result) };
  }
  if (name === 'read_file') {
    const parsed = ReadFileArgs.safeParse(args);
    return parsed.success ? { type: 'read_file', ...parsed.data } : { type: 'raw', args, preview: preview(result) };
  }
  if (name === 'resolve_library_id' || name === 'get_library_docs') {
    const parsed = LibraryArgs.safeParse(args);
    return parsed.success ? { type: 'library', ...parsed.data, preview: preview(result) } : { type: 'raw', args, preview: preview(result) };
  }
  return { type: 'raw', args, preview: preview(result) };
}

export async function openMcp(spec: { command: string; args: string[] }): Promise<Client> {
	const client = new Client({ name: 'viking', version: '0.1.0' });
	await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args }));
	return client;
}

export function registerTool(tool: RegisteredTool<ToolContext>): RegisteredTool<ToolContext> {
  registeredTools.set(tool.name, tool);
  return tool;
}

export function buildTools(): Tools[] {
  return [...registeredTools.values()].map(({ type, name, description, parameters }) => ({
    type,
    function: { name, description, parameters },
  }));
}

registerTool({
  type: ToolTypes.Function,
  name: 'grep_codebase',
  description: "Search the user's codebase file contents. Query is a BARE identifier or literal substring — no regex. Prepend a constraint for scope: '*.ts query', 'src/ query', '!test/ query'.",
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  run: (args, { fff }) => callTool(fff, 'grep', { query: args.query }),
});

registerTool({
  type: ToolTypes.Function,
  name: 'find_files',
  description: "Fuzzy file-name search in the user's codebase. Keep query to 1-2 short terms; supports glob constraints e.g. 'name **/src/*.{ts,tsx}'.",
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  run: (args, { fff }) => callTool(fff, 'find_files', { query: args.query }),
});

registerTool({
  type: ToolTypes.Function,
  name: 'read_file',
  description: "Read a file from the user's codebase. Prefer this after grep_codebase points to a definition. Returns the requested line range (defaults to whole file, capped at 400 lines).",
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or repo-relative path.' },
      startLine: { type: 'number' },
      endLine: { type: 'number' },
    },
    required: ['path'],
  },
  run: (args, { cwd }) => readFileTool(cwd, args as any),
});

registerTool({
  type: ToolTypes.Function,
  name: 'resolve_library_id',
  description: "REQUIRED before get_library_docs. Resolve a plain library name (e.g. 'react', 'zod') to the context7 library id.",
  parameters: {
    type: 'object',
    properties: { libraryName: { type: 'string' } },
    required: ['libraryName'],
  },
  run: args => mcpCall(config.mcp.context7, 'resolve-library-id', { libraryName: args.libraryName }),
});

registerTool({
  type: ToolTypes.Function,
  name: 'get_library_docs',
  description: "Fetch docs for a topic. libraryId MUST be from resolve_library_id (format '/org/lib' or '/org/lib/version'). Never pass a bare name.",
  parameters: {
    type: 'object',
    properties: {
      libraryId: { type: 'string' },
      topic: { type: 'string' },
    },
    required: ['libraryId', 'topic'],
  },
  run: args => mcpCall(config.mcp.context7, 'get-library-docs', {
    context7CompatibleLibraryID: args.libraryId, topic: args.topic, tokens: 2000,
  }),
});

export async function runTool(name: string, args: Record<string, any>, fff: Client, cwd: string): Promise<string> {
  try {
    const tool = registeredTools.get(name);
    return tool ? await tool.run(args, { fff, cwd }) : `unknown tool: ${name}`;
  } catch (e) { return `error: ${(e as Error).message}`; }
}
