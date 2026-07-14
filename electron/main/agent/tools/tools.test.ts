import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveReadPath } from './tools';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viking-read-file-'));
try {
  fs.mkdirSync(path.join(root, '.git'));
  fs.mkdirSync(path.join(root, 'electron/main/agent'), { recursive: true });
  const file = path.join(root, 'electron/main/agent/tools.ts');
  fs.writeFileSync(file, 'ok');

  assert.equal(
    resolveReadPath(path.join(root, 'electron/main'), 'electron/main/agent/tools.ts'),
    file,
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
