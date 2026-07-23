import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveReadPath, toolSummary } from './tools';
import { mcpConnectionPool, warmMcpConnections } from '../tools/utils';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viking-read-file-'));
try {
	fs.mkdirSync(path.join(root, '.git'));
	fs.mkdirSync(path.join(root, 'electron/main/agent/code'), { recursive: true });
	const file = path.join(root, 'electron/main/agent/code/tools.ts');
	fs.writeFileSync(file, 'ok');

	assert.equal(
		resolveReadPath({
			cwd: path.join(root, 'electron/main'),
			filePath: 'electron/main/agent/code/tools.ts',
		}).absolutePath,
		file,
	);
} finally {
	fs.rmSync(root, { recursive: true, force: true });
}

assert.deepEqual(toolSummary('grep_codebase', { query: 'needle' }, { content: 'one\ntwo' }), {
	type: 'search',
	query: 'needle',
	preview: ['one', 'two'],
	lineCount: 2,
});

const fff = Promise.resolve(null as never);
const context7 = Promise.resolve(null as never);
mcpConnectionPool.set(`fff:${path.resolve(root)}`, fff);
mcpConnectionPool.set('context7', context7);

void warmMcpConnections(root).then(() => {
	assert.equal(mcpConnectionPool.get(`fff:${path.resolve(root)}`), fff);
	assert.equal(mcpConnectionPool.get('context7'), context7);
	mcpConnectionPool.clear();
});
