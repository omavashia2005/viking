import fs from 'node:fs';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from './config';
import { Context, LLMResponse, type LaunchArgs, type Option } from './shared-types';
import { prompts } from './prompts';

async function openMcp(spec: { command: string; args: string[] }): Promise<Client> {
  const client = new Client({ name: 'viking', version: '0.1.0' });
  await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args }));
  return client;
}

async function callTool(client: Client, tool: string, args: Record<string, unknown>): Promise<string> {
  const res = await client.callTool({ name: tool, arguments: args });
  const content = (res.content as Array<{ type: string; text?: string }>) ?? [];
  return content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n');
}

async function mcpCall(spec: { command: string; args: string[] }, tool: string, args: Record<string, unknown>): Promise<string> {
  const client = await openMcp(spec);
  try { return await callTool(client, tool, args); } finally { await client.close(); }
}

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'grep_codebase',
      description: "Search the user's codebase file contents. Query is a BARE identifier or literal substring — no regex. Prepend a constraint for scope: '*.ts query', 'src/ query', '!test/ query'.",
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_files',
      description: "Fuzzy file-name search in the user's codebase. Keep query to 1-2 short terms; supports glob constraints e.g. 'name **/src/*.{ts,tsx}'.",
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
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
    },
  },
  {
    type: 'function',
    function: {
      name: 'resolve_library_id',
      description: "REQUIRED before get_library_docs. Resolve a plain library name (e.g. 'react', 'zod') to the context7 library id.",
      parameters: {
        type: 'object',
        properties: { libraryName: { type: 'string' } },
        required: ['libraryName'],
      },
    },
  },
  {
    type: 'function',
    function: {
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
    },
  },
];

function readFileTool(cwd: string, args: { path: string; startLine?: number; endLine?: number }): string {
  const abs = args.path.startsWith('/') ? args.path : `${cwd.replace(/\/$/, '')}/${args.path}`;
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const start = Math.max(1, args.startLine ?? 1);
  const end = Math.min(lines.length, args.endLine ?? start + 399);
  return lines.slice(start - 1, end).map((l, i) => `${start + i}: ${l}`).join('\n');
}

async function runTool(name: string, args: Record<string, any>, fff: Client, cwd: string): Promise<string> {
  try {
    if (name === 'grep_codebase')      return await callTool(fff, 'grep',       { query: args.query });
    if (name === 'find_files')         return await callTool(fff, 'find_files', { query: args.query });
    if (name === 'read_file')          return readFileTool(cwd, args as any);
    if (name === 'resolve_library_id') return await mcpCall(config.mcp.context7, 'resolve-library-id', { libraryName: args.libraryName });
    if (name === 'get_library_docs')   return await mcpCall(config.mcp.context7, 'get-library-docs', {
      context7CompatibleLibraryID: args.libraryId, topic: args.topic, tokens: 2000,
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
  console.log('[viking:llm] query', { model: config.llm.model, cwd, activeFile: launch?.activeFile, hasScreenshot: !!screenshot, prompt: prompts.user(ctx) });

  // One persistent fff-mcp for the whole call — first spawn scans async (~50ms), reused calls hit the warm index.
  const fff = await openMcp({ command: config.mcp.fff.command, args: [cwd] });
  await new Promise(r => setTimeout(r, 250)); // ponytail: let fff finish its initial scan; drop when fff signals "ready".
  try {
    // ponytail: cap the tool-call loop at 5 rounds; raise if the model regularly hits the ceiling.
    for (let i = 0; i < 8; i++) {
      const res = await client.chat.completions.create({
        model: config.llm.model,
        messages,
        tools: TOOLS,
        response_format: zodResponseFormat(LLMResponse, 'options'),
      });
      const msg = res.choices[0].message;
      messages.push(msg);
      if (!msg.tool_calls?.length) {
        const options = LLMResponse.parse(JSON.parse(msg.content ?? '{}')).options;
        console.log(`[viking:llm] final rounds=${i + 1} options=${options.length}`);
        options.forEach((o, idx) => console.log(`  [${idx}] ${o.label} (${o.language}) → ${o.file}`));
        return options;
      }
      for (const call of msg.tool_calls) {
        const args = JSON.parse(call.function.arguments || '{}');
        console.log(`[viking:llm] tool r${i + 1} → ${call.function.name}`, args);
        const result = await runTool(call.function.name, args, fff, cwd);
        console.log(`[viking:llm] tool r${i + 1} ← ${call.function.name}`, result.slice(0, 400) + (result.length > 400 ? `… (${result.length}b)` : ''));
        messages.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
    }
    throw new Error('LLM kept calling tools past the 5-round cap');
  } finally {
    await fff.close();
  }
}
