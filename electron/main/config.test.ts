import assert from 'node:assert/strict';
import { PersistedSettings } from './config';

assert.deepEqual(
	PersistedSettings.parse({
		llm: { model: 'openai/gpt-5' },
		growth: 'up',
		ignoredLegacySetting: true,
	}),
	{
		llm: { model: 'openai/gpt-5' },
		growth: 'up',
	},
);

assert.throws(
	() => PersistedSettings.parse({ hotkeys: { open: 42 } }),
	/Expected string/,
);
assert.throws(
	() => PersistedSettings.parse({ growth: 'sideways' }),
	/Invalid enum value/,
);
