// Pure, DOM-free helpers for the raffle wheel. Tested in test/lib.test.js.

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
