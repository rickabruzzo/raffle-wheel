import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCSV } from '../lib.js';

test('parseCSV splits simple rows', () => {
  assert.deepEqual(parseCSV('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
});

test('parseCSV keeps commas inside quotes', () => {
  assert.deepEqual(parseCSV('"Smith, Jr.",Acme'), [['Smith, Jr.', 'Acme']]);
});

test('parseCSV unescapes doubled quotes', () => {
  assert.deepEqual(parseCSV('"She said ""hi""",x'), [['She said "hi"', 'x']]);
});

test('parseCSV normalizes CRLF and ignores trailing newline', () => {
  assert.deepEqual(parseCSV('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
});
