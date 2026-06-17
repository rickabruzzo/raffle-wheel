import { CONFIG } from './config.js';
import { rowsToEntrants, excludeByDomain, dedupeByEmail, targetRotation } from './lib.js';

// XLSX is the global from vendor/xlsx.full.min.js (loaded as a classic script first).

const $ = (id) => document.getElementById(id);
const SIZE = 600, R = SIZE / 2, RADIUS = R - 8;
const LS_CONF = 'raffleConfName';
const LS_PRIZE = 'rafflePrizeTitle';

let canvas, ctx;
let entrants = [];        // current wheel (PII held only in memory, never persisted)
let candidate = -1;       // index in entrants of the person the wheel last landed on
let rot = 0, spinning = false, spinToken = 0;
let prizeImageUrl = null; // object URL, in memory only

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function truncate(s, max) { return s.length > max ? s.slice(0, max - 1) + '…' : s; }

function showMessage(text, isError) {
  const el = $('message');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
  el.hidden = false;
}

// ---------- view state ----------
function showSetup() {
  $('setup').hidden = false;
  $('draw').hidden = true;
  $('setupBtn').hidden = true;
  $('completeBtn').hidden = entrants.length === 0;
}
function showDraw() {
  $('setup').hidden = true;
  $('draw').hidden = false;
  $('setupBtn').hidden = false;
  $('completeBtn').hidden = false;
}

// ---------- prize + conference ----------
function updatePrizePanel() {
  const title = $('prizeTitle').value.trim();
  const view = $('prizeImgView');
  if (prizeImageUrl) { view.src = prizeImageUrl; view.hidden = false; }
  else { view.hidden = true; view.removeAttribute('src'); }
  $('prizeTitleView').textContent = title;
  const panel = $('prizePanel');
  panel.hidden = !(title || prizeImageUrl);
  panel.classList.toggle('no-img', !prizeImageUrl);
}

// ---------- file load + entrant pipeline ----------
async function loadFile(file) {
  if (!file) return;
  showMessage('Reading ' + file.name + '…', false);
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    if (typeof XLSX === 'undefined') throw new Error('Spreadsheet reader failed to load. Check your connection and reload.');
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('That file has no sheets.');
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });

    const mapped = rowsToEntrants(rows);
    const afterExclude = excludeByDomain(mapped, CONFIG.EXCLUDE_DOMAINS);
    const deduped = dedupeByEmail(afterExclude);
    const excluded = mapped.length - afterExclude.length;
    const merged = afterExclude.length - deduped.length;

    entrants = deduped;
    candidate = -1;
    rot = 0; spinToken++; spinning = false;

    const parts = [entrants.length + ' entrant' + (entrants.length === 1 ? '' : 's') + ' loaded'];
    if (excluded) parts.push('excluded ' + excluded + ' @' + CONFIG.EXCLUDE_DOMAINS.join('/'));
    if (merged) parts.push('merged ' + merged + ' duplicate' + (merged === 1 ? '' : 's'));
    showMessage(parts.join(' — '), false);

    showDraw();
    hideWinner();
    drawWheel();
    renderRemaining();
    updateControls();
  } catch (err) {
    showMessage(err.message || String(err), true);
    showSetup();
  }
}

// ---------- wheel ----------
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
    ? entrants.length + ' on the wheel'
    : 'no entrants left';
}

// ---------- spin + present-to-win ----------
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function spin() {
  if (spinning || entrants.length === 0) return;
  spinning = true;
  candidate = -1;
  $('spinBtn').disabled = true;
  $('controls').hidden = true;
  hideWinner();
  const myToken = ++spinToken;
  const w = Math.floor(Math.random() * entrants.length);
  const target = targetRotation(rot, w, entrants.length, 5);
  const start = rot, dur = 4500;
  let t0 = null;
  function frame(ts) {
    if (myToken !== spinToken) return;   // a reload/purge superseded this spin
    if (t0 === null) t0 = ts;
    const p = Math.min(1, (ts - t0) / dur);
    rot = start + (target - start) * easeOutCubic(p);
    drawWheel();
    if (p < 1) { requestAnimationFrame(frame); }
    else {
      spinning = false;
      candidate = w;
      $('spinBtn').disabled = false;
      showWinner(entrants[w]);
      fireConfetti();
      updateControls();
    }
  }
  requestAnimationFrame(frame);
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
function hideWinner() { $('winner').innerHTML = ''; }

function updateControls() {
  const hasCandidate = candidate >= 0 && !spinning;
  $('controls').hidden = !hasCandidate;
  $('spinBtn').disabled = entrants.length === 0 || spinning;
  $('spinBtn').textContent = entrants.length === 0
    ? 'No entrants left'
    : (candidate >= 0 ? 'Spin again' : 'Spin the wheel');
}

// "Not here" — the candidate wasn't present, so remove them and redraw.
function notHere() {
  if (candidate < 0 || candidate >= entrants.length) return;
  entrants.splice(candidate, 1);
  candidate = -1;
  hideWinner();
  if (entrants.length === 0) {
    drawWheel(); renderRemaining(); updateControls();
    showMessage('No entrants left — everyone drawn was marked not present. Upload a new file or finish.', false);
    return;
  }
  renderRemaining();
  spin();
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

// ---------- GDPR purge ----------
function raffleComplete() {
  if (entrants.length === 0 && candidate < 0) { return; }
  const ok = window.confirm('Raffle complete? This permanently deletes the uploaded entrants and all their data from this browser.');
  if (!ok) return;
  entrants = [];
  candidate = -1;
  rot = 0; spinToken++; spinning = false;
  $('odsFile').value = '';
  if (ctx) ctx.clearRect(0, 0, SIZE, SIZE);
  hideWinner();
  showMessage('Entrant data purged. Upload a new file to run another raffle.', false);
  showSetup();
}

// ---------- init ----------
function init() {
  canvas = $('wheel');
  ctx = canvas.getContext('2d');

  $('confName').value = localStorage.getItem(LS_CONF) || '';
  $('prizeTitle').value = localStorage.getItem(LS_PRIZE) || '';
  updatePrizePanel();

  $('confName').addEventListener('input', () => localStorage.setItem(LS_CONF, $('confName').value));
  $('prizeTitle').addEventListener('input', () => {
    localStorage.setItem(LS_PRIZE, $('prizeTitle').value);
    updatePrizePanel();
  });
  $('prizeImg').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (prizeImageUrl) { URL.revokeObjectURL(prizeImageUrl); prizeImageUrl = null; }
    if (file) prizeImageUrl = URL.createObjectURL(file);
    updatePrizePanel();
  });
  $('odsFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadFile(file);
  });

  $('spinBtn').addEventListener('click', spin);
  $('notHereBtn').addEventListener('click', notHere);
  $('setupBtn').addEventListener('click', showSetup);
  $('completeBtn').addEventListener('click', raffleComplete);

  showSetup();
}
init();
