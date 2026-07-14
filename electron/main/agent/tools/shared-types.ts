import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';

export type ToolContext = { fff: Client; cwd: string };

export interface ToolParameters {
  type: string;
  properties?: Record<string, ToolParameters>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
}

export enum ToolTypes {
  Function = 'function',
}

export interface Tools {
  type: ToolTypes.Function;
  function: {
    name: string;
    description: string;
    parameters: ToolParameters;
  };
}

export interface RegisteredFunctionTool<ToolContext> {
  type: ToolTypes.Function;
  name: string;
  description: string;
  parameters: ToolParameters;
  run(args: Record<string, any>, context: ToolContext): string | Promise<string>;
}

export type RegisteredTool<ToolContext> = RegisteredFunctionTool<ToolContext>;

export const QueryArgs = z.object({ query: z.string() }).passthrough();

export const ReadFileArgs = z.object({
  path: z.string(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
}).passthrough();

export const LibraryArgs = z.object({ libraryName: z.string().optional(), libraryId: z.string().optional(), topic: z.string().optional() }).passthrough();

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
