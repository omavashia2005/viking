import { Composio } from '@composio/core';
import { z } from 'zod';

export const ConnectorId = z.enum(['exa', 'notion', 'gmail', 'slack']);
export type ConnectorId = z.infer<typeof ConnectorId>;

export const ConnectorStatus = z.object({
	id: ConnectorId,
	connected: z.boolean(),
});
export type ConnectorStatus = z.infer<typeof ConnectorStatus>;

export const ConnectorRequest = z.object({
	apiKey: z.string().trim().min(1, 'COMPOSIO_API_KEY is required.'),
	connectorId: ConnectorId.optional(),
});

const ConnectedAccountList = z.object({
	items: z.array(z.object({
		status: z.literal('ACTIVE'),
		isDisabled: z.boolean(),
		toolkit: z.object({ slug: z.string() }),
	})),
});

const ConnectionRequest = z.object({
	redirectUrl: z.string().url().nullable(),
});

const ConnectedAccount = z.object({
	status: z.literal('ACTIVE'),
	isDisabled: z.boolean(),
	toolkit: z.object({ slug: ConnectorId }),
});

const CONNECTOR_IDS = ConnectorId.options;
export const COMPOSIO_USER_ID = 'viking-local-user';

export function connectorStatuses(input: unknown): ConnectorStatus[] {
	const connected = new Set<string>();
	for (const account of ConnectedAccountList.parse(input).items) {
		if (!account.isDisabled) connected.add(account.toolkit.slug);
	}
	return CONNECTOR_IDS.map(id => ConnectorStatus.parse({ id, connected: connected.has(id) }));
}

export async function getConnectorStatuses(input: unknown): Promise<ConnectorStatus[]> {
	const { apiKey } = ConnectorRequest.parse(input);
	const composio = new Composio({ apiKey });
	const accounts = await composio.connectedAccounts.list({
		userIds: [COMPOSIO_USER_ID],
		toolkitSlugs: CONNECTOR_IDS,
		statuses: ['ACTIVE'],
	});
	return connectorStatuses(accounts);
}

export async function connectConnector(
	input: unknown,
	openExternal: (url: string) => Promise<void>,
): Promise<ConnectorStatus> {
	const { apiKey, connectorId } = ConnectorRequest.required({ connectorId: true }).parse(input);
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
	return ConnectorStatus.parse({ id: account.toolkit.slug, connected: !account.isDisabled });
}
