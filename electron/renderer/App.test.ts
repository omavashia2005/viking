import assert from 'node:assert/strict';
import { matchesShortcut } from './App';

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
