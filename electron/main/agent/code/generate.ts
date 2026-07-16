import fs from 'node:fs';
import { config } from '../../config';
import { generate as generateLLM } from '../llm';
import { prompts, type Context } from './prompts';
import {
	LLMResponse,
	type LLMResponse as CodeResponse,
	type Option,
	type ToolProgress,
	type ToolSummary,
} from './shared-types';
import { buildCodeTools, toolSummary } from './tools';
import type { ReasoningProgress } from '../shared-types';

export type LaunchArgs = { cwd?: string; activeFile?: string };
type LLMResult = { options: Option[]; reasoning?: string; softError?: string };
type UserInput = {
	userPrompt: string;
	screenshot: string;
	launch?: LaunchArgs;
	onTool?: (event: ToolProgress) => void;
	onReasoning?: (event: ReasoningProgress) => void;
};

export async function generate(input: UserInput): Promise<LLMResult> {
	const { userPrompt, screenshot, launch, onTool, onReasoning } = input;
	const cwd = launch?.cwd || config.cwd;
	let activeFileSnippet = '';
	if (launch?.activeFile) {
		try { activeFileSnippet = fs.readFileSync(launch.activeFile, 'utf8').split('\n').slice(0, 200).join('\n'); } catch { }
	}
	const context: Context = {
		userPrompt,
		codebase: activeFileSnippet ? `Active file (${launch?.activeFile}), lines 1-200:\n${activeFileSnippet}` : '',
	};
	const result = await generateLLM<CodeResponse, ToolSummary>({
		prompt: prompts.user(context),
		instructions: prompts.system,
		outputSchema: LLMResponse,
		outputName: 'options',
		screenshot,
		tools: buildCodeTools(cwd),
		summarizeTool: toolSummary,
		onTool,
		onReasoning,
	});
	const options = result.output?.options ?? [];
	console.log(`[viking:code] final options=${options.length}`);
	options.forEach((option, index) => console.log(`  [${index}] ${option.label} (${option.language}) → ${option.file}`));
	return { options, reasoning: result.reasoning, softError: result.softError };
}
