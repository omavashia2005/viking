import fs from 'node:fs';
import path from 'node:path';
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
import {
	buildTools,
	callMcp,
	type RegisteredTool,
	type ToolArguments,
	type ToolContext,
} from '../tools/utils';

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
		const absolutePath = path.resolve(base, filePath);
		if (fs.existsSync(absolutePath)) return absolutePath;
	}
	return path.resolve(cwd, filePath);
}

function readFile(cwd: string, args: ReadFileArguments): string {
	const absolutePath = resolveReadPath(cwd, args.path);
	const lines = fs.readFileSync(absolutePath, 'utf8').split('\n');
	const start = Math.max(1, args.startLine ?? 1);
	const end = Math.min(lines.length, args.endLine ?? start + 399);
	return lines.slice(start - 1, end).map((line, index) => `${start + index}: ${line}`).join('\n');
}

function preview(result?: unknown): string[] | undefined {
	if (typeof result !== 'string') return undefined;
	const lines = result.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 4);
	return lines.length ? lines : undefined;
}

export function toolSummary(name: string, args: ToolArguments, result?: unknown): ToolSummary {
	const previewLines = preview(result);
	let summary: ToolSummary = { type: 'raw', args, preview: previewLines };

	if (name === 'grep_codebase' || name === 'find_files') {
		const parsed = QueryArgs.safeParse(args);
		if (parsed.success) {
			summary = {
				type: 'search',
				query: parsed.data.query,
				preview: previewLines,
				lineCount: typeof result === 'string' ? result.split('\n').filter(Boolean).length : undefined,
			};
		}
		return summary;
	}

	if (name === 'read_file') {
		const parsed = ReadFileArgs.safeParse(args);
		if (parsed.success) summary = { type: 'read_file', ...parsed.data };
		return summary;
	}

	if (name === 'resolve_library_id' || name === 'get_library_docs') {
		const parsed = name === 'resolve_library_id' ? ResolveLibraryArgs.safeParse(args) : GetLibraryDocsArgs.safeParse(args);
		if (parsed.success) summary = { type: 'library', ...parsed.data, preview: previewLines };
		return summary;
	}

	return summary;
}

async function runGrepCodebase(args: ToolArguments, context: ToolContext): Promise<string> {
	const { query }: QueryArguments = QueryArgs.parse(args);
	return callMcp('fff', context.cwd, 'grep', { query });
}

async function runFindFiles(args: ToolArguments, context: ToolContext): Promise<string> {
	const { query }: QueryArguments = QueryArgs.parse(args);
	return callMcp('fff', context.cwd, 'find_files', { query });
}

function runReadFile(args: ToolArguments, context: ToolContext): string {
	return readFile(context.cwd, ReadFileArgs.parse(args));
}

async function runResolveLibraryId(args: ToolArguments, context: ToolContext): Promise<string> {
	const { libraryName }: ResolveLibraryArguments = ResolveLibraryArgs.parse(args);
	return callMcp('context7', context.cwd, 'resolve-library-id', { libraryName });
}

async function runGetLibraryDocs(args: ToolArguments, context: ToolContext): Promise<string> {
	const { libraryId, topic }: GetLibraryDocsArguments = GetLibraryDocsArgs.parse(args);
	return callMcp('context7', context.cwd, 'get-library-docs', {
		context7CompatibleLibraryID: libraryId,
		topic,
		tokens: 2000,
	});
}

const codeTools: RegisteredTool[] = [
	{
		name: 'grep_codebase',
		description: "Search the user's codebase file contents. Query is a BARE identifier or literal substring — no regex. Prepend a constraint for scope: '*.ts query', 'src/ query', '!test/ query'.",
		inputSchema: QueryArgs,
		run: runGrepCodebase,
	},
	{
		name: 'find_files',
		description: "Fuzzy file-name search in the user's codebase. Keep query to 1-2 short terms; supports glob constraints e.g. 'name **/src/*.{ts,tsx}'.",
		inputSchema: QueryArgs,
		run: runFindFiles,
	},
	{
		name: 'read_file',
		description: "Read a file from the user's codebase. Prefer this after grep_codebase points to a definition. Returns the requested line range (defaults to whole file, capped at 400 lines).",
		inputSchema: ReadFileArgs,
		run: runReadFile,
	},
	{
		name: 'resolve_library_id',
		description: "REQUIRED before get_library_docs. Resolve a plain library name (e.g. 'react', 'zod') to the context7 library id.",
		inputSchema: ResolveLibraryArgs,
		run: runResolveLibraryId,
	},
	{
		name: 'get_library_docs',
		description: "Fetch docs for a topic. libraryId MUST be from resolve_library_id (format '/org/lib' or '/org/lib/version'). Never pass a bare name.",
		inputSchema: GetLibraryDocsArgs,
		run: runGetLibraryDocs,
	},
];

export const buildCodeTools = (cwd: string) => buildTools(codeTools, cwd);
