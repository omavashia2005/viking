import assert from 'node:assert/strict';
import type { ToolSet } from 'ai';
import { config } from '../../config';
import { buildGeneralTools } from './tools';

const webSearch = {} as ToolSet[string];
const tools = buildGeneralTools(() => webSearch);
assert.deepEqual(Object.keys(tools), ['webSearch']);
assert.equal(tools.webSearch, webSearch);

const apiKey = config.connectors.exa.apiKey;
config.connectors.exa.apiKey = '';
assert.throws(() => buildGeneralTools(), /EXA_API_KEY/);
config.connectors.exa.apiKey = apiKey;
