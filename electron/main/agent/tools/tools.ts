import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { tool, type FlexibleSchema, type Tool } from 'ai';

import fs from 'node:fs';
import path from 'node:path';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from '../config';
import {
	GetLibraryDocsArgs,
	QueryArgs,
	ReadFileArgs,
	ResolveLibraryArgs,
	type GetLibraryDocsArgs as GetLibraryDocsArguments,
	type QueryArgs as QueryArguments,
	type ReadFileArgs as ReadFileArguments,
	type ResolveLibraryArgs as ResolveLibraryArguments,
	type ToolSummary,
} from './shared-types';

type ToolArguments = Record<string, unknown>;
type McpServerSpec = { command: string; args: string[] };
type McpToolContent = { type: string; text?: string };
type ToolContext = { fff: Client; cwd: string };
type RegisteredTool = {
	name: string;
	description: string;
	inputSchema: FlexibleSchema<ToolArguments>;
	run(args: ToolArguments, context: ToolContext): string | Promise<string>;
};
type BuiltTool = Tool<ToolArguments, string>;

const registeredTools = new Map<string, RegisteredTool>();

async function callTool(client: Client, tool: string, args: ToolArguments): Promise<string> {
	const res = await client.callTool({ name: tool, arguments: args });
	const content = (res.content as McpToolContent[]) ?? [];
	return content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n');
}

async function mcpCall(spec: McpServerSpec, tool: string, args: ToolArguments): Promise<string> {
	const client = await openMcp(spec);
	try { return await callTool(client, tool, args); } finally { await client.close(); }
}

function findRepoRoot(cwd: string): string | undefined {
	let dir = path.resolve(cwd || process.cwd());
	for (; ;) {
		if (fs.existsSync(path.join(dir, '.git'))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

export function resolveReadPath(cwd: string, filePath: string): string {
	if (path.isAbsolute(filePath)) return filePath;
	const repoRoot = findRepoRoot(cwd);
	const bases = repoRoot ? [repoRoot, cwd] : [cwd];
	for (const base of bases) {
		const abs = path.resolve(base, filePath);
		if (fs.existsSync(abs)) return abs;
	}
	return path.resolve(cwd, filePath);
}

function readFileTool(cwd: string, args: ReadFileArguments): string {
	const abs = resolveReadPath(cwd, args.path);
	const lines = fs.readFileSync(abs, 'utf8').split('\n');
	const start = Math.max(1, args.startLine ?? 1);
	const end = Math.min(lines.length, args.endLine ?? start + 399);
	return lines.slice(start - 1, end).map((l, i) => `${start + i}: ${l}`).join('\n');
}

function preview(result?: string): string[] | undefined {
	const lines = result?.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 4);
	return lines?.length ? lines : undefined;
}

export function toolSummary(name: string, args: ToolArguments, result?: string): ToolSummary {
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
		const parsed = name === 'resolve_library_id' ? ResolveLibraryArgs.safeParse(args) : GetLibraryDocsArgs.safeParse(args);
		return parsed.success ? { type: 'library', ...parsed.data, preview: preview(result) } : { type: 'raw', args, preview: preview(result) };
	}
	return { type: 'raw', args, preview: preview(result) };
}

export async function openMcp(spec: McpServerSpec): Promise<Client> {
	const client = new Client({ name: 'viking', version: '0.1.0' });
	await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args }));
	return client;
}

export function registerTool(tool: RegisteredTool): RegisteredTool {
	registeredTools.set(tool.name, tool);
	return tool;
}

export function buildTools(fff: Client, cwd: string): Record<string, BuiltTool> {
	return Object.fromEntries([...registeredTools.values()].map(({ name, description, inputSchema }) => [name, tool({
		description,
		inputSchema,
		execute: args => runTool(name, args, fff, cwd),
	})]));
}

function runGrepCodebase(args: ToolArguments, context: ToolContext): Promise<string> {
	const { query }: QueryArguments = QueryArgs.parse(args);
	return callTool(context.fff, 'grep', { query });
}

function runFindFiles(args: ToolArguments, context: ToolContext): Promise<string> {
	const { query }: QueryArguments = QueryArgs.parse(args);
	return callTool(context.fff, 'find_files', { query });
}

function runReadFile(args: ToolArguments, context: ToolContext): string {
	const fileArgs: ReadFileArguments = ReadFileArgs.parse(args);
	return readFileTool(context.cwd, fileArgs);
}

function runResolveLibraryId(args: ToolArguments): Promise<string> {
	const { libraryName }: ResolveLibraryArguments = ResolveLibraryArgs.parse(args);
	return mcpCall(config.mcp.context7, 'resolve-library-id', { libraryName });
}

function runGetLibraryDocs(args: ToolArguments): Promise<string> {
	const { libraryId, topic }: GetLibraryDocsArguments = GetLibraryDocsArgs.parse(args);
	return mcpCall(config.mcp.context7, 'get-library-docs', {
		context7CompatibleLibraryID: libraryId, topic, tokens: 2000,
	});
}

registerTool({
	name: 'grep_codebase',
	description: "Search the user's codebase file contents. Query is a BARE identifier or literal substring — no regex. Prepend a constraint for scope: '*.ts query', 'src/ query', '!test/ query'.",
	inputSchema: QueryArgs,
	run: runGrepCodebase,
});

registerTool({
	name: 'find_files',
	description: "Fuzzy file-name search in the user's codebase. Keep query to 1-2 short terms; supports glob constraints e.g. 'name **/src/*.{ts,tsx}'.",
	inputSchema: QueryArgs,
	run: runFindFiles,
});

registerTool({
	name: 'read_file',
	description: "Read a file from the user's codebase. Prefer this after grep_codebase points to a definition. Returns the requested line range (defaults to whole file, capped at 400 lines).",
	inputSchema: ReadFileArgs,
	run: runReadFile,
});

registerTool({
	name: 'resolve_library_id',
	description: "REQUIRED before get_library_docs. Resolve a plain library name (e.g. 'react', 'zod') to the context7 library id.",
	inputSchema: ResolveLibraryArgs,
	run: runResolveLibraryId,
});

registerTool({
	name: 'get_library_docs',
	description: "Fetch docs for a topic. libraryId MUST be from resolve_library_id (format '/org/lib' or '/org/lib/version'). Never pass a bare name.",
	inputSchema: GetLibraryDocsArgs,
	run: runGetLibraryDocs,
});

export async function runTool(name: string, args: ToolArguments, fff: Client, cwd: string): Promise<string> {
	const registered = registeredTools.get(name);
	if (!registered) throw new Error(`unknown tool: ${name}`);
	return registered.run(args, { fff, cwd });
}
