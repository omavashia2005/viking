import assert from 'node:assert/strict';
import { config } from '../../config';
import { buildGeneralTools } from './tools';

const apiKey = config.connectors.composio.apiKey;
config.connectors.composio.apiKey = '';
assert.throws(() => buildGeneralTools(), /COMPOSIO_API_KEY/);
config.connectors.composio.apiKey = apiKey;
