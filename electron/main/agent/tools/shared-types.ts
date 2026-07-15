import { z } from 'zod';

export const ToolOutput = z.string();

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

export const ToolProgress = z.object({
	id: z.string(),
	name: z.string(),
	status: z.enum(['running', 'done', 'error']),
	args: z.record(z.unknown()).optional(),
	summary: ToolSummary.optional(),
	error: z.string().optional(),
});
export type ToolProgress = z.infer<typeof ToolProgress>;
