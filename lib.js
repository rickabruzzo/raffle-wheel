// Pure, DOM-free helpers for the raffle wheel. Tested in test/lib.test.js.

function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

export function findColumns(headerRow) {
  const h = (headerRow || []).map(norm);
  return {
    first: h.findIndex(x => x.includes('first')),
    last: h.findIndex(x => x.includes('last')),
    company: h.findIndex(x =>
      x.includes('company') || x.includes('organization') || x.includes('organisation') ||
      x === 'org' || x.includes('employer')),
    email: h.findIndex(x => x.includes('email') || x.includes('e-mail')),
    name: h.findIndex(x => x === 'name' || x.includes('full name')),
  };
}

export function rowsToEntrants(rows) {
  if (!rows || rows.length < 2) throw new Error('The spreadsheet has no data rows.');
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
    const email = cols.email >= 0 ? String(row[cols.email] || '').trim() : '';
    if (first === '' && last === '' && company === '') continue;
    entrants.push({ first, last, company, email });
  }
  if (entrants.length === 0) throw new Error('No entrants found in the spreadsheet.');
  return entrants;
}

function emailDomain(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  return at === -1 ? '' : e.slice(at + 1);
}

// Drop entrants whose email domain matches a listed domain exactly or as a
// subdomain (e.g. "honeycomb.io" also drops "eng.honeycomb.io"). Entrants with
// no email cannot match and are kept.
export function excludeByDomain(entrants, domains) {
  const bad = (domains || []).map(d => String(d).trim().toLowerCase()).filter(Boolean);
  if (!bad.length) return entrants.slice();
  return entrants.filter(e => {
    const dom = emailDomain(e.email);
    if (!dom) return true;
    return !bad.some(d => dom === d || dom.endsWith('.' + d));
  });
}

// Keep the first entrant per unique email (case-insensitive). Entrants with no
// email are all kept (nothing to de-duplicate on).
export function dedupeByEmail(entrants) {
  const seen = new Set();
  const out = [];
  for (const e of entrants) {
    const key = String(e.email || '').trim().toLowerCase();
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(e);
  }
  return out;
}

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
