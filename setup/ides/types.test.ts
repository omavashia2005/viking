import assert from 'node:assert/strict';
import { normalizeLaunchSource } from './types';

assert.equal(normalizeLaunchSource('neovim'), 'neovim');
assert.equal(normalizeLaunchSource('vscode'), 'vscode');
assert.equal(normalizeLaunchSource(), 'general');
assert.equal(normalizeLaunchSource('unknown'), 'general');
