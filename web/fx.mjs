// Presentation-only effects: soft glows, muted rock explosions and the boss
// finale. Everything is a pure function of an effect record and the visual
// clock (`time`), never the simulation, so pausing freezes it and replays are
// unaffected. Colours stay dusty and low-saturation except the boss finale,
// which is the one place the screen is allowed to go loud.
const TAU = Math.PI * 2;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ease = t => 1 - (1 - t) ** 2;

export const SMALL_BLAST_MS = 380;
export const BOSS_BLAST_MS = 2000;

// Pre-rendered radial blobs, drawn additively. Keyed by colour and radius.
const blobs = new Map();
function blob(rgb, radius) {
  const key = `${rgb}|${radius}`;
  let canvas = blobs.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = radius * 2 + 2;
    const ctx = canvas.getContext('2d'), c = radius + 1;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, radius);
    gradient.addColorStop(0, `rgba(${rgb},1)`);
    gradient.addColorStop(.45, `rgba(${rgb},.35)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    blobs.set(key, canvas);
  }
  return canvas;
}
export function glow(ctx, x, y, radius, rgb, alpha = 1) {
  if (alpha <= 0) return;
  const canvas = blob(rgb, radius);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(canvas, Math.round(x) - radius - 1, Math.round(y) - radius - 1);
  ctx.restore();
}

// A pixel-art filled disc, one fillRect per row.
function disc(ctx, cx, cy, r) {
  const radius = Math.max(1, Math.round(r));
  for (let dy = -radius; dy <= radius; dy++) {
    const half = Math.floor(Math.sqrt(radius * radius - dy * dy + .5));
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}

// Dusty explosion for rocks and the player's ship. `size` is 0 large, 1
// medium, 2 small, 3 ship. A short flash, a tan core that cools to mauve, a
// few spark ticks and a loose ring of debris pixels. No rays, no big bloom.
const RADIUS = [9, 6.5, 4.5, 11];
export function smallBlast(ctx, effect, time) {
  const t = (time - effect.time) / SMALL_BLAST_MS;
  if (t < 0 || t >= 1) return;
  const { x, y } = effect, size = effect.size ?? 1, r = RADIUS[size] ?? RADIUS[1];
  const seed = x * 7.31 + y * 3.17 + size;
  const grow = ease(Math.min(1, t * 1.6));
  glow(ctx, x, y, Math.round(r * 1.7), size === 3 ? '190,130,100' : '150,100,92', .4 * (1 - t));
  // Core: bright, then cooling.
  if (t < .72) {
    ctx.fillStyle = t < .22 ? '#ecd9bd' : t < .45 ? '#c8a68a' : '#8c6a6a';
    disc(ctx, x, y, r * grow * (1 - t * .55));
    if (t > .12) { ctx.fillStyle = t < .4 ? '#a37e74' : '#5a4258'; disc(ctx, x + 1, y + 1, r * grow * (.5 - t * .4)); }
  }
  // Debris ring.
  const count = size === 3 ? 12 : 8;
  for (let i = 0; i < count; i++) {
    const angle = hash(seed + i) * TAU, reach = r * (.9 + hash(seed + i + 9) * 1.1) * grow;
    ctx.fillStyle = hash(seed + i + 3) > .5 ? '#c9a58b' : '#7a5460';
    ctx.globalAlpha = Math.max(0, 1 - t * 1.25);
    ctx.fillRect(Math.round(x + Math.cos(angle) * reach), Math.round(y + Math.sin(angle) * reach), 1, 1);
  }
  ctx.globalAlpha = 1;
  // Early sparks.
  if (t < .45) {
    ctx.fillStyle = '#e8d2b4';
    for (let i = 0; i < 4; i++) {
      const angle = hash(seed + i + 30) * TAU, near = r * (.8 + t * 1.2), far = near + 2 + (1 - t) * 3;
      for (let d = near; d < far; d++) ctx.fillRect(Math.round(x + Math.cos(angle) * d), Math.round(y + Math.sin(angle) * d), 1, 1);
    }
  }
}

// Sentinel finale. A white-hot flash, a chunky fireball, a shockwave ring,
// radial rays, flying hull plates and a spray of sparks. `reduced` skips the
// full-screen flash.
const HULL = ['#273c58', '#142337', '#f2a45d', '#55647a'];
export function bossBlast(ctx, effect, time, { width, height, reduced = false, sprite = () => {} } = {}) {
  const age = time - effect.time, t = age / BOSS_BLAST_MS;
  if (t < 0 || t >= 1) return;
  const { x, y } = effect;
  // Plates fly under the fireball so the hot centre overlaps them.
  for (let i = 0; i < 10; i++) {
    const angle = hash(i * 3.1) * TAU, speed = 60 + hash(i + 5) * 120;
    const run = ease(Math.min(1, t * 1.4)) * speed * 1.3;
    const px = x + Math.cos(angle) * run, py = y + Math.sin(angle) * run * .85 + t * t * 22;
    const side = 4 + Math.floor(hash(i + 8) * 7);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - .55) / .45);
    ctx.fillStyle = HULL[i % 3]; ctx.fillRect(Math.round(px - side / 2), Math.round(py - side / 2), side, side);
    ctx.fillStyle = t < .5 ? '#ffb86e' : '#7a4a3a'; ctx.fillRect(Math.round(px - side / 2), Math.round(py - side / 2), side, 1);
  }
  ctx.globalAlpha = 1;
  // Fireball.
  const frame = Math.min(7, Math.floor(age / 85));
  const fade = Math.max(0, 1 - Math.max(0, t - .35) / .5);
  glow(ctx, x, y, 90, '255,140,60', .85 * fade);
  glow(ctx, x, y, 46, '255,232,176', fade);
  if (frame <= 6) sprite(`explosion-${frame}`, x - 48, y - 48, 3);
  if (age < 360) glow(ctx, x, y, 30, '255,252,236', 1 - age / 360);
  // Shockwave.
  const ring = ease(Math.min(1, age / 900)) * Math.hypot(width, height) * .32;
  if (age < 900) {
    ctx.fillStyle = `rgba(255,232,190,${(1 - age / 900).toFixed(2)})`;
    for (let a = 0; a < 220; a++) {
      const angle = a / 220 * TAU;
      ctx.fillRect(Math.round(x + Math.cos(angle) * ring), Math.round(y + Math.sin(angle) * ring * .86), 1, 1);
    }
  }
  // Rays.
  if (age < 650) {
    for (let i = 0; i < 36; i++) {
      const angle = i / 36 * TAU + hash(i) * .08, start = 20 + hash(i + 4) * 16 + ease(age / 650) * 40;
      const length = 14 + hash(i + 2) * 42 * (1 - age / 650);
      ctx.fillStyle = [`#ffe6a0`, '#ff9648', '#ffffff'][i % 3];
      for (let d = 0; d < length; d += 1) ctx.fillRect(Math.round(x + Math.cos(angle) * (start + d)), Math.round(y + Math.sin(angle) * (start + d)), 1, 1);
    }
  }
  // Sparks.
  for (let i = 0; i < 70; i++) {
    const angle = hash(i + 60) * TAU, speed = 40 + hash(i + 80) * 150;
    const run = ease(Math.min(1, t * 1.6)) * speed, life = .4 + hash(i + 100) * .6;
    if (t > life) continue;
    ctx.fillStyle = ['#ffdc8c', '#ff9648', '#ffffff', '#ff7878'][i % 4];
    ctx.fillRect(Math.round(x + Math.cos(angle) * run), Math.round(y + Math.sin(angle) * run * .85 + t * 18), 1, 1);
  }
  if (!reduced && age < 130) {
    ctx.fillStyle = `rgba(255,248,230,${(.55 * (1 - age / 130)).toFixed(2)})`;
    ctx.fillRect(0, 0, width, height);
  }
}
export const bossShake = (time, effect) => {
  const t = (time - effect.time) / 900;
  return t < 0 || t >= 1 ? 0 : (1 - t) ** 2;
};
