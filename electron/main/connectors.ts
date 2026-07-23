import { Composio } from '@composio/core';
import { z } from 'zod';

export const ConnectorId = z.string().trim().regex(/^[a-z0-9_-]+$/);
export type ConnectorId = z.infer<typeof ConnectorId>;

export const ConnectorStatus = z.object({
	id: ConnectorId,
	connected: z.boolean(),
});
export type ConnectorStatus = z.infer<typeof ConnectorStatus>;

const ComposioKeyRequest = z.object({
	apiKey: z.string().trim().min(1, 'COMPOSIO_API_KEY is required.'),
});

export const ConnectorRequest = ComposioKeyRequest.extend({
	connectorId: ConnectorId,
});

export const ConnectorStatusesRequest = ComposioKeyRequest.extend({
	connectorIds: z.array(ConnectorId).max(250),
});

const ConnectedAccountList = z.object({
	items: z.array(z.object({
		status: z.literal('ACTIVE'),
		isDisabled: z.boolean(),
		toolkit: z.object({ slug: z.string() }),
	})),
	nextCursor: z.string().nullish(),
});

const ConnectionRequest = z.object({
	redirectUrl: z.string().url().nullable(),
});

const ConnectedAccount = z.object({
	status: z.literal('ACTIVE'),
	isDisabled: z.boolean(),
	toolkit: z.object({ slug: z.string() }),
});

export const COMPOSIO_USER_ID = 'viking-local-user';

export function connectorStatuses(input: unknown, connectorIds: ConnectorId[]): ConnectorStatus[] {
	const connected = new Set<string>();
	for (const account of ConnectedAccountList.parse(input).items) {
		if (!account.isDisabled) connected.add(account.toolkit.slug);
	}
	return connectorIds.map(id => ConnectorStatus.parse({ id, connected: connected.has(id) }));
}

export async function getConnectorStatuses(input: unknown): Promise<ConnectorStatus[]> {
	const { apiKey, connectorIds } = ConnectorStatusesRequest.parse(input);
	const composio = new Composio({ apiKey });
	const items: unknown[] = [];
	let cursor: string | undefined;
	do {
		const page = ConnectedAccountList.parse(await composio.connectedAccounts.list({
			userIds: [COMPOSIO_USER_ID],
			statuses: ['ACTIVE'],
			limit: 100,
			cursor,
		}));
		items.push(...page.items);
		cursor = page.nextCursor ?? undefined;
	} while (cursor);
	return connectorStatuses({ items }, connectorIds);
}

export async function connectConnector(
	input: unknown,
	openExternal: (url: string) => Promise<void>,
): Promise<ConnectorStatus> {
	const { apiKey, connectorId } = ConnectorRequest.parse(input);
	const composio = new Composio({ apiKey });
	const session = await composio.sessions.create(COMPOSIO_USER_ID, {
		toolkits: [connectorId],
		manageConnections: false,
	});
	const request = await session.authorize(connectorId);
	const { redirectUrl } = ConnectionRequest.parse(request);
	if (!redirectUrl) throw new Error(`Composio did not return an authorization URL for ${connectorId}.`);

	await openExternal(redirectUrl);
	const account = ConnectedAccount.parse(await request.waitForConnection(120_000));
	return ConnectorStatus.parse({ id: connectorId, connected: !account.isDisabled });
}
