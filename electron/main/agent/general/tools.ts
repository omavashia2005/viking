import { Composio } from '@composio/core';
import { VercelProvider } from '@composio/vercel';
import type { ToolSet } from 'ai';
import { config } from '../../config';
import type { ToolArguments } from '../tools/utils';

const COMPOSIO_USER_ID = 'viking-local-user';
let composioApiKey: string | undefined;
let toolsPromise: Promise<ToolSet> | undefined;

export function buildGeneralTools(): Promise<ToolSet> {
	const apiKey = config.connectors.composio.apiKey.trim();
	if (!apiKey) throw new Error('COMPOSIO_API_KEY is required for general-agent tools.');
	if (toolsPromise && composioApiKey === apiKey) return toolsPromise;

	composioApiKey = apiKey;
	const composio = new Composio({ apiKey, provider: new VercelProvider() });
	const request = composio.create(COMPOSIO_USER_ID).then(session => session.tools());
	toolsPromise = request;
	void request.catch(() => {
		if (toolsPromise === request) toolsPromise = undefined;
	});
	return request;
}

export const toolSummary = (_name: string, args: ToolArguments) => ({
	type: 'raw' as const,
	args,
});
