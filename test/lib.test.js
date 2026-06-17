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

import { deriveCsvUrl } from '../lib.js';

test('deriveCsvUrl builds gviz CSV from a standard edit URL', () => {
  const out = deriveCsvUrl('https://docs.google.com/spreadsheets/d/ABC123_xyz/edit');
  assert.equal(out, 'https://docs.google.com/spreadsheets/d/ABC123_xyz/gviz/tq?tqx=out:csv');
});

test('deriveCsvUrl carries the gid tab from the fragment', () => {
  const out = deriveCsvUrl('https://docs.google.com/spreadsheets/d/ABC123_xyz/edit#gid=42');
  assert.equal(out, 'https://docs.google.com/spreadsheets/d/ABC123_xyz/gviz/tq?tqx=out:csv&gid=42');
});

test('deriveCsvUrl passes through an existing output=csv URL', () => {
  const u = 'https://docs.google.com/spreadsheets/d/e/2PACX-pub/pub?output=csv';
  assert.equal(deriveCsvUrl(u), u);
});

test('deriveCsvUrl adds output=csv to a publish-to-web URL', () => {
  const out = deriveCsvUrl('https://docs.google.com/spreadsheets/d/e/2PACX-pub/pub?gid=0&single=true');
  assert.equal(out, 'https://docs.google.com/spreadsheets/d/e/2PACX-pub/pub?gid=0&single=true&output=csv');
});

test('deriveCsvUrl passes through a local .csv path', () => {
  assert.equal(deriveCsvUrl('./sample.csv'), './sample.csv');
});

test('deriveCsvUrl throws on a non-sheet URL', () => {
  assert.throws(() => deriveCsvUrl('https://example.com/nope'));
});
