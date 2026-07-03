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
