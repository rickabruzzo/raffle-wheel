import { CONFIG } from './config.js';
import { parseCSV, deriveCsvUrl, rowsToEntrants, targetRotation } from './lib.js';

const $ = (id) => document.getElementById(id);
const SIZE = 600, R = SIZE / 2, RADIUS = R - 8;

let canvas, ctx;
let allEntrants = [];   // full list loaded from the sheet
let entrants = [];      // current wheel (after removals)
let winners = [];       // [{first,last,company}]
let rot = 0;            // current wheel rotation (radians)
let spinning = false;
let spinToken = 0;      // bumped whenever the entrant list changes, to cancel a stale spin
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
      throw new Error(`Could not load the sheet (HTTP ${res.status}). Make sure it is shared as "anyone with the link can view".`);
    }
    const rows = parseCSV(await res.text());
    allEntrants = rowsToEntrants(rows);
    spinToken++;        // supersede any spin animation still in flight
    spinning = false;
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

function hideWinner() { $('winner').innerHTML = ''; }

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function spin() {
  if (spinning || entrants.length === 0) return;
  spinning = true;
  const myToken = ++spinToken;
  $('spinBtn').disabled = true;
  $('controls').hidden = true;
  hideWinner();
  const w = Math.floor(Math.random() * entrants.length);
  const target = targetRotation(rot, w, entrants.length, 5);
  const start = rot, dur = 4500;
  let t0 = null;
  function frame(ts) {
    if (myToken !== spinToken) return;   // a reload/reset superseded this spin
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

function init() {
  canvas = $('wheel');
  ctx = canvas.getContext('2d');
  $('resetBtn').addEventListener('click', loadEntrants);
  $('spinBtn').addEventListener('click', spin);
  $('removeBtn').addEventListener('click', removeAndRespin);
  $('keepBtn').addEventListener('click', keepAndRespin);
  $('applyOverride').addEventListener('click', applyOverride);
  $('clearOverride').addEventListener('click', clearOverride);
  loadEntrants();
}
init();
