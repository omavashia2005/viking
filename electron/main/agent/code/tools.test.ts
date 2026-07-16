import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveReadPath } from './tools';
import { mcpConnectionPool, warmMcpConnections } from '../tools/utils';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viking-read-file-'));
try {
	fs.mkdirSync(path.join(root, '.git'));
	fs.mkdirSync(path.join(root, 'electron/main/agent/code'), { recursive: true });
	const file = path.join(root, 'electron/main/agent/code/tools.ts');
	fs.writeFileSync(file, 'ok');

	assert.equal(
		resolveReadPath(path.join(root, 'electron/main'), 'electron/main/agent/code/tools.ts'),
		file,
	);
} finally {
	fs.rmSync(root, { recursive: true, force: true });
}

const fff = Promise.resolve(null as never);
const context7 = Promise.resolve(null as never);
mcpConnectionPool.set(`fff:${path.resolve(root)}`, fff);
mcpConnectionPool.set('context7', context7);

void warmMcpConnections(root).then(() => {
	assert.equal(mcpConnectionPool.get(`fff:${path.resolve(root)}`), fff);
	assert.equal(mcpConnectionPool.get('context7'), context7);
	mcpConnectionPool.clear();
});
