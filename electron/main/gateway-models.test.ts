import assert from 'node:assert/strict';
import { parseGatewayModels } from './gateway-models';

const models = parseGatewayModels({
	data: [
		{ id: 'zeta/chat', name: 'Chat', owned_by: 'zeta', type: 'language' },
		{ id: 'alpha/reason', name: 'Reason', owned_by: 'alpha', type: 'language' },
		{ id: 'alpha/embed', name: 'Embed', owned_by: 'alpha', type: 'embedding' },
		{ id: 'alpha/reason', name: 'Duplicate', owned_by: 'alpha', type: 'language' },
	],
});

assert.deepEqual(models, [
	{ id: 'alpha/reason', name: 'Reason', provider: 'alpha' },
	{ id: 'zeta/chat', name: 'Chat', provider: 'zeta' },
]);
assert.throws(() => parseGatewayModels({ data: null }), /invalid model catalog/);
