import { z } from 'zod';

export const CodeLanguage = z.enum([
	'rust',
	'javascript',
	'js',
	'python',
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

export const ReasoningProgress = z.object({
	id: z.number().int().nonnegative(),
	text: z.string().min(1),
});
export type ReasoningProgress = z.infer<typeof ReasoningProgress>;
