// Presentation-only effects: soft glows, muted rock explosions and the boss
// finale. Everything is a pure function of an effect record and the visual
// clock (`time`), never the simulation, so pausing freezes it and replays are
// unaffected. Colours stay dusty and low-saturation except the boss finale,
// which is the one place the screen is allowed to go loud.
const TAU = Math.PI * 2;
export const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const ease = t => 1 - (1 - t) ** 2;

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

// Blocky glow for bosses: concentric 4 px steps in flat colour, never a gradient,
// to match the chunky boss art. Pre-rendered once per colour and radius.
export const BLOCK = 4;
const pixelBlobs = new Map();
function pixelBlob(rgb, radius) {
  const key = `${rgb}|${radius}`;
  let canvas = pixelBlobs.get(key);
  if (!canvas) {
    const size = Math.ceil(radius * 2 / BLOCK) * BLOCK + BLOCK;
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'), c = size / 2;
    for (let y = 0; y < size; y += BLOCK) for (let x = 0; x < size; x += BLOCK) {
      const d = Math.hypot(x + BLOCK / 2 - c, y + BLOCK / 2 - c) / radius;
      if (d >= 1) continue;
      const level = Math.floor((1 - d) * 4) / 4;           // four flat steps
      if (level <= 0) continue;
      ctx.fillStyle = `rgba(${rgb},${(level * .55).toFixed(2)})`;
      ctx.fillRect(x, y, BLOCK, BLOCK);
    }
    pixelBlobs.set(key, canvas);
  }
  return canvas;
}
export function pixelGlow(ctx, x, y, radius, rgb, alpha = 1) {
  if (alpha <= 0) return;
  const canvas = pixelBlob(rgb, radius);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha * 1.4);
  ctx.drawImage(canvas, Math.round((x - canvas.width / 2) / BLOCK) * BLOCK, Math.round((y - canvas.height / 2) / BLOCK) * BLOCK);
  ctx.restore();
}
// A ragged blocky disc: the cog-edged fireball core of the boss-destroyed draft.
export function blockDisc(ctx, cx, cy, r, colour, seed) {
  if (r < BLOCK) return;
  ctx.fillStyle = colour;
  const x0 = Math.round(cx / BLOCK) * BLOCK, y0 = Math.round(cy / BLOCK) * BLOCK;
  for (let gy = -r; gy <= r; gy += BLOCK) for (let gx = -r; gx <= r; gx += BLOCK) {
    const d = Math.hypot(gx, gy), jag = (hash(Math.round(gx / BLOCK) * 7 + Math.round(gy / BLOCK) * 13 + seed) - .5) * BLOCK * 2.6;
    if (d < r + jag) ctx.fillRect(x0 + gx, y0 + gy, BLOCK, BLOCK);
  }
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
export function bossBlast(ctx, effect, time, { width, height, reduced = false, sprite = () => {}, chunks = [], scale = 1 } = {}) {
  const age = time - effect.time, t = age / BOSS_BLAST_MS;
  if (t < 0 || t >= 1) return;
  const { x, y } = effect;
  // Fireball: stepped, ragged discs in flat colour (draft: amber rim, cream, white-hot core).
  const fade = Math.max(0, 1 - Math.max(0, t - .35) / .5);
  const swell = ease(Math.min(1, age / 300)) * Math.max(0, 1 - Math.max(0, t - .2) * 1.25), big = Math.min(scale, 1.25);
  pixelGlow(ctx, x, y, Math.round(84 * big), '255,140,60', .6 * fade);
  blockDisc(ctx, x, y, 50 * big * swell, '#e8944a', 1);
  blockDisc(ctx, x, y, 38 * big * swell, '#ffd9a0', 2);
  blockDisc(ctx, x, y, 26 * big * swell, '#fff4dc', 3);
  blockDisc(ctx, x, y, 15 * big * swell, '#ffffff', 4);
  ctx.globalAlpha = 1;
  // Hull pieces: angular shards cut from the boss's own sprite, drawn over the
  // fireball like the boss-destroyed draft.
  for (let i = 0; i < 10; i++) {
    const angle = hash(i * 3.1) * TAU, speed = (60 + hash(i + 5) * 120) * scale;
    const run = ease(Math.min(1, t * 1.4)) * speed * 1.3;
    const fall = t * t * 22;
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - .55) / .45);
    const chunk = chunks[i % Math.max(1, chunks.length)];
    if (chunk) {
      const lean = Math.hypot(chunk.dx, chunk.dy) || 1;
      const px = x + chunk.dx + (chunk.dx / lean * .7 + Math.cos(angle) * .5) * run;
      const py = y + chunk.dy + (chunk.dy / lean * .7 + Math.sin(angle) * .5) * run * .85 + fall;
      ctx.drawImage(chunk.canvas, Math.round((px - chunk.canvas.width / 2) / BLOCK) * BLOCK, Math.round((py - chunk.canvas.height / 2) / BLOCK) * BLOCK);
    } else {
      const px = x + Math.cos(angle) * run, py = y + Math.sin(angle) * run * .85 + fall;
      const side = 4 + Math.floor(hash(i + 8) * 7);
      ctx.fillStyle = HULL[i % 3]; ctx.fillRect(Math.round(px - side / 2), Math.round(py - side / 2), side, side);
      ctx.fillStyle = t < .5 ? '#ffb86e' : '#7a4a3a'; ctx.fillRect(Math.round(px - side / 2), Math.round(py - side / 2), side, 1);
    }
  }
  ctx.globalAlpha = 1;
  // Shockwave.
  const ring = ease(Math.min(1, age / 900)) * Math.hypot(width, height) * .32 * Math.max(.7, scale * .8);
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
