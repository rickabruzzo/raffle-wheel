// Starfield backdrop for the Galaxy edition. Pure visuals, no entrant data.
//
//   const field = startStarfield(canvas);
//   field.setWarp(true);   // stars streak toward the viewer while the wheel spins
//   field.setWarp(false);  // settle back to a slow drift
//   field.flash();         // white-out pulse when the winner lands

export function startStarfield(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const COUNT = opts.count || 420;
  const DRIFT = 0.012;     // depth units per frame at idle
  const WARP = 0.22;       // depth units per frame at full warp
  let W = 0, H = 0, cx = 0, cy = 0;
  let stars = [];
  let speed = DRIFT, targetSpeed = DRIFT;
  let flashAlpha = 0;
  let raf = 0;
  let running = true;

  function reset(s, randomDepth) {
    // Positions live in a unit cube centred on the viewer; z is depth (1 = far).
    s.x = (Math.random() * 2 - 1);
    s.y = (Math.random() * 2 - 1);
    s.z = randomDepth ? Math.random() : 1;
    s.pz = s.z;
    s.hue = Math.random() < 0.14 ? 205 : (Math.random() < 0.08 ? 42 : 0); // a few blue, a few gold
    s.tw = Math.random() * Math.PI * 2;
    return s;
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2;
  }

  function project(s) {
    const k = 0.5 / Math.max(0.02, s.z);
    return [cx + s.x * k * Math.max(W, H), cy + s.y * k * Math.max(W, H)];
  }

  function frame() {
    if (!running) return;
    speed += (targetSpeed - speed) * (targetSpeed > speed ? 0.06 : 0.035);
    const warpiness = Math.min(1, (speed - DRIFT) / (WARP - DRIFT));

    // Trail: at warp we fade the previous frame instead of clearing, which draws streaks.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(6, 8, 18, ${warpiness > 0.02 ? 0.35 - warpiness * 0.18 : 1})`;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      s.pz = s.z;
      s.z -= speed;
      if (s.z <= 0.02) { reset(s, false); continue; }
      const [x, y] = project(s);
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) { reset(s, false); continue; }
      const near = 1 - s.z;
      const bright = 0.35 + near * 0.65;
      const twinkle = warpiness < 0.5 ? 0.75 + 0.25 * Math.sin(s.tw += 0.03 + near * 0.02) : 1;
      const col = s.hue === 205 ? `rgba(140,190,255,${bright * twinkle})`
        : s.hue === 42 ? `rgba(255,214,120,${bright * twinkle})`
          : `rgba(236,240,255,${bright * twinkle})`;
      if (warpiness > 0.05) {
        const [px, py] = project({ x: s.x, y: s.y, z: s.pz });
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.6 + near * 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, 0.4 + near * 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (flashAlpha > 0.005) {
      ctx.fillStyle = `rgba(255,248,225,${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
      flashAlpha *= 0.86;
    }
    raf = requestAnimationFrame(frame);
  }

  resize();
  stars = Array.from({ length: COUNT }, () => reset({}, true));
  ctx.fillStyle = '#060812'; ctx.fillRect(0, 0, W, H);
  window.addEventListener('resize', resize);
  raf = requestAnimationFrame(frame);

  return {
    setWarp(on) { targetSpeed = on ? WARP : DRIFT; },
    flash() { flashAlpha = 0.9; },
    stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); },
  };
}
