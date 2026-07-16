import {
	createGateway,
	generateText,
	isLoopFinished,
	NoObjectGeneratedError,
	Output,
	type FlexibleSchema,
	type ToolSet,
	type UserContent,
} from 'ai';
import { config } from '../config';
import type { ReasoningProgress, ToolProgress } from './shared-types';

let gateway: ReturnType<typeof createGateway> | undefined;
let gatewayApiKey: string | undefined;

export function getGateway(): ReturnType<typeof createGateway> {
	if (!gateway || gatewayApiKey !== config.llm.apiKey) {
		gateway = createGateway({ apiKey: config.llm.apiKey });
		gatewayApiKey = config.llm.apiKey;
	}
	return gateway;
}

export type LLMResult<TOutput> = {
	output?: TOutput;
	reasoning?: string;
	softError?: string;
};

type GenerateInput<TOutput, TSummary> = {
	prompt: string;
	instructions: string;
	outputSchema: FlexibleSchema<TOutput>;
	outputName?: string;
	screenshot?: string;
	tools?: ToolSet;
	summarizeTool?: (name: string, args: Record<string, unknown>, result?: unknown) => TSummary | undefined;
	onTool?: (event: ToolProgress<TSummary>) => void;
	onReasoning?: (event: ReasoningProgress) => void;
};

export async function generate<TOutput, TSummary = unknown>(input: GenerateInput<TOutput, TSummary>): Promise<LLMResult<TOutput>> {
	const { prompt, instructions, outputSchema, outputName, screenshot, tools, summarizeTool, onTool, onReasoning } = input;
	const model = getGateway()(config.llm.model);
	const userContent: UserContent = [{ type: 'text', text: prompt }];
	if (screenshot) userContent.push({ type: 'file', mediaType: 'image/jpeg', data: screenshot });
	console.log('[viking:llm] query', { model: config.llm.model, hasScreenshot: !!screenshot, prompt });

	let reasoningStep = 0;
	try {
		const result = await generateText({
			model,
			instructions,
			messages: [{ role: 'user', content: userContent }],
			tools,
			output: Output.object({ name: outputName, schema: outputSchema }),
			stopWhen: isLoopFinished(),
			onToolExecutionStart: ({ toolCall }) => {
				const args = toolCall.input as Record<string, unknown>;
				console.log(`[viking:llm] tool → ${toolCall.toolName}`, args);
				onTool?.({
					id: toolCall.toolCallId,
					name: toolCall.toolName,
					status: 'running',
					args,
					summary: summarizeTool?.(toolCall.toolName, args),
				});
			},
			onToolExecutionEnd: ({ toolCall, toolOutput }) => {
				const args = toolCall.input as Record<string, unknown>;
				if (toolOutput.type === 'tool-error') {
					const error = toolOutput.error instanceof Error ? toolOutput.error.message : 'Tool execution failed';
					console.log(`[viking:llm] tool ← ${toolCall.toolName}`, error);
					onTool?.({ id: toolCall.toolCallId, name: toolCall.toolName, status: 'error', error });
					return;
				}
				console.log(`[viking:llm] tool ← ${toolCall.toolName}`, toolOutput.output);
				onTool?.({
					id: toolCall.toolCallId,
					name: toolCall.toolName,
					status: 'done',
					summary: summarizeTool?.(toolCall.toolName, args, toolOutput.output),
				});
			},
			onStepEnd: ({ reasoningText }) => {
				if (reasoningText) onReasoning?.({ id: reasoningStep++, text: reasoningText });
			},
		});
		return {
			output: result.output,
			reasoning: result.steps.map(step => step.reasoningText).filter(Boolean).join('\n\n') || undefined,
		};
	} catch (error) {
		if (NoObjectGeneratedError.isInstance(error)) {
			const cause = error.cause instanceof Error ? error.cause.message : error.message;
			return { softError: `schema validation failed: ${cause}` };
		}
		console.log(error);
		throw error;
	}
}
