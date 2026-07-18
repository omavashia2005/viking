import {
	createGateway,
	generateText,
	isLoopFinished,
	isStepCount,
	NoObjectGeneratedError,
	Output,
	type FlexibleSchema,
	type UserContent,
} from 'ai';
import { config } from '../config';
import { LLMResponse } from './code/shared-types';
import { buildCodePrompt, prompts as codePrompts } from './code/prompts';
import { buildCodeTools, toolSummary as codeToolSummary } from './code/tools';
import { buildGeneralPrompt, prompts as generalPrompts } from './general/prompts';
import { buildGeneralTools, toolSummary as generalToolSummary } from './general/tools';
import type { ReasoningProgress, ToolProgress } from './shared-types';
import type { LaunchSource } from '../../../setup/ides/types';

let gateway: ReturnType<typeof createGateway> | undefined;
let gatewayApiKey: string | undefined;

export function getGateway(): ReturnType<typeof createGateway> {
	if (!gateway || gatewayApiKey !== config.llm.apiKey) {
		gateway = createGateway({ apiKey: config.llm.apiKey });
		gatewayApiKey = config.llm.apiKey;
	}
	return gateway;
}

export type LaunchArgs = { cwd?: string; activeFile?: string; source: LaunchSource };

export const agents = {
	code: {
		instructions: codePrompts.system,
		outputSchema: LLMResponse,
		outputName: 'options',
		buildPrompt: buildCodePrompt,
		buildTools: buildCodeTools,
		summarizeTool: codeToolSummary,
	},
	general: {
		instructions: generalPrompts.system,
		buildPrompt: buildGeneralPrompt,
		buildTools: () => buildGeneralTools(),
		summarizeTool: generalToolSummary,
	},
};

export type AgentType = keyof typeof agents;
export const agentTypeForSource = (source: LaunchSource): AgentType => source === 'general' ? 'general' : 'code';

type AgentOutput = {
	code: LLMResponse;
	general: string;
};

export type UserInput<T extends AgentType = AgentType> = {
	agentType: T;
	userPrompt: string;
	screenshot?: string;
	launch?: LaunchArgs;
	onTool?: (event: ToolProgress) => void;
	onReasoning?: (event: ReasoningProgress) => void;
};

export async function generate<T extends AgentType>(input: UserInput<T>) {
	const agent = agents[input.agentType];
	const prompt = input.agentType === 'general'
		? agents.general.buildPrompt(input.userPrompt)
		: agents.code.buildPrompt(input.userPrompt, input.launch?.activeFile);
	const tools = input.agentType === 'general'
		? agents.general.buildTools()
		: agents.code.buildTools(input.launch?.cwd || config.cwd);
	const userContent: UserContent = [{ type: 'text', text: prompt }];
	if (input.screenshot) userContent.push({ type: 'file', mediaType: 'image/jpeg', data: input.screenshot });
	console.log('[viking:llm] query', { agentType: input.agentType, model: config.llm.model, hasScreenshot: !!input.screenshot, prompt });

	let reasoningStep = 0;
	try {
		const output = 'outputSchema' in agent
			? Output.object({
				name: agent.outputName,
				schema: agent.outputSchema as FlexibleSchema<AgentOutput[T]>,
			})
			: undefined;
		const result = await generateText({
			model: getGateway()(config.llm.model),
			instructions: agent.instructions,
			messages: [{ role: 'user', content: userContent }],
			tools,
			output,
			stopWhen: input.agentType === 'general' ? isStepCount(5) : isLoopFinished(),
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
				console.log(
					`[viking:llm] tool ← ${toolCall.toolName}`,
					input.agentType === 'general' ? 'complete' : toolOutput.output,
				);
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
			output: (input.agentType === 'general' ? result.text : result.output) as AgentOutput[T],
			reasoning: result.steps.flatMap(step => step.reasoningText ? [step.reasoningText] : []).join('\n\n') || undefined,
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
