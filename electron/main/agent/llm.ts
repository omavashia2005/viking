import fs from 'node:fs';
import { createGateway, generateText, isLoopFinished, NoObjectGeneratedError, Output, type UserContent } from 'ai';
import { config } from './config';
import { LLMResponse, type Option, type ReasoningProgress } from './shared-types';
import { prompts, type Context } from './prompts';
import { buildTools, openMcp, toolSummary } from './tools/tools';
import { ToolOutput, type ToolProgress } from './tools/shared-types';

export type LaunchArgs = { cwd?: string; activeFile?: string };
type SeedContextResult = { cwd: string; activeFileSnippet: string };
type GenerateToolProgressCallback = (event: ToolProgress) => void;
type GenerateReasoningProgressCallback = (event: ReasoningProgress) => void;
type LLMResult = { options: Option[]; reasoning?: string; softError?: string };
type userInput = {
	userPrompt: string;
	screenshot: string;
	launch?: LaunchArgs;
	onTool?: GenerateToolProgressCallback;
	onReasoning?: GenerateReasoningProgressCallback;
};

function seedContext(launch: LaunchArgs | undefined): SeedContextResult {
	const cwd = launch?.cwd || config.cwd;
	let snippet = '';
	if (launch?.activeFile) {
		try { snippet = fs.readFileSync(launch.activeFile, 'utf8').split('\n').slice(0, 200).join('\n'); } catch { }
	}
	return { cwd, activeFileSnippet: snippet };
}

export async function generate(input: userInput): Promise<LLMResult> {
	const { userPrompt, screenshot, launch, onTool, onReasoning } = input;
	const { cwd, activeFileSnippet } = seedContext(launch);
	const model = createGateway({ apiKey: config.llm.apiKey })(config.llm.model);

	const ctx: Context = {
		userPrompt,
		language: config.defaultLanguage,
		docs: '',
		codebase: activeFileSnippet ? `Active file (${launch?.activeFile}), lines 1-200:\n${activeFileSnippet}` : '',
		screenshot,
	};

	const userContent: UserContent = [{ type: 'text', text: prompts.user(ctx) }];

	if (screenshot) userContent.push({ type: 'file', mediaType: 'image/jpeg', data: screenshot });
	console.log('[viking:llm] query', { model: config.llm.model, cwd, activeFile: launch?.activeFile, hasScreenshot: !!screenshot, prompt: prompts.user(ctx) });

	// One persistent fff-mcp for the whole call — first spawn scans async (~50ms), reused calls hit the warm index.
	const fff = await openMcp({ command: config.mcp.fff.command, args: [cwd] });
	await new Promise(r => setTimeout(r, 250)); // ponytail: let fff finish its initial scan; drop when fff signals "ready".
	let reasoningStep = 0;
	try {
		const result = await generateText({
			model,
			instructions: prompts.system,
			messages: [{ role: 'user', content: userContent }],
			tools: buildTools(fff, cwd),
			output: Output.object({ name: 'options', schema: LLMResponse }),
			stopWhen: isLoopFinished(),
			onToolExecutionStart: ({ toolCall }) => {
				const args = toolCall.input as Record<string, unknown>;
				console.log(`[viking:llm] tool → ${toolCall.toolName}`, args);
				onTool?.({ id: toolCall.toolCallId, name: toolCall.toolName, status: 'running', args, summary: toolSummary(toolCall.toolName, args) });
			},
			onToolExecutionEnd: ({ toolCall, toolOutput }) => {
				const args = toolCall.input as Record<string, unknown>;
				if (toolOutput.type === 'tool-error') {
					const error = toolOutput.error instanceof Error ? toolOutput.error.message : 'Tool execution failed';
					console.log(`[viking:llm] tool ← ${toolCall.toolName}`, error);
					onTool?.({ id: toolCall.toolCallId, name: toolCall.toolName, status: 'error', error });
					return;
				}
				const value = ToolOutput.parse(toolOutput.output);
				console.log(`[viking:llm] tool ← ${toolCall.toolName}`, value.slice(0, 400) + (value.length > 400 ? `… (${value.length}b)` : ''));
				onTool?.({ id: toolCall.toolCallId, name: toolCall.toolName, status: 'done', summary: toolSummary(toolCall.toolName, args, value) });
			},
			onStepEnd: ({ reasoningText }) => {
				if (reasoningText) onReasoning?.({ id: reasoningStep++, text: reasoningText });
			},
		});
		const options = result.output.options;
		const reasoning = result.steps.map(step => step.reasoningText).filter(Boolean).join('\n\n') || undefined;
		console.log(`[viking:llm] final rounds=${result.steps.length} options=${options.length}`);
		options.forEach((o, idx) => console.log(`  [${idx}] ${o.label} (${o.language}) → ${o.file}`));
		return { options, reasoning };
	} catch (e) {
		if (NoObjectGeneratedError.isInstance(e)) {
			const cause = e.cause instanceof Error ? e.cause.message : e.message;
			return { options: [], softError: `schema validation failed: ${cause}` };
		}
		throw e;
	} finally {
		await fff.close();
	}
}
