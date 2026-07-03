import fs from 'node:fs';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from './config';
import { Context, LLMResponse, type LaunchArgs, type Option } from './shared-types';
import { prompts } from './prompts';

async function mcpCall(spec: { command: string; args: string[] }, tool: string, args: Record<string, unknown>): Promise<string> {
  const client = new Client({ name: 'viking', version: '0.1.0' });
  const transport = new StdioClientTransport({ command: spec.command, args: spec.args });
  await client.connect(transport);
  try {
    const res = await client.callTool({ name: tool, arguments: args });
    const content = (res.content as Array<{ type: string; text?: string }>) ?? [];
    return content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n');
  } finally {
    await client.close();
  }
}

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'grep_codebase',
      description: "Search the user's codebase for a bare identifier or short substring. Returns matching lines with file paths.",
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Bare identifier or literal substring; not a regex.' },
          path: { type: 'string', description: 'Optional subpath; defaults to project root.' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_files',
      description: "Find files in the user's codebase by name or fragment.",
      parameters: {
        type: 'object',
        properties: { pattern: { type: 'string' } },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_library_docs',
      description: 'Fetch documentation snippets for a library on a specific topic.',
      parameters: {
        type: 'object',
        properties: {
          library: { type: 'string', description: 'context7 library id, e.g. microsoft/typescript' },
          topic: { type: 'string' },
        },
        required: ['library', 'topic'],
      },
    },
  },
];

// ponytail: mcpCall reconnects every tool call (~300ms spawn cost). Cache a persistent client per (spec, generate-call) if latency bites.
async function runTool(name: string, args: Record<string, any>, cwd: string): Promise<string> {
  try {
    if (name === 'grep_codebase') return await mcpCall(config.mcp.fff, 'grep', { pattern: args.pattern, path: args.path ?? cwd });
    if (name === 'find_files')    return await mcpCall(config.mcp.fff, 'find_files', { pattern: args.pattern, path: cwd });
    if (name === 'get_library_docs') return await mcpCall(config.mcp.context7, 'get-library-docs', {
      context7CompatibleLibraryID: args.library, topic: args.topic, tokens: 2000,
    });
    return `unknown tool: ${name}`;
  } catch (e) { return `error: ${(e as Error).message}`; }
}

function seedContext(launch: LaunchArgs | undefined): { cwd: string; activeFileSnippet: string } {
  const cwd = launch?.cwd || config.cwd;
  let snippet = '';
  if (launch?.activeFile) {
    try { snippet = fs.readFileSync(launch.activeFile, 'utf8').split('\n').slice(0, 200).join('\n'); } catch {}
  }
  return { cwd, activeFileSnippet: snippet };
}

export async function generate(userPrompt: string | undefined, screenshot: string | undefined, launch?: LaunchArgs): Promise<Option[]> {
  const { cwd, activeFileSnippet } = seedContext(launch);
  const client = new OpenAI({ baseURL: config.llm.baseURL, apiKey: config.llm.apiKey });

  const ctx: Context = {
    userPrompt,
    language: config.defaultLanguage,
    docs: '',
    codebase: activeFileSnippet ? `Active file (${launch?.activeFile}), lines 1-200:\n${activeFileSnippet}` : '',
    screenshot,
  };
  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: 'text', text: prompts.user(ctx) }];
  if (screenshot) userContent.push({ type: 'image_url', image_url: { url: screenshot } });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: prompts.system },
    { role: 'user', content: userContent },
  ];

  // ponytail: cap the tool-call loop at 5 rounds; raise if the model regularly hits the ceiling.
  for (let i = 0; i < 5; i++) {
    const res = await client.chat.completions.create({
      model: config.llm.model,
      messages,
      tools: TOOLS,
      response_format: zodResponseFormat(LLMResponse, 'options'),
    });
    const msg = res.choices[0].message;
    messages.push(msg);
    if (!msg.tool_calls?.length) {
      return LLMResponse.parse(JSON.parse(msg.content ?? '{}')).options;
    }
    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments || '{}');
      const result = await runTool(call.function.name, args, cwd);
      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }
  }
  throw new Error('LLM kept calling tools past the 5-round cap');
}
