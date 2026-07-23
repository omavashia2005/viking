import assert from 'node:assert/strict';
import { config } from '../config';
import { agents, agentTypeForSource, getGateway, LaunchArgs } from './llm';

assert.deepEqual(Object.keys(agents), ['code', 'general']);
assert.equal('outputSchema' in agents.code, true);
assert.equal('outputSchema' in agents.general, false);
assert.equal(agentTypeForSource('general'), 'general');
assert.equal(agentTypeForSource('neovim'), 'code');
assert.equal(agentTypeForSource('vscode'), 'code');
assert.deepEqual(LaunchArgs.parse({ source: 'neovim', cwd: '/repo' }), { source: 'neovim', cwd: '/repo' });
assert.throws(() => LaunchArgs.parse({ source: 'terminal' }));

const apiKey = config.llm.apiKey;
const gateway = getGateway();
assert.equal(getGateway(), gateway);

config.llm.apiKey = `${apiKey}-changed`;
assert.notEqual(getGateway(), gateway);
config.llm.apiKey = apiKey;
