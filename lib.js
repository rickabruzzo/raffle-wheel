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
