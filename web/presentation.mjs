// Menu-time presentation: the animated Home overlay and the Play launch
// sequence. Both are pure functions of a presentation clock, so they hold no
// gameplay state, never touch the simulation RNG, and freeze when not drawn.
export const WIDTH = 480;
export const HEIGHT = 270;
const TAU = Math.PI * 2;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Rays turn slowly clockwise (5 degrees a second), particles stream outward,
// and individual rays flicker irregularly. The moons live in the static
// backdrop image underneath and never move; the menu panel sits above.
export const HOME_SPIN = 5 * Math.PI / 180;
const CENTER = [WIDTH / 2, HEIGHT * .496];
export function drawHome(ctx, ms, { reduced = false } = {}) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  if (reduced) return;
  const t = Math.floor(ms / 50) * .05, spin = t * HOME_SPIN;
  const [cx, cy] = CENTER;
  for (let i = 0; i < 40; i++) {
    const angle = i * TAU / 40 + hash(i) * .1 + spin;
    const flicker = .55 + .45 * Math.sin(t * (.7 + hash(i + 9) * 1.6) + i * 2.3) * Math.sin(t * (.31 + hash(i + 4)) + i);
    const alpha = Math.max(0, .05 + .1 * flicker);
    ctx.fillStyle = `rgba(90, 140, 255, ${alpha.toFixed(3)})`;
    for (let d = 26; d < 330; d += 2) {
      const x = Math.round(cx + Math.cos(angle) * d), y = Math.round(cy + Math.sin(angle) * d * .98);
      if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) break;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Particles are placed in closed form: no state, so nothing to reset or leak.
  for (let i = 0; i < 110; i++) {
    const speed = 16 + hash(i + 31) * 74, span = 150 + hash(i + 57) * 200;
    const travelled = (t * speed + hash(i) * span) % span;
    const angle = hash(i + 3) * TAU + spin;
    const d = 22 + travelled, fade = 1 - travelled / span;
    const x = Math.round(cx + Math.cos(angle) * d), y = Math.round(cy + Math.sin(angle) * d);
    ctx.fillStyle = `rgba(200, 220, 255, ${(.15 + .6 * fade * Math.min(1, travelled / 12)).toFixed(3)})`;
    ctx.fillRect(x, y, 1 + (hash(i + 5) > .8 ? 1 : 0), 1);
  }
  const glow = .1 + .06 * Math.sin(t * 2.1) * Math.sin(t * .83 + 1);
  ctx.fillStyle = `rgba(190, 210, 255, ${glow.toFixed(3)})`;
  ctx.fillRect(Math.round(cx) - 14, Math.round(cy) - 14, 28, 28);
  if (ctx.arc) {
    ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000';
    for(const [x,y,radius] of [[7,7,34],[365,62,29],[94,145,12],[39,248,44],[452,247,29],[cx,cy,17]]){
      ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
    }
    ctx.restore();
  }
}

// First-person launch: a restrained cockpit window frames blue-white stars
// that stretch and rush past, then settle on arrival. No exterior ship.
export const WARP_ACTION_MS = 2400;
export const WARP_HOLD_MS = 800;
export const WARP_TOTAL_MS = WARP_ACTION_MS + WARP_HOLD_MS;
export const warpSpeed = ms => {
  if (ms <= 0) return 0;
  if (ms >= WARP_ACTION_MS) return 0;
  const t = ms / WARP_ACTION_MS;
  return t < .55 ? (t / .55) ** 2 : Math.max(0, 1 - ((t - .55) / .45) ** 1.4);
};
// Integrating speed keeps stars moving forward while the streak length settles.
export function warpDistance(ms) {
  const end = Math.min(Math.max(ms, 0), WARP_ACTION_MS);
  let distance = 0;
  for (let time = 0; time < end; time += 20) {
    distance += (.25 + warpSpeed(time) * 2.2) * Math.min(20, end - time) / 1000;
  }
  return distance;
}
export function drawWarp(ctx, ms) {
  ms = Math.floor(ms / 40) * 40;
  const speed = warpSpeed(ms), cx = WIDTH / 2, cy = HEIGHT / 2;
  ctx.fillStyle = '#03060f';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const travel = warpDistance(ms);
  for (let i = 0; i < 150; i++) {
    const angle = hash(i) * TAU, lane = .12 + hash(i + 17) * .88;
    // Each star's distance from the centre loops, so the field never empties.
    const base = ((hash(i + 41) + travel * (.2 + lane * .6)) % 1);
    const r = 6 + base * base * 300 * lane + base * 20;
    const tail = 1 + speed * (r * .22);
    const x1 = cx + Math.cos(angle) * r, y1 = cy + Math.sin(angle) * r * .9;
    const x0 = cx + Math.cos(angle) * (r - tail), y0 = cy + Math.sin(angle) * (r - tail) * .9;
    ctx.strokeStyle = `rgba(${170 + Math.round(60 * lane)}, ${200 + Math.round(40 * lane)}, 255, ${(.2 + .7 * base).toFixed(2)})`;
    ctx.lineWidth = base > .75 ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(Math.round(x0) + .5, Math.round(y0) + .5); ctx.lineTo(Math.round(x1) + .5, Math.round(y1) + .5); ctx.stroke();
  }
  // Fixed perspective window and instrument sill, matching the approved POV.
  ctx.fillStyle = '#05080f';
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(5,0);ctx.lineTo(18,202);ctx.lineTo(31,244);ctx.lineTo(0,244);ctx.fill();
  ctx.beginPath();ctx.moveTo(WIDTH,0);ctx.lineTo(WIDTH-5,0);ctx.lineTo(WIDTH-18,202);ctx.lineTo(WIDTH-31,244);ctx.lineTo(WIDTH,244);ctx.fill();
  ctx.fillRect(0,244,WIDTH,26);
  ctx.strokeStyle='#304e72';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(5.5,0);ctx.lineTo(18.5,202);ctx.lineTo(31.5,244);ctx.lineTo(WIDTH-31.5,244);ctx.lineTo(WIDTH-18.5,202);ctx.lineTo(WIDTH-5.5,0);ctx.stroke();
  for(const x of [95,230,355]){ctx.fillStyle='#101f31';ctx.fillRect(x,251,28,10);ctx.fillStyle='#4bb4d2';ctx.fillRect(x+4,254,16,1);ctx.fillRect(x+4,257,10,1);}
  if (ms >= WARP_ACTION_MS - 300) {
    ctx.fillStyle = '#9ac8ff';
    ctx.globalAlpha = Math.min(1, (ms - (WARP_ACTION_MS - 300)) / 300);
    ctx.fillRect(WIDTH / 2 - 1, HEIGHT / 2 - 1, 2, 2);
    ctx.globalAlpha = 1;
  }
}

// Owns one launch: `finish` runs once, whether the clip ends, is skipped, or
// is cancelled. Reduced motion swaps the tunnel for a brief calm fade.
export class LaunchSequence {
  constructor({ reduced = false } = {}) { this.reduced = reduced; this.active = false; this.start = 0; this.done = null; }
  begin(now, done) { this.active = true; this.start = now; this.done = done; }
  get total() { return this.reduced ? 250 : WARP_TOTAL_MS; }
  elapsed(now) { return now - this.start; }
  tick(now) { if (this.active && this.elapsed(now) >= this.total) this.end(true); }
  skip() { if (this.active) this.end(true); }
  cancel() { if (this.active) this.end(false); }
  end(started) { const done = this.done; this.active = false; this.done = null; done?.(started); }
}
