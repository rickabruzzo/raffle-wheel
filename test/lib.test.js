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

import { findColumns, rowsToEntrants } from '../lib.js';

test('findColumns locates first/last/company among extra columns', () => {
  const cols = findColumns(['Timestamp', 'Email', 'First Name', 'Last Name', 'Company']);
  assert.equal(cols.first, 2);
  assert.equal(cols.last, 3);
  assert.equal(cols.company, 4);
});

test('rowsToEntrants maps separate columns and ignores extras', () => {
  const rows = [
    ['Timestamp', 'First Name', 'Last Name', 'Company'],
    ['09:01', 'Mia', 'Chen', 'Tilt Labs'],
  ];
  assert.deepEqual(rowsToEntrants(rows), [{ first: 'Mia', last: 'Chen', company: 'Tilt Labs' }]);
});

test('rowsToEntrants splits a combined Name column', () => {
  const rows = [['Name', 'Company'], ['Ada Lovelace', 'Analytical Engines']];
  assert.deepEqual(rowsToEntrants(rows), [{ first: 'Ada', last: 'Lovelace', company: 'Analytical Engines' }]);
});

test('rowsToEntrants skips fully blank rows', () => {
  const rows = [['First', 'Last', 'Company'], ['', '', ''], ['Sam', 'Okafor', 'Flipper']];
  assert.equal(rowsToEntrants(rows).length, 1);
});

test('rowsToEntrants throws when no name columns exist', () => {
  assert.throws(() => rowsToEntrants([['Color', 'Size'], ['red', 'L']]));
});

import { sliceUnderPointer, targetRotation } from '../lib.js';

test('sliceUnderPointer returns slice 0 at rest', () => {
  assert.equal(sliceUnderPointer(0, 6), 0);
});

test('targetRotation lands on the chosen winner for many sizes', () => {
  for (const n of [1, 2, 3, 4, 8, 13, 40, 137]) {
    for (let w = 0; w < n; w++) {
      const target = targetRotation(0, w, n, 5);
      assert.equal(sliceUnderPointer(target, n), w, `n=${n} w=${w}`);
    }
  }
});

test('targetRotation always spins forward past the requested turns', () => {
  const n = 10;
  const target = targetRotation(1.234, 3, n, 5);
  assert.ok(target >= 1.234 + Math.PI * 2 * 5);
});
