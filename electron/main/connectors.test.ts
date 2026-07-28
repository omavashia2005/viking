import assert from 'node:assert/strict';
import { ConnectorRequest, ConnectorStatusesRequest, connectorStatuses } from './connectors';

assert.throws(
	() => ConnectorRequest.parse({ apiKey: 'key', connectorId: 'bad/toolkit' }),
	/Invalid/,
);

assert.equal(
	ConnectorStatusesRequest.parse({
		apiKey: 'key',
		connectorIds: Array.from({ length: 251 }, (_, index) => `tool-${index}`),
	}).connectorIds.length,
	251,
);

assert.deepEqual(
	connectorStatuses({
		items: [
			{ status: 'ACTIVE', isDisabled: false, toolkit: { slug: 'exa' } },
			{ status: 'ACTIVE', isDisabled: true, toolkit: { slug: 'gmail' } },
		],
	}, ['exa', 'notion', 'gmail', 'slack']),
	[
		{ id: 'exa', connected: true },
		{ id: 'notion', connected: false },
		{ id: 'gmail', connected: false },
		{ id: 'slack', connected: false },
	],
);
