import { CONFIG } from './config.js';
import { rowsToEntrants, excludeByDomain, dedupeByEmail, targetRotation, sliceUnderPointer } from './lib.js';

// XLSX is the global from vendor/xlsx.full.min.js (loaded as a classic script first).

const $ = (id) => document.getElementById(id);
const SIZE = 600, R = SIZE / 2, RADIUS = R - 8;
const LS_CONF = 'raffleConfName';
const LS_PRIZE = 'rafflePrizeTitle';

let canvas, ctx;
let entrants = [];        // current wheel (PII held only in memory, never persisted)
let candidate = -1;       // index in entrants the wheel last landed on
let rot = 0, spinning = false, spinToken = 0;
let prizeImageUrl = null; // object URL, in memory only

// sound
let audioCtx = null, muted = false;
let lastSlice = -1, lastTickTime = 0;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setSetupMsg(text, isError) {
  const el = $('setupMsg');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
  el.hidden = !text;
}

// ---------- view state ----------
function showSetup() {
  $('setup').hidden = false;
  $('draw').hidden = true;
  $('setupBtn').hidden = true;
  $('completeBtn').hidden = entrants.length === 0;
  $('remaining').hidden = true;
  hideOverlay();
}
function showDraw() {
  $('setup').hidden = true;
  $('draw').hidden = false;
  $('setupBtn').hidden = false;
  $('completeBtn').hidden = false;
  $('remaining').hidden = false;
  updatePrizePanel();
  sizeWheel();
  drawWheel();
  renderRemaining();
  updateSpinButton();
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
  setSetupMsg('Reading ' + file.name + '…', false);
  $('startBtn').disabled = true;
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

    const parts = [entrants.length + ' entrant' + (entrants.length === 1 ? '' : 's') + ' ready'];
    if (excluded) parts.push('excluded ' + excluded + ' @' + CONFIG.EXCLUDE_DOMAINS.join('/'));
    if (merged) parts.push('merged ' + merged + ' duplicate' + (merged === 1 ? '' : 's'));
    setSetupMsg(parts.join(' — '), false);
    $('startBtn').disabled = entrants.length === 0;
    $('completeBtn').hidden = entrants.length === 0;
  } catch (err) {
    entrants = [];
    setSetupMsg(err.message || String(err), true);
    $('startBtn').disabled = true;
  }
}

// ---------- wheel ----------
function sizeWheel() {
  const area = $('wheelArea');
  const sq = $('wheelSquare');
  const s = Math.max(140, Math.floor(Math.min(area.clientWidth, area.clientHeight)) - 8);
  sq.style.width = s + 'px';
  sq.style.height = s + 'px';
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
    ctx.lineWidth = n > 60 ? 1 : 3; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
    if (showLabels) {
      ctx.save();
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
      ctx.font = `500 ${n > 24 ? 16 : 22}px ${fam}`;
      const label = entrants[i].first || entrants[i].last || '—';
      ctx.fillText(label.length > 16 ? label.slice(0, 15) + '…' : label, RADIUS - 18, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

function renderRemaining() {
  $('remaining').textContent = entrants.length ? entrants.length + ' left' : 'none left';
}
function updateSpinButton() {
  $('spinBtn').disabled = entrants.length === 0 || spinning;
  $('spinBtn').textContent = entrants.length === 0
    ? 'No entrants left'
    : (candidate >= 0 ? 'Spin again' : 'Spin the wheel');
}

// ---------- sound ----------
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function tick() {
  if (muted || !audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'square'; o.frequency.value = 1100;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  o.connect(g).connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.06);
}
function winChime() {
  if (muted || !audioCtx) return;
  const base = audioCtx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    const t = base + i * 0.11;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + 0.55);
  });
}

// ---------- spin + present-to-win ----------
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function spin() {
  if (spinning || entrants.length === 0) return;
  ensureAudio();
  spinning = true;
  candidate = -1;
  $('spinBtn').disabled = true;
  hideOverlay();
  const myToken = ++spinToken;
  const n = entrants.length;
  const w = Math.floor(Math.random() * n);
  const target = targetRotation(rot, w, n, 5);
  const start = rot, dur = 4500;
  let t0 = null;
  lastSlice = sliceUnderPointer(rot, n);
  function frame(ts) {
    if (myToken !== spinToken) return;   // a reload/purge superseded this spin
    if (t0 === null) t0 = ts;
    const p = Math.min(1, (ts - t0) / dur);
    rot = start + (target - start) * easeOutCubic(p);
    drawWheel();
    const s = sliceUnderPointer(rot, n);
    if (s !== lastSlice) {
      lastSlice = s;
      const now = (typeof performance !== 'undefined' ? performance.now() : ts);
      if (now - lastTickTime > 28) { tick(); lastTickTime = now; }
    }
    if (p < 1) { requestAnimationFrame(frame); }
    else {
      spinning = false;
      candidate = w;
      updateSpinButton();
      showWinnerOverlay(entrants[w]);
      winChime();
    }
  }
  requestAnimationFrame(frame);
}

// ---------- winner splash ----------
function showWinnerOverlay(p) {
  const name = (p.first + ' ' + p.last).trim() || '(no name)';
  $('bigName').textContent = name;
  $('bigCompany').textContent = p.company || '';
  const prize = $('prizeTitle').value.trim();
  $('bigPrize').textContent = prize ? 'wins ' + prize : '';
  const pim = $('bigPrizeImg');
  if (prizeImageUrl) { pim.src = prizeImageUrl; pim.hidden = false; }
  else { pim.hidden = true; pim.removeAttribute('src'); }
  $('hereBtn').hidden = false;
  $('notHereBig').hidden = false;
  $('newRaffleBtn').hidden = true;
  $('winnerOverlay').hidden = false;
  fireConfetti($('confettiBig'), window.innerWidth, window.innerHeight, 200);
}
function hideOverlay() { $('winnerOverlay').hidden = true; }

// Winner confirmed present → the raffle is over. Purge the entrant list now (GDPR)
// and keep the winner shown as the final result; no more spinning.
function theyreHere() {
  purgeEntrants();
  $('hereBtn').hidden = true;
  $('notHereBig').hidden = true;
  $('newRaffleBtn').hidden = false;
}

function newRaffle() {
  hideOverlay();
  $('bigName').textContent = '';
  $('bigCompany').textContent = '';
  $('bigPrize').textContent = '';
  setSetupMsg('', false);
  $('startBtn').disabled = true;
  showSetup();
}

function notHere() {
  if (candidate < 0 || candidate >= entrants.length) { hideOverlay(); return; }
  entrants.splice(candidate, 1);
  candidate = -1;
  hideOverlay();
  if (entrants.length === 0) {
    drawWheel(); renderRemaining(); updateSpinButton();
    return;
  }
  renderRemaining();
  spin();
}

function fireConfetti(cv, W, H, count) {
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  const colors = CONFIG.COLORS;
  const parts = [];
  for (let i = 0; i < count; i++) {
    parts.push({
      x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: H * 0.28,
      vx: (Math.random() - 0.5) * 12, vy: Math.random() * -11 - 3,
      g: 0.30 + Math.random() * 0.22, size: 6 + Math.random() * 8,
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
    if (frames < 170) requestAnimationFrame(step); else cx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(step);
}

// ---------- GDPR purge ----------
function purgeEntrants() {
  entrants = [];
  candidate = -1;
  rot = 0; spinToken++; spinning = false;
  $('odsFile').value = '';
  if (ctx) ctx.clearRect(0, 0, SIZE, SIZE);
  renderRemaining();
  updateSpinButton();
}

function raffleComplete() {
  if (entrants.length === 0 && candidate < 0) return;
  const ok = window.confirm('Raffle complete? This permanently deletes the uploaded entrants and all their data from this browser.');
  if (!ok) return;
  purgeEntrants();
  hideOverlay();
  setSetupMsg('Entrant data purged. Upload a new file to run another raffle.', false);
  $('startBtn').disabled = true;
  showSetup();
}

// ---------- init ----------
function toggleMute() {
  muted = !muted;
  $('muteBtn').textContent = muted ? 'Sound: off' : 'Sound: on';
  $('muteBtn').setAttribute('aria-pressed', String(muted));
}

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

  $('startBtn').addEventListener('click', () => { if (entrants.length) showDraw(); });
  $('spinBtn').addEventListener('click', spin);
  $('hereBtn').addEventListener('click', theyreHere);
  $('newRaffleBtn').addEventListener('click', newRaffle);
  $('notHereBig').addEventListener('click', notHere);
  $('setupBtn').addEventListener('click', showSetup);
  $('completeBtn').addEventListener('click', raffleComplete);
  $('muteBtn').addEventListener('click', toggleMute);
  window.addEventListener('resize', () => { if (!$('draw').hidden) { sizeWheel(); drawWheel(); } });

  showSetup();
}
init();
