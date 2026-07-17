import assert from 'node:assert/strict';
import { agentReducer, initialAgentState, matchesShortcut } from './App';

const key = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
}) as KeyboardEvent;

assert.equal(matchesShortcut(key('k', { metaKey: true }), 'CommandOrControl+K'), true);
assert.equal(matchesShortcut(key('k', { metaKey: true }), 'CommandOrControl+Shift+K'), false);
assert.equal(matchesShortcut(key(' ', { altKey: true }), 'Alt+Space'), true);
assert.equal(matchesShortcut(key('y', { ctrlKey: true }), 'y', true), true);
assert.equal(matchesShortcut(key('s', { metaKey: true }), 'CommandOrControl+S'), true);
assert.equal(matchesShortcut(key('k', { metaKey: true, shiftKey: true }), 'CommandOrControl+Shift+K'), true);

const option = { label: 'direct', language: 'typescript', code: 'const answer = 42;', file: '/tmp/example.ts', startLine: 1 };
const shown = agentReducer(
  { ...initialAgentState, phase: 'error', error: 'old error', softError: 'old warning', prompt: 'old prompt', closing: true },
  { type: 'show', refineFrom: option },
);
assert.deepEqual(
  { phase: shown.phase, error: shown.error, softError: shown.softError, prompt: shown.prompt, refineFrom: shown.refineFrom, closing: shown.closing },
  { phase: 'textbox', error: '', softError: '', prompt: '', refineFrom: option, closing: false },
);

const working = agentReducer(shown, { type: 'tool', event: { id: 'tool-1', name: 'search', status: 'running' } });
const finished = agentReducer(working, { type: 'tool', event: { id: 'tool-1', name: 'search', status: 'done' } });
assert.equal(finished.toolCalls.length, 1);
assert.equal(finished.toolCalls[0].status, 'done');

const result = agentReducer(finished, { type: 'result', payload: { options: [option] } });
assert.deepEqual(
  { phase: result.phase, options: result.options, active: result.active, toolCalls: result.toolCalls },
  { phase: 'results', options: [option], active: 0, toolCalls: [] },
);
