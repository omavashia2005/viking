import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSync } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const testDirectory = path.join(root, 'electron/main');
const outputDirectory = fs.mkdtempSync(path.join(root, '.main-tests-'));

function testFiles(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) return testFiles(absolute);
		return entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx'))
			? [absolute]
			: [];
	});
}

try {
	for (const [index, testFile] of testFiles(testDirectory).sort().entries()) {
		const outputFile = path.join(outputDirectory, `${index}.mjs`);
		buildSync({
			entryPoints: [testFile],
			outfile: outputFile,
			bundle: true,
			format: 'esm',
			platform: 'node',
			packages: 'external',
			logLevel: 'silent',
		});
		const result = spawnSync(process.execPath, [outputFile], { cwd: root, stdio: 'inherit' });
		if (result.status !== 0) {
			process.exitCode = result.status ?? 1;
			break;
		}
		console.log(`✓ ${path.relative(root, testFile)}`);
	}
} finally {
	fs.rmSync(outputDirectory, { recursive: true, force: true });
}
