import {
	createGateway,
	generateText,
	isLoopFinished,
	NoObjectGeneratedError,
	Output,
	type InferSchema,
	type UserContent,
} from 'ai';
import { config } from '../config';
import { LLMResponse } from './code/shared-types';
import { buildCodePrompt, prompts as codePrompts } from './code/prompts';
import { buildCodeTools, toolSummary as codeToolSummary } from './code/tools';
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

export type LaunchArgs = { cwd?: string; activeFile?: string };

type UserInputBase = {
	userPrompt: string;
	screenshot?: string;
	launch?: LaunchArgs;
	onTool?: (event: ToolProgress) => void;
	onReasoning?: (event: ReasoningProgress) => void;
};

const agents = {
	code: {
		instructions: codePrompts.system,
		outputSchema: LLMResponse,
		outputName: 'options',
		buildPrompt: (input: UserInputBase) => buildCodePrompt(input.userPrompt, input.launch?.activeFile),
		buildTools: buildCodeTools,
		summarizeTool: codeToolSummary,
	},
};

export type AgentType = keyof typeof agents;
export type UserInput<T extends AgentType = AgentType> = UserInputBase & { type: T };
type AgentOutput<T extends AgentType> = InferSchema<(typeof agents)[T]['outputSchema']>;

export type LLMResult<TOutput> = {
	output?: TOutput;
	reasoning?: string;
	softError?: string;
};

export async function generate<T extends AgentType>(input: UserInput<T>): Promise<LLMResult<AgentOutput<T>>> {
	const agent = agents[input.type];
	const cwd = input.launch?.cwd || config.cwd;
	const prompt = agent.buildPrompt(input);
	const userContent: UserContent = [{ type: 'text', text: prompt }];
	if (input.screenshot) userContent.push({ type: 'file', mediaType: 'image/jpeg', data: input.screenshot });
	console.log('[viking:llm] query', { type: input.type, model: config.llm.model, hasScreenshot: !!input.screenshot, prompt });

	let reasoningStep = 0;
	try {
		const result = await generateText({
			model: getGateway()(config.llm.model),
			instructions: agent.instructions,
			messages: [{ role: 'user', content: userContent }],
			tools: agent.buildTools(cwd),
			output: Output.object({ name: agent.outputName, schema: agent.outputSchema }),
			stopWhen: isLoopFinished(),
			onToolExecutionStart: ({ toolCall }) => {
				const args = toolCall.input as Record<string, unknown>;
				console.log(`[viking:llm] tool → ${toolCall.toolName}`, args);
				input.onTool?.({
					id: toolCall.toolCallId,
					name: toolCall.toolName,
					status: 'running',
					args,
					summary: agent.summarizeTool(toolCall.toolName, args),
				});
			},
			onToolExecutionEnd: ({ toolCall, toolOutput }) => {
				const args = toolCall.input as Record<string, unknown>;
				if (toolOutput.type === 'tool-error') {
					const error = toolOutput.error instanceof Error ? toolOutput.error.message : 'Tool execution failed';
					console.log(`[viking:llm] tool ← ${toolCall.toolName}`, error);
					input.onTool?.({ id: toolCall.toolCallId, name: toolCall.toolName, status: 'error', error });
					return;
				}
				console.log(`[viking:llm] tool ← ${toolCall.toolName}`, toolOutput.output);
				input.onTool?.({
					id: toolCall.toolCallId,
					name: toolCall.toolName,
					status: 'done',
					summary: agent.summarizeTool(toolCall.toolName, args, toolOutput.output),
				});
			},
			onStepEnd: ({ reasoningText }) => {
				if (reasoningText) input.onReasoning?.({ id: reasoningStep++, text: reasoningText });
			},
		});
		return {
			output: result.output as AgentOutput<T>,
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
