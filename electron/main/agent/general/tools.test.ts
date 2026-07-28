import assert from 'node:assert/strict';
import { config } from '../../config';
import { buildGeneralTools } from './tools';

const apiKey = config.connectors.composio.apiKey;
config.connectors.composio.apiKey = '';
assert.deepEqual(await buildGeneralTools(), {});
config.connectors.composio.apiKey = apiKey;
