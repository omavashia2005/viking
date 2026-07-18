import assert from 'node:assert/strict';
import { config } from '../config';
import { agents, agentTypeForSource, getGateway } from './llm';

assert.deepEqual(Object.keys(agents), ['code', 'general']);
assert.equal('outputSchema' in agents.code, true);
assert.equal('outputSchema' in agents.general, false);
assert.equal(agentTypeForSource('general'), 'general');
assert.equal(agentTypeForSource('neovim'), 'code');
assert.equal(agentTypeForSource('vscode'), 'code');

const apiKey = config.llm.apiKey;
const gateway = getGateway();
assert.equal(getGateway(), gateway);

config.llm.apiKey = `${apiKey}-changed`;
assert.notEqual(getGateway(), gateway);
config.llm.apiKey = apiKey;
