import { z } from 'zod';
import { ToolProgress as SharedToolProgress } from '../shared-types';

export const CodeLanguage = z.enum([
	'rust',
	'javascript',
	'js',
	'python',
	'lua',
	'py',
	'c',
	'cpp',
	'c++',
	'java',
	'go',
	'typescript',
	'ts',
	'text',
	'plaintext',
]);
export type CodeLanguage = z.infer<typeof CodeLanguage>;

export const Option = z.object({
	label: z.string(),    // 1-3 word approach name
	language: z.string(), // hljs-style lang id: "typescript", "python", "rust", etc.
	code: z.string(),
	file: z.string(),     // path where this snippet belongs; default to the active file if unsure
	startLine: z.number().int().min(1).nullable().transform(line => line ?? undefined), // 1-based line in `file` where the snippet is inserted
});
export type Option = z.infer<typeof Option>;

export const LLMResponse = z.object({ options: z.array(Option).min(1) });
export type LLMResponse = z.infer<typeof LLMResponse>;

export const QueryArgs = z.object({ query: z.string() }).passthrough();
export type QueryArgs = z.infer<typeof QueryArgs>;

export const ReadFileArgs = z.object({
	path: z.string(),
	startLine: z.number().optional(),
	endLine: z.number().optional(),
}).passthrough();
export type ReadFileArgs = z.infer<typeof ReadFileArgs>;

export const ResolveLibraryArgs = z.object({ libraryName: z.string() });
export type ResolveLibraryArgs = z.infer<typeof ResolveLibraryArgs>;

export const GetLibraryDocsArgs = z.object({ libraryId: z.string(), topic: z.string() });
export type GetLibraryDocsArgs = z.infer<typeof GetLibraryDocsArgs>;

export const ToolSummary = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('search'),
		query: z.string(),
		preview: z.array(z.string()).optional(),
		lineCount: z.number().int().nonnegative().optional(),
	}),
	z.object({
		type: z.literal('read_file'),
		path: z.string(),
		startLine: z.number().optional(),
		endLine: z.number().optional(),
	}),
	z.object({
		type: z.literal('library'),
		libraryName: z.string().optional(),
		libraryId: z.string().optional(),
		topic: z.string().optional(),
		preview: z.array(z.string()).optional(),
	}),
	z.object({
		type: z.literal('raw'),
		args: z.record(z.unknown()).optional(),
		preview: z.array(z.string()).optional(),
	}),
]);
export type ToolSummary = z.infer<typeof ToolSummary>;

export const ToolProgress = SharedToolProgress.extend({ summary: ToolSummary.optional() });
export type ToolProgress = z.infer<typeof ToolProgress>;

export const FindRepoRootParams = z.object({ cwd: z.string() });
export type FindRepoRootParams = z.infer<typeof FindRepoRootParams>;

export const FindRepoRootResult = z.object({ path: z.string() }).optional();
export type FindRepoRootResult = z.infer<typeof FindRepoRootResult>;

export const ResolveReadPathParams = z.object({
	cwd: z.string(),
	filePath: z.string(),
});
export type ResolveReadPathParams = z.infer<typeof ResolveReadPathParams>;

export const ResolveReadPathResult = z.object({ absolutePath: z.string() });
export type ResolveReadPathResult = z.infer<typeof ResolveReadPathResult>;

export const ReadFileParams = z.object({
	cwd: z.string(),
	args: ReadFileArgs,
});
export type ReadFileParams = z.infer<typeof ReadFileParams>;

export const TextToolResult = z.object({ content: z.string() });
export type TextToolResult = z.infer<typeof TextToolResult>;

export const PreviewLines = z.array(z.string()).optional();
export type PreviewLines = z.infer<typeof PreviewLines>;
