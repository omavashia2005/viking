import fs from 'node:fs';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { config } from './config';
import { LLMResponse, type Option } from './shared-types';
import { prompts, type Context } from './prompts';
import { buildTools, openMcp, runTool, toolSummary } from './tools/tools';
import type { ToolProgress } from './tools/shared-types';

// ponytail: cap schema-parse retries at 3; raise if models regularly need more nudges to produce valid JSON.
const MAX_SCHEMA_RETRIES = 3;

export type LaunchArgs = { cwd?: string; activeFile?: string };
type SeedContextResult = { cwd: string; activeFileSnippet: string };
type GenerateToolProgressCallback = (event: ToolProgress) => void;
type LLMResult = { options: Option[]; softError?: string };
type userInput = {
	userPrompt: string;
	screenshot: string;
	launch?: LaunchArgs;
	onTool?: GenerateToolProgressCallback;
};

export const TOOLS: OpenAI.Chat.ChatCompletionTool[] = buildTools();

function seedContext(launch: LaunchArgs | undefined): SeedContextResult {
	const cwd = launch?.cwd || config.cwd;
	let snippet = '';
	if (launch?.activeFile) {
		try { snippet = fs.readFileSync(launch.activeFile, 'utf8').split('\n').slice(0, 200).join('\n'); } catch { }
	}
	return { cwd, activeFileSnippet: snippet };
}

export async function generate(input: userInput): Promise<LLMResult> {
	const { userPrompt, screenshot, launch, onTool } = input;
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
	let schemaRetries = 0;
	let lastSchemaErr = '';
	let rounds = 0;
	try {
		for (; ;) {
			rounds++;
			const res = await client.chat.completions.create({
				model: config.llm.model,
				messages,
				tools: TOOLS,
				response_format: zodResponseFormat(LLMResponse, 'options'),
			});
			const msg = res.choices[0].message;
			messages.push(msg);
			if (!msg.tool_calls?.length) {
				try {
					const options = LLMResponse.parse(JSON.parse(typeof msg.content === 'string' ? msg.content : '{}')).options;
					console.log(`[viking:llm] final rounds=${rounds} options=${options.length}`);
					options.forEach((o, idx) => console.log(`  [${idx}] ${o.label} (${o.language}) → ${o.file}`));
					return { options };
				} catch (e) {
					lastSchemaErr = (e as Error).message;
					schemaRetries++;
					console.log('[viking:llm] schema retry', schemaRetries, lastSchemaErr);
					if (schemaRetries >= MAX_SCHEMA_RETRIES) {
						return { options: [], softError: `schema validation failed after ${MAX_SCHEMA_RETRIES} retries: ${lastSchemaErr}` };
					}
					messages.push({ role: 'user', content: `Your last response failed JSON schema validation: ${lastSchemaErr}. Return only JSON matching the provided schema — no prose.` });
				}
				continue;
			}
			for (const call of msg.tool_calls) {
				let args: Record<string, any>;
				try {
					args = JSON.parse(call.function.arguments || '{}');
				} catch (e) {
					const errMsg = `error: invalid JSON in tool arguments: ${(e as Error).message}`;
					console.log(`[viking:llm] tool r${rounds} → ${call.function.name} [bad args]`, call.function.arguments);
					onTool?.({ id: call.id, name: call.function.name, status: 'error', error: errMsg });
					messages.push({ role: 'tool', tool_call_id: call.id, content: errMsg });
					continue;
				}
				console.log(`[viking:llm] tool r${rounds} → ${call.function.name}`, args);
				onTool?.({ id: call.id, name: call.function.name, status: 'running', args, summary: toolSummary(call.function.name, args) });
				const result = await runTool(call.function.name, args, fff, cwd);
				console.log(`[viking:llm] tool r${rounds} ← ${call.function.name}`, result.slice(0, 400) + (result.length > 400 ? `… (${result.length}b)` : ''));
				const failed = result.startsWith('error:');
				onTool?.({ id: call.id, name: call.function.name, status: failed ? 'error' : 'done', summary: failed ? undefined : toolSummary(call.function.name, args, result), error: failed ? result : undefined });
				messages.push({ role: 'tool', tool_call_id: call.id, content: result });
			}
		}
	} finally {
		await fff.close();
	}
}
