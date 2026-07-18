import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { config } from '../../config';
import type { ToolArguments } from '../tools/utils';

export type WebSearchFactory = () => ToolSet[string];

type ExaErrorBody = {
	error?: unknown;
	tag?: unknown;
	requestId?: unknown;
};

function exaErrorMessage(status: number, body: unknown): string {
	const error = body && typeof body === 'object' ? body as ExaErrorBody : {};
	const details = [
		typeof error.error === 'string' ? error.error : undefined,
		typeof error.tag === 'string' ? `tag: ${error.tag}` : undefined,
		typeof error.requestId === 'string' ? `request: ${error.requestId}` : undefined,
	].filter(Boolean).join(' · ');
	return `Exa API error (${status})${details ? `: ${details}` : ''}`;
}

export function createExaWebSearch(apiKey = config.exa.apiKey): ToolSet[string] {
	const key = apiKey?.trim();
	if (!key) throw new Error('EXA_API_KEY is required for general web search.');

	return tool({
		description: 'Search the web with Exa for current or unfamiliar information. Returns relevant URLs and highlighted source excerpts.',
		inputSchema: z.object({
			query: z.string().min(1).max(500).describe('A specific web search query'),
		}),
		execute: async ({ query }, { abortSignal }) => {
			let response: Response;
			try {
				response = await fetch('https://api.exa.ai/search', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': key,
					},
					body: JSON.stringify({
						query,
						type: 'auto',
						numResults: 5,
						contents: { highlights: true },
					}),
					signal: abortSignal,
				});
			} catch (error) {
				if (error instanceof Error && error.name === 'AbortError') throw error;
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Exa request failed: ${message}`);
			}
			const text = await response.text();
			let body: unknown = text;
			try { body = JSON.parse(text); } catch { }
			if (!response.ok) throw new Error(exaErrorMessage(response.status, body));
			return body;
		},
	});
}

export function buildGeneralTools(webSearch: WebSearchFactory = createExaWebSearch): ToolSet {
	return { webSearch: webSearch() };
}

export const toolSummary = (_name: string, args: ToolArguments) => ({
	type: 'raw' as const,
	args,
});
