import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchResult } from './SearchResult';

const html = renderToStaticMarkup(
  <SearchResult answer={'# Result\n\n- first\n- second\n\n[Source](https://exa.ai)'} />,
);

assert.match(html, /<h1>Result<\/h1>/);
assert.match(html, /<li>first<\/li>/);
assert.match(html, /href="https:\/\/exa\.ai"/);
assert.doesNotMatch(html, /# Result/);
