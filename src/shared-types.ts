import { z } from 'zod';

export const Context = z.object({
  userPrompt: z.string().optional(),
  language: z.string(),
  docs: z.string().default(''),
  codebase: z.string().default(''),
  screenshot: z.string().optional(),
});
export type Context = z.infer<typeof Context>;

export const Option = z.object({
  label: z.string(),    // 1-3 word approach name
  language: z.string(), // hljs-style lang id: "typescript", "python", "rust", etc.
  code: z.string(),
  file: z.string(),     // path where this snippet belongs; default to the active file if unsure
  startLine: z.number().int().min(1).optional(), // 1-based line in `file` where the snippet is inserted
});
export type Option = z.infer<typeof Option>;

export const LLMResponse = z.object({ options: z.array(Option).min(1).max(6) });
export type LLMResponse = z.infer<typeof LLMResponse>;

export const LaunchArgs = z.object({
  cwd: z.string().optional(),
  activeFile: z.string().optional(),
});
export type LaunchArgs = z.infer<typeof LaunchArgs>;

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
