import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findColumns, rowsToEntrants } from '../lib.js';

test('findColumns locates first/last/company/email among extra columns', () => {
  const cols = findColumns(['Timestamp', 'Email', 'First Name', 'Last Name', 'Company']);
  assert.equal(cols.first, 2);
  assert.equal(cols.last, 3);
  assert.equal(cols.company, 4);
  assert.equal(cols.email, 1);
});

test('rowsToEntrants maps columns incl. email and ignores extras', () => {
  const rows = [
    ['Timestamp', 'Email', 'First Name', 'Last Name', 'Company'],
    ['09:01', 'mia@example.com', 'Mia', 'Chen', 'Tilt Labs'],
  ];
  assert.deepEqual(rowsToEntrants(rows), [
    { first: 'Mia', last: 'Chen', company: 'Tilt Labs', email: 'mia@example.com' },
  ]);
});

test('rowsToEntrants gives empty email when there is no email column', () => {
  const rows = [['First', 'Last', 'Company'], ['Sam', 'Okafor', 'Flipper']];
  assert.deepEqual(rowsToEntrants(rows), [
    { first: 'Sam', last: 'Okafor', company: 'Flipper', email: '' },
  ]);
});

test('rowsToEntrants splits a combined Name column', () => {
  const rows = [['Name', 'Email', 'Company'], ['Ada Lovelace', 'ada@x.com', 'Analytical Engines']];
  assert.deepEqual(rowsToEntrants(rows), [
    { first: 'Ada', last: 'Lovelace', company: 'Analytical Engines', email: 'ada@x.com' },
  ]);
});

test('rowsToEntrants skips fully blank rows', () => {
  const rows = [['First', 'Last', 'Company'], ['', '', ''], ['Sam', 'Okafor', 'Flipper']];
  assert.equal(rowsToEntrants(rows).length, 1);
});

test('rowsToEntrants throws when no name columns exist', () => {
  assert.throws(() => rowsToEntrants([['Color', 'Size'], ['red', 'L']]));
});

import { excludeByDomain } from '../lib.js';

const E = (email) => ({ first: 'A', last: 'B', company: 'C', email });

test('excludeByDomain drops exact-domain and subdomain matches, case-insensitively', () => {
  const list = [E('a@example.com'), E('RICK@Honeycomb.IO'), E('qa@eng.honeycomb.io')];
  const kept = excludeByDomain(list, ['honeycomb.io']);
  assert.deepEqual(kept.map(e => e.email), ['a@example.com']);
});

test('excludeByDomain keeps look-alike domains and entries with no email', () => {
  const list = [E('a@fakehoneycomb.io'), E('b@honeycomb.io.evil.com'), E('')];
  const kept = excludeByDomain(list, ['honeycomb.io']);
  assert.equal(kept.length, 3);
});

test('excludeByDomain with no domains keeps everyone', () => {
  assert.equal(excludeByDomain([E('a@honeycomb.io')], []).length, 1);
});

import { dedupeByEmail } from '../lib.js';

test('dedupeByEmail keeps first per email, case-insensitive', () => {
  const list = [E('mia@x.com'), E('MIA@x.com'), E('sam@x.com')];
  const out = dedupeByEmail(list);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(e => e.email), ['mia@x.com', 'sam@x.com']);
});

test('dedupeByEmail keeps all rows that have no email', () => {
  const list = [E(''), E(''), E('a@x.com')];
  assert.equal(dedupeByEmail(list).length, 3);
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
