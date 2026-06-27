import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from './config';
import { Context, LLMResponse, type Option } from './shared-types';
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

// ponytail: best-effort context fetch. Each side fails soft to empty string so one bad MCP doesn't kill the call.
async function gatherContext(userPrompt: string | undefined, screenshot: string | undefined): Promise<Context> {
  const language = config.defaultLanguage;
  const grepTerms = (userPrompt ?? '').match(/[A-Za-z_][A-Za-z0-9_]{2,}/g)?.slice(0, 3) ?? [];

  const [docs, codebase] = await Promise.all([
    mcpCall(config.mcp.context7, 'get-library-docs', {
      context7CompatibleLibraryID: config.defaultLibrary,
      tokens: 2000,
      topic: userPrompt ?? '',
    }).catch(() => ''),
    grepTerms.length
      ? mcpCall(config.mcp.fff, 'multi_grep', { patterns: grepTerms, path: config.cwd }).catch(() => '')
      : Promise.resolve(''),
  ]);

  return { userPrompt, language, docs, codebase, screenshot };
}

export async function generate(userPrompt: string | undefined, screenshot: string | undefined): Promise<Option[]> {
  const ctx = await gatherContext(userPrompt, screenshot);
  const client = new OpenAI({ baseURL: config.llm.baseURL, apiKey: config.llm.apiKey });

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: 'text', text: prompts.user(ctx) }];
  if (screenshot) userContent.push({ type: 'image_url', image_url: { url: screenshot } });

  const res = await client.chat.completions.create({
    model: config.llm.model,
    messages: [
      { role: 'system', content: prompts.system },
      { role: 'user', content: userContent },
    ],
    response_format: zodResponseFormat(LLMResponse, 'options'),
  });

  const parsed = LLMResponse.parse(JSON.parse(res.choices[0].message.content ?? '{}'));
  return parsed.options;
}
