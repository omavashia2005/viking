import assert from 'node:assert/strict';
import { findSchemaPolicyViolations, scanMainProcess } from './schema-policy';

assert.deepEqual(
	findSchemaPolicyViolations(`
		export interface ApiPayload { value: string }
		type ParsedResult = { ok: boolean } | { error: string };
		function nested() {
			type NestedPayload = { count: number };
		}
	`),
	[
		{ file: 'source.ts', line: 2, name: 'ApiPayload' },
		{ file: 'source.ts', line: 3, name: 'ParsedResult' },
		{ file: 'source.ts', line: 5, name: 'NestedPayload' },
	],
);

assert.deepEqual(
	findSchemaPolicyViolations(`
		import { z } from 'zod';
		const ApiPayload = z.object({ value: z.string() });
		type ApiPayload = z.infer<typeof ApiPayload>;
		// @compile-time-only: callback registry that never crosses a runtime boundary.
		type Registry = { run(): void };
	`),
	[],
);

assert.deepEqual(
	findSchemaPolicyViolations(`
		// @compile-time-only:
		interface MissingReason { run(): void }
	`).map(violation => violation.name),
	['MissingReason'],
);

const violations = scanMainProcess();
assert.deepEqual(
	violations,
	[],
	violations.map(({ file, line, name }) =>
		`${file}:${line} ${name} is hand-rolled; derive it from a Zod schema or document why it is compile-time-only.`,
	).join('\n'),
);
