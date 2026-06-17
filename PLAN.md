# Raffle Wheel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public Vercel web page that reads raffle entrants from a Google Sheet, spins a wheel, and reveals a random winner's first name, last name, and company.

**Architecture:** A single static site — plain HTML/CSS/vanilla JS, no framework, no build step. The browser fetches the published Google Sheet as CSV directly (Google sends permissive CORS). Pure logic (CSV parse, URL derivation, column mapping, wheel geometry) lives in a DOM-free ES module `lib.js` and is unit-tested with Node's built-in test runner; the DOM/canvas code lives in `app.js` and is verified by running the page.

**Tech Stack:** HTML5 Canvas, native ES modules, `node:test`/`node:assert` (zero-dependency tests), GitHub + Vercel auto-deploy.

**Working directory:** `/Users/rickabruzzo/Documents/raffle-wheel/` (already exists, contains `DESIGN.md` + this plan).

---

## File structure

```
raffle-wheel/
  index.html        markup; loads styles.css + app.js (module)
  styles.css        all styling
  config.js         CONFIG: SHEET_URL + tunables — the only file the owner edits
  lib.js            pure, DOM-free logic (ES module exports)
  app.js            fetch + DOM + canvas + spin + events (ES module)
  sample.csv        sample entrants for local verification
  test/lib.test.js  node:test unit tests for lib.js
  package.json      {"type":"module"} + test script (no dependencies)
  README.md         what it is, how to set SHEET_URL, how to deploy
  DESIGN.md         spec (already written)
  .gitignore
```

Each file has one responsibility. `lib.js` is pure and testable; `app.js` is the only file touching the DOM; `config.js` is the only file the owner edits.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `sample.csv`
- Create: `lib.js` (empty placeholder)
- Create: `test/lib.test.js` (empty placeholder)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "raffle-wheel",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.DS_Store
.vercel
*.log
```

- [ ] **Step 3: Create `sample.csv`** (used only for local verification; includes a quoted field with a comma to exercise the parser)

```
Timestamp,Email,First Name,Last Name,Company
2026-06-17 09:01,jordan@example.com,Jordan,Diaz,Pinball Wizards LLC
2026-06-17 09:02,mia@example.com,Mia,Chen,Tilt Labs
2026-06-17 09:03,sam@example.com,Sam,Okafor,"Flipper, Co"
2026-06-17 09:04,ava@example.com,Ava,Romano,Bumper Studios
2026-06-17 09:05,leo@example.com,Leo,Park,Plunger Inc
2026-06-17 09:06,noah@example.com,Noah,Khan,Multiball Media
2026-06-17 09:07,zoe@example.com,Zoe,Adams,Drop Target Design
2026-06-17 09:08,eli@example.com,Eli,Brooks,Replay Games
```

- [ ] **Step 4: Create empty `lib.js`**

```js
// Pure, DOM-free helpers for the raffle wheel. Tested in test/lib.test.js.
```

- [ ] **Step 5: Create empty `test/lib.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
```

- [ ] **Step 6: Initialize git and commit**

```bash
cd "/Users/rickabruzzo/Documents/raffle-wheel"
git init
git add -A
git commit -m "chore: scaffold raffle-wheel project"
```

---

### Task 2: CSV parser (`parseCSV`)

**Files:**
- Modify: `lib.js`
- Test: `test/lib.test.js`

- [ ] **Step 1: Write the failing tests** — append to `test/lib.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/lib.test.js`
Expected: FAIL — `parseCSV is not a function` (not yet exported).

- [ ] **Step 3: Implement `parseCSV`** — append to `lib.js`:

```js
export function parseCSV(text) {
  text = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [], field = '', inQuotes = false, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/lib.test.js`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib.js test/lib.test.js
git commit -m "feat(lib): add CSV parser"
```

---

### Task 3: Sheet URL → CSV endpoint (`deriveCsvUrl`)

**Files:**
- Modify: `lib.js`
- Test: `test/lib.test.js`

- [ ] **Step 1: Write the failing tests** — append to `test/lib.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/lib.test.js`
Expected: FAIL — `deriveCsvUrl is not a function`.

- [ ] **Step 3: Implement `deriveCsvUrl`** — append to `lib.js`:

```js
export function deriveCsvUrl(sheetUrl) {
  const url = String(sheetUrl || '').trim();
  if (!url) throw new Error('No sheet URL configured');
  if (url.endsWith('.csv')) return url;
  if (url.includes('output=csv')) return url;
  if (url.includes('/spreadsheets/d/e/')) {
    const base = url.split('#')[0];
    const sep = base.includes('?') ? '&' : '?';
    return base + sep + 'output=csv';
  }
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error('Could not find a Google Sheet id in that URL');
  const id = idMatch[1];
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  let out = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
  if (gidMatch) out += `&gid=${gidMatch[1]}`;
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/lib.test.js`
Expected: PASS — all `deriveCsvUrl` tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib.js test/lib.test.js
git commit -m "feat(lib): derive CSV endpoint from sheet URL"
```

---

### Task 4: Column detection + row mapping (`findColumns`, `rowsToEntrants`)

**Files:**
- Modify: `lib.js`
- Test: `test/lib.test.js`

- [ ] **Step 1: Write the failing tests** — append to `test/lib.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/lib.test.js`
Expected: FAIL — `findColumns is not a function`.

- [ ] **Step 3: Implement the functions** — append to `lib.js`:

```js
function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

export function findColumns(headerRow) {
  const h = (headerRow || []).map(norm);
  return {
    first: h.findIndex(x => x.includes('first')),
    last: h.findIndex(x => x.includes('last')),
    company: h.findIndex(x =>
      x.includes('company') || x.includes('organization') || x.includes('organisation') ||
      x === 'org' || x.includes('employer')),
    name: h.findIndex(x => x === 'name' || x.includes('full name')),
  };
}

export function rowsToEntrants(rows) {
  if (!rows || rows.length < 2) throw new Error('The sheet has no data rows.');
  const cols = findColumns(rows[0]);
  if (cols.first < 0 && cols.last < 0 && cols.name < 0) {
    throw new Error(
      'Could not find name columns. Expected headers containing "First"/"Last" or "Name". Saw: ' +
      rows[0].join(', '));
  }
  const useSplit = (cols.first < 0 || cols.last < 0) && cols.name >= 0;
  const entrants = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (row.every(c => norm(c) === '')) continue;
    let first = '', last = '';
    if (useSplit) {
      const full = String(row[cols.name] || '').trim();
      const sp = full.indexOf(' ');
      if (sp === -1) { first = full; last = ''; }
      else { first = full.slice(0, sp); last = full.slice(sp + 1).trim(); }
    } else {
      first = cols.first >= 0 ? String(row[cols.first] || '').trim() : '';
      last = cols.last >= 0 ? String(row[cols.last] || '').trim() : '';
    }
    const company = cols.company >= 0 ? String(row[cols.company] || '').trim() : '';
    if (first === '' && last === '' && company === '') continue;
    entrants.push({ first, last, company });
  }
  if (entrants.length === 0) throw new Error('No entrants found in the sheet.');
  return entrants;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/lib.test.js`
Expected: PASS — all column/mapping tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib.js test/lib.test.js
git commit -m "feat(lib): detect columns and map rows to entrants"
```

---

### Task 5: Wheel geometry (`sliceUnderPointer`, `targetRotation`)

This is the correctness guarantee: pick the winner first, then compute a rotation that lands that winner's slice under the top pointer. The test proves `sliceUnderPointer(targetRotation(...)) === winnerIndex`.

**Files:**
- Modify: `lib.js`
- Test: `test/lib.test.js`

- [ ] **Step 1: Write the failing tests** — append to `test/lib.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/lib.test.js`
Expected: FAIL — `sliceUnderPointer is not a function`.

- [ ] **Step 3: Implement the geometry** — append to `lib.js`:

```js
const TAU = Math.PI * 2;

export function sliceUnderPointer(rot, n) {
  const seg = TAU / n;
  const m = (((-rot) % TAU) + TAU) % TAU;
  return Math.floor(m / seg) % n;
}

export function targetRotation(currentRot, winnerIndex, n, spins = 5) {
  const seg = TAU / n;
  const baseRot = -((winnerIndex * seg) + seg / 2);
  const delta = (((baseRot - currentRot) % TAU) + TAU) % TAU;
  return currentRot + TAU * spins + delta;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/lib.test.js`
Expected: PASS — geometry tests passing, all earlier tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib.js test/lib.test.js
git commit -m "feat(lib): wheel geometry guarantees spin lands on chosen winner"
```

---

### Task 6: Config module (`config.js`)

**Files:**
- Create: `config.js`

- [ ] **Step 1: Create `config.js`**

```js
// The only file you edit. Paste your published Google Sheet link into SHEET_URL.
// The sheet must be shared as "anyone with the link can view" (or Published to web).
export const CONFIG = {
  // e.g. "https://docs.google.com/spreadsheets/d/<your-id>/edit#gid=0"
  // Leave as "./sample.csv" to preview with bundled sample data.
  SHEET_URL: "./sample.csv",

  // Above this many entrants, slices render without text (names become unreadable).
  MAX_LABELS: 40,

  // Slice colors (cycled). Tweak to match your event/brand.
  COLORS: ["#7F77DD", "#1D9E75", "#D85A30", "#378ADD", "#EF9F27", "#639922", "#D4537E"],
};
```

- [ ] **Step 2: Commit**

```bash
git add config.js
git commit -m "feat: add editable config (SHEET_URL + tunables)"
```

---

### Task 7: Markup + styles (`index.html`, `styles.css`)

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Raffle wheel</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <h1>Raffle wheel</h1>
    <div class="topbar-right">
      <span id="remaining" class="remaining"></span>
      <button id="resetBtn" type="button">Reload from sheet</button>
    </div>
  </header>

  <div id="message" class="message" hidden></div>

  <div class="layout">
    <main class="stage">
      <div class="wheel-wrap">
        <canvas id="wheel" width="600" height="600" aria-label="Raffle wheel"></canvas>
        <div class="pointer" aria-hidden="true"></div>
        <div class="hub" aria-hidden="true"></div>
        <canvas id="confetti" class="confetti" aria-hidden="true"></canvas>
      </div>
      <button id="spinBtn" class="spin-btn" type="button">Spin the wheel</button>
      <div id="winner" aria-live="polite"></div>
      <div id="controls" class="controls" hidden>
        <button id="removeBtn" type="button">Remove winner &amp; spin again</button>
        <button id="keepBtn" type="button">Keep &amp; spin again</button>
      </div>
    </main>

    <aside class="winners-panel">
      <h2>Winners</h2>
      <ol id="winnersList" class="winners-list"></ol>
    </aside>
  </div>

  <details class="override">
    <summary>Use a different sheet (this browser only)</summary>
    <div class="override-row">
      <input id="sheetOverride" type="url" placeholder="Paste a Google Sheet link" />
      <button id="applyOverride" type="button">Use this sheet</button>
      <button id="clearOverride" type="button">Clear</button>
    </div>
  </details>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `styles.css`**

```css
:root {
  --bg: #0b1220;
  --surface: #131c2e;
  --text: #eef2f7;
  --muted: #9aa7bd;
  --border: #2a3650;
  --accent: #7F77DD;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  padding: 16px;
}
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap; margin-bottom: 12px;
}
.topbar h1 { font-size: 22px; font-weight: 600; margin: 0; }
.topbar-right { display: flex; align-items: center; gap: 12px; }
.remaining { color: var(--muted); font-size: 14px; }
button {
  font: inherit; color: var(--text); background: var(--surface);
  border: 1px solid var(--border); border-radius: 10px;
  padding: 10px 16px; cursor: pointer;
}
button:hover { border-color: var(--accent); }
button:disabled { opacity: 0.5; cursor: default; }
.spin-btn {
  font-size: 18px; padding: 14px 28px; border-radius: 999px;
  background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600;
}
.message {
  border: 1px solid var(--border); background: var(--surface);
  border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; max-width: 720px;
}
.message.error { border-color: #a3402d; }
.layout { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
.stage { display: flex; flex-direction: column; align-items: center; gap: 18px; flex: 1 1 360px; }
.wheel-wrap { position: relative; width: 360px; height: 360px; max-width: 90vw; }
#wheel { width: 100%; height: 100%; display: block; }
.confetti { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.pointer {
  position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
  width: 0; height: 0; border-left: 15px solid transparent; border-right: 15px solid transparent;
  border-top: 26px solid var(--text);
}
.hub {
  position: absolute; top: 50%; left: 50%; width: 60px; height: 60px;
  margin: -30px 0 0 -30px; border-radius: 50%; background: var(--surface);
  border: 2px solid var(--border);
}
#winner:empty { display: none; }
.winner-card {
  display: flex; align-items: center; gap: 16px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; min-width: 280px;
}
.avatar {
  flex: 0 0 auto; width: 52px; height: 52px; border-radius: 50%;
  background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 18px;
}
.winner-label { font-size: 13px; color: var(--muted); }
.winner-name { font-size: 26px; font-weight: 600; line-height: 1.2; }
.winner-company { font-size: 16px; color: var(--muted); margin-top: 2px; }
.controls { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.winners-panel { flex: 0 1 240px; }
.winners-panel h2 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
.winners-list { margin: 0; padding-left: 20px; color: var(--text); }
.winners-list li { margin: 4px 0; }
.winners-list .co { color: var(--muted); font-size: 13px; }
.override { margin-top: 24px; color: var(--muted); max-width: 720px; }
.override summary { cursor: pointer; }
.override-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.override-row input {
  flex: 1 1 280px; font: inherit; color: var(--text); background: var(--surface);
  border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;
}
```

- [ ] **Step 3: Commit**

```bash
git add index.html styles.css
git commit -m "feat: page markup and styles"
```

---

### Task 8: Load entrants + render wheel (`app.js` part 1)

**Files:**
- Create: `app.js`

- [ ] **Step 1: Create `app.js`** with state, loading, and rendering:

```js
import { CONFIG } from './config.js';
import { parseCSV, deriveCsvUrl, rowsToEntrants, sliceUnderPointer, targetRotation } from './lib.js';

const $ = (id) => document.getElementById(id);
const SIZE = 600, R = SIZE / 2, RADIUS = R - 8;

let canvas, ctx;
let allEntrants = [];   // full list loaded from the sheet
let entrants = [];      // current wheel (after removals)
let winners = [];       // [{first,last,company}]
let rot = 0;            // current wheel rotation (radians)
let spinning = false;
let lastWinnerIndex = -1;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function truncate(s, max) { return s.length > max ? s.slice(0, max - 1) + '…' : s; }

function activeSheetUrl() {
  return localStorage.getItem('raffleSheetOverride') || CONFIG.SHEET_URL || '';
}

function showMessage(text, isError) {
  const el = $('message');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
  el.hidden = false;
}
function clearMessage() { $('message').hidden = true; }

async function loadEntrants() {
  const sheetUrl = activeSheetUrl();
  if (!sheetUrl) {
    showMessage('No sheet configured yet. Open config.js and set SHEET_URL, or use the "different sheet" box below.', false);
    return;
  }
  showMessage('Loading entrants…', false);
  try {
    const res = await fetch(deriveCsvUrl(sheetUrl));
    if (!res.ok) {
      throw new Error(`Could not load the sheet (HTTP ${res.status}). Make sure it is shared as “anyone with the link can view”.`);
    }
    const rows = parseCSV(await res.text());
    allEntrants = rowsToEntrants(rows);
    entrants = allEntrants.slice();
    winners = [];
    lastWinnerIndex = -1;
    clearMessage();
    hideWinner();
    renderAll();
  } catch (err) {
    showMessage(err.message || String(err), true);
  }
}

function renderAll() {
  drawWheel();
  renderWinnersList();
  renderRemaining();
  updateControls();
}

function drawWheel() {
  const n = entrants.length;
  ctx.clearRect(0, 0, SIZE, SIZE);
  if (n === 0) {
    ctx.save(); ctx.translate(R, R);
    ctx.beginPath(); ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(127,119,221,0.15)'; ctx.fill();
    ctx.restore();
    return;
  }
  const seg = (Math.PI * 2) / n;
  const showLabels = n <= CONFIG.MAX_LABELS;
  const colors = CONFIG.COLORS;
  const fam = getComputedStyle(document.body).fontFamily || 'sans-serif';
  ctx.save();
  ctx.translate(R, R);
  ctx.rotate(rot);
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, RADIUS, a0, a1); ctx.closePath();
    ctx.fillStyle = colors[i % colors.length]; ctx.fill();
    ctx.lineWidth = n > 60 ? 1 : 3; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
    if (showLabels) {
      ctx.save();
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
      ctx.font = `500 ${n > 24 ? 16 : 22}px ${fam}`;
      const label = entrants[i].first || entrants[i].last || '—';
      ctx.fillText(truncate(label, 16), RADIUS - 18, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

function renderRemaining() {
  $('remaining').textContent = entrants.length
    ? `${entrants.length} on the wheel · ${winners.length} drawn`
    : 'everyone has won';
}

// Stubs completed in Task 9 and Task 10.
function renderWinnersList() {}
function updateControls() {}
function hideWinner() { $('winner').innerHTML = ''; }

function init() {
  canvas = $('wheel');
  ctx = canvas.getContext('2d');
  $('resetBtn').addEventListener('click', loadEntrants);
  loadEntrants();
}
init();
```

- [ ] **Step 2: Serve and verify the wheel renders**

Run:
```bash
cd "/Users/rickabruzzo/Documents/raffle-wheel"
python3 -m http.server 5000
```
Open `http://localhost:5000` in a browser.
Expected: the wheel renders 8 colored slices with the sample first names (Jordan, Mia, Sam, …); the top bar shows "8 on the wheel · 0 drawn"; no error message. Stop the server with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: load entrants from sheet and render the wheel"
```

---

### Task 9: Spin + winner reveal + confetti (`app.js` part 2)

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add spin, reveal, and confetti.** Replace the `function hideWinner() { $('winner').innerHTML = ''; }` line and add the new functions. In `app.js`, replace:

```js
function hideWinner() { $('winner').innerHTML = ''; }
```

with:

```js
function hideWinner() { $('winner').innerHTML = ''; }

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function spin() {
  if (spinning || entrants.length === 0) return;
  spinning = true;
  $('spinBtn').disabled = true;
  $('controls').hidden = true;
  hideWinner();
  const w = Math.floor(Math.random() * entrants.length);
  const target = targetRotation(rot, w, entrants.length, 5);
  const start = rot, dur = 4500;
  let t0 = null;
  function frame(ts) {
    if (t0 === null) t0 = ts;
    const p = Math.min(1, (ts - t0) / dur);
    rot = start + (target - start) * easeOutCubic(p);
    drawWheel();
    if (p < 1) { requestAnimationFrame(frame); }
    else {
      spinning = false;
      $('spinBtn').disabled = false;
      lastWinnerIndex = w;
      onWin(w);
    }
  }
  requestAnimationFrame(frame);
}

function onWin(index) {
  const winner = entrants[index];
  winners.push(winner);
  showWinner(winner);
  fireConfetti();
  renderWinnersList();
  renderRemaining();
  updateControls();
}

function showWinner(p) {
  const ini = ((p.first[0] || '') + (p.last[0] || '')).toUpperCase() || '★';
  const name = (p.first + ' ' + p.last).trim() || '(no name)';
  $('winner').innerHTML =
    `<div class="winner-card">
       <div class="avatar">${escapeHtml(ini)}</div>
       <div>
         <div class="winner-label">Winner</div>
         <div class="winner-name">${escapeHtml(name)}</div>
         <div class="winner-company">${escapeHtml(p.company || '')}</div>
       </div>
     </div>`;
}

function fireConfetti() {
  const cv = $('confetti');
  const W = cv.width = cv.offsetWidth;
  const H = cv.height = cv.offsetHeight;
  const cx = cv.getContext('2d');
  const colors = CONFIG.COLORS;
  const parts = [];
  for (let i = 0; i < 120; i++) {
    parts.push({
      x: W / 2 + (Math.random() - 0.5) * 120, y: H * 0.32,
      vx: (Math.random() - 0.5) * 9, vy: Math.random() * -9 - 3,
      g: 0.28 + Math.random() * 0.2, size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    });
  }
  let frames = 0;
  function step() {
    cx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot);
      cx.fillStyle = p.color; cx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); cx.restore();
    }
    frames++;
    if (frames < 150) requestAnimationFrame(step); else cx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(step);
}
```

- [ ] **Step 2: Wire the Spin button.** In `init()`, add the spin listener. Replace:

```js
  $('resetBtn').addEventListener('click', loadEntrants);
```

with:

```js
  $('resetBtn').addEventListener('click', loadEntrants);
  $('spinBtn').addEventListener('click', spin);
```

- [ ] **Step 3: Serve and verify the spin lands correctly**

Run: `python3 -m http.server 5000` and open `http://localhost:5000`.
Expected: clicking "Spin the wheel" spins ~4.5s, decelerates, and stops with one slice under the top pointer; the winner card shows that exact person's first + last name and company; a confetti burst plays. Spin several times — the card always matches the slice under the pointer. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: spin animation, winner reveal, and confetti"
```

---

### Task 10: Remove/keep/reset, winners list, controls, override (`app.js` part 3)

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Replace the Task 8 stubs.** In `app.js`, replace:

```js
// Stubs completed in Task 9 and Task 10.
function renderWinnersList() {}
function updateControls() {}
```

with:

```js
function renderWinnersList() {
  $('winnersList').innerHTML = winners.map(w => {
    const name = escapeHtml((w.first + ' ' + w.last).trim() || '(no name)');
    const co = w.company ? ` <span class="co">— ${escapeHtml(w.company)}</span>` : '';
    return `<li>${name}${co}</li>`;
  }).join('');
}

function updateControls() {
  const controls = $('controls');
  const hasWinnerShown = !!$('winner').innerHTML.trim();
  controls.hidden = !hasWinnerShown || entrants.length === 0;
  $('spinBtn').disabled = entrants.length === 0 || spinning;
  if (entrants.length === 0) {
    $('spinBtn').textContent = 'Everyone has won';
  } else {
    $('spinBtn').textContent = winners.length ? 'Spin again' : 'Spin the wheel';
  }
}

function removeAndRespin() {
  if (lastWinnerIndex >= 0 && lastWinnerIndex < entrants.length) {
    entrants.splice(lastWinnerIndex, 1);
    lastWinnerIndex = -1;
  }
  hideWinner();
  if (entrants.length === 0) {
    drawWheel(); renderRemaining(); updateControls();
    showMessage('Everyone has won. Use "Reload from sheet" to start over.', false);
    return;
  }
  renderAll();
  spin();
}

function keepAndRespin() {
  hideWinner();
  renderAll();
  spin();
}

function applyOverride() {
  const val = $('sheetOverride').value.trim();
  if (!val) return;
  localStorage.setItem('raffleSheetOverride', val);
  loadEntrants();
}

function clearOverride() {
  localStorage.removeItem('raffleSheetOverride');
  $('sheetOverride').value = '';
  loadEntrants();
}
```

- [ ] **Step 2: Wire the remaining buttons.** In `init()`, replace:

```js
  $('resetBtn').addEventListener('click', loadEntrants);
  $('spinBtn').addEventListener('click', spin);
```

with:

```js
  $('resetBtn').addEventListener('click', loadEntrants);
  $('spinBtn').addEventListener('click', spin);
  $('removeBtn').addEventListener('click', removeAndRespin);
  $('keepBtn').addEventListener('click', keepAndRespin);
  $('applyOverride').addEventListener('click', applyOverride);
  $('clearOverride').addEventListener('click', clearOverride);
```

- [ ] **Step 3: Serve and verify the full flow**

Run: `python3 -m http.server 5000` and open `http://localhost:5000`.
Verify:
- Spin → winner shown → "Remove winner & spin again" removes that person (count drops by 1, they don't reappear) and immediately spins again.
- "Keep & spin again" re-spins with the same list.
- Each win appends to the Winners list with name + company.
- Removing until empty shows the "Everyone has won" state; "Reload from sheet" restores all 8.
- In "Use a different sheet", entering a bad URL shows a clear error; "Clear" returns to the configured sheet.
Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: remove/keep/reset flow, winners list, and sheet override"
```

---

### Task 11: README + deploy to Vercel

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
# Raffle wheel

A web page that reads raffle entrants from a Google Sheet, spins a wheel, and
reveals a random winner (first name, last name, company). Hosted on Vercel.

## Configure your sheet

1. In Google Sheets: Share → General access → "Anyone with the link" → Viewer.
   (Or File → Share → Publish to web.)
2. Copy the sheet URL from the address bar.
3. Open `config.js` and paste it into `SHEET_URL`. The sheet needs columns whose
   headers contain "First", "Last", and "Company" (extra columns are ignored).
4. Commit and push — Vercel redeploys automatically.

Entrant changes in the sheet show up on the next page load — no redeploy needed.

## Run locally

```bash
python3 -m http.server 5000
# open http://localhost:5000
```

Leave `SHEET_URL` as `./sample.csv` to preview with bundled sample data.

## Tests

```bash
node --test
```

## Deploy

Connected to Vercel via GitHub: every push to `main` auto-deploys. No build step
(static site).
````

- [ ] **Step 2: Run the full test suite once more**

Run: `node --test`
Expected: PASS — all `lib.js` tests green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

- [ ] **Step 4: Create the public GitHub repo and push** (requires the owner's GitHub auth; confirm before running)

```bash
cd "/Users/rickabruzzo/Documents/raffle-wheel"
gh repo create raffle-wheel --public --source=. --remote=origin --push
```
Expected: repo created and `main` pushed.

- [ ] **Step 5: Connect to Vercel (owner, in the Vercel dashboard)**

1. Vercel dashboard → Add New… → Project → import the `raffle-wheel` repo.
2. Framework preset: "Other". Leave build & output settings empty (static site).
3. Deploy. Vercel returns a public URL (e.g. `raffle-wheel.vercel.app`).

- [ ] **Step 6: Verify the deployed site**

Open the Vercel URL in incognito / on a phone (no laptop server running).
Expected: the wheel loads the sample entrants and spins. After setting a real
`SHEET_URL` in `config.js` and pushing, the deployed wheel shows real entrants.

---

## Self-review

**Spec coverage:**
- Read sheet via share/publish link → `deriveCsvUrl` + `fetch` (Tasks 3, 8). ✓
- Separate First/Last/Company columns, found by header, extras ignored → `findColumns`/`rowsToEntrants` (Task 4). ✓
- Each row = one slice → `drawWheel` (Task 8). ✓
- Spin lands on a truly random winner, chosen first → `targetRotation`/`sliceUnderPointer` proven in tests + `spin` (Tasks 5, 9). ✓
- Winner card: First Last + Company + confetti → `showWinner`/`fireConfetti` (Task 9). ✓
- Remove winner & spin again / keep / reset → Task 10. ✓
- Winners list + remaining count → Task 10 / Task 8. ✓
- Names on slices ≤ MAX_LABELS, else colored only → `drawWheel` (Task 8). ✓
- Config baked in (`config.js` SHEET_URL) + per-browser override → Tasks 6, 10. ✓
- Error/edge states (load fail, no rows, no columns, all drawn) → `loadEntrants`/`rowsToEntrants`/`removeAndRespin` (Tasks 4, 8, 10). ✓
- Public Vercel site, GitHub auto-deploy → Task 11. ✓

**Placeholder scan:** Task 8 intentionally defines `renderWinnersList`/`updateControls` as stubs, then Task 10 replaces them with full implementations (called out explicitly). No "TBD"/"handle edge cases" placeholders remain.

**Type consistency:** `CONFIG.{SHEET_URL,MAX_LABELS,COLORS}` used consistently; `lib.js` exports (`parseCSV`, `deriveCsvUrl`, `findColumns`, `rowsToEntrants`, `sliceUnderPointer`, `targetRotation`) match imports in `app.js`; DOM ids in `index.html` (`wheel`, `confetti`, `spinBtn`, `winner`, `controls`, `removeBtn`, `keepBtn`, `resetBtn`, `winnersList`, `remaining`, `message`, `sheetOverride`, `applyOverride`, `clearOverride`) match every `$()` lookup in `app.js`. `lastWinnerIndex` set in `spin`, used in `removeAndRespin`. ✓
