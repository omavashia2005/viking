import assert from 'node:assert/strict';
import { config } from '../config';
import { getGateway } from './llm';

const apiKey = config.llm.apiKey;
const gateway = getGateway();
assert.equal(getGateway(), gateway);

config.llm.apiKey = `${apiKey}-changed`;
assert.notEqual(getGateway(), gateway);
config.llm.apiKey = apiKey;
