import assert from 'node:assert/strict';
import { ConnectorRequest, connectorStatuses } from './connectors';

assert.throws(
	() => ConnectorRequest.parse({ apiKey: 'key', connectorId: 'github' }),
	/Invalid enum value/,
);

assert.deepEqual(
	connectorStatuses({
		items: [
			{ status: 'ACTIVE', isDisabled: false, toolkit: { slug: 'exa' } },
			{ status: 'ACTIVE', isDisabled: true, toolkit: { slug: 'gmail' } },
		],
	}),
	[
		{ id: 'exa', connected: true },
		{ id: 'notion', connected: false },
		{ id: 'gmail', connected: false },
		{ id: 'slack', connected: false },
	],
);
