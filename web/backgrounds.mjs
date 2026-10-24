// Original, procedurally authored pixel backgrounds for each region. Nothing
// here is copied from the inspiration references: those are watermarked
// previews, so only their moods (a violet gas giant, a red world over pink
// terrain, a ruined moon, calm blue moons, a black-hole ring) guide the art.
// Light comes from the upper left, matching the sprite atlas.
import { REGIONS, RegionTimeline } from './regions.mjs';

export const WIDTH = 480;
export const HEIGHT = 270;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LIGHT = (() => { const x = -.55, y = -.6, z = .58, n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; })();

const rand = seed => () => {
  seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const hex = value => {
  const n = parseInt(value.slice(1), 16);
  return (255 << 24 | (n & 255) << 16 | (n >> 8 & 255) << 8 | n >> 16 & 255) >>> 0;
};
const ramp = list => list.map(hex);
const canvasOf = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
};

// A raster is a 480x270 pixel buffer painted with a few pixel-art primitives.
class Raster {
  constructor(w = WIDTH, h = HEIGHT) {
    this.w = w; this.h = h;
    this.data = new Uint32Array(w * h);
  }
  put(x, y, colour) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = colour; }
  rect(x, y, w, h, colour) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, colour); }
  gradient(colours) {
    for (let y = 0; y < this.h; y++) {
      const t = y / (this.h - 1) * (colours.length - 1), i = Math.min(colours.length - 2, Math.floor(t));
      for (let x = 0; x < this.w; x++) this.data[y * this.w + x] = t - i > BAYER[(y & 3) * 4 + (x & 3)] / 16 ? colours[i + 1] : colours[i];
    }
  }
  // A dithered, lit sphere. `shape` may carry craters and a per-row tint.
  disc(cx, cy, r, colours, { craters = [], tint = null, clipTop = -Infinity } = {}) {
    for (let y = Math.max(clipTop, cy - r); y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const dx = (x - cx) / r, dy = (y - cy) / r, d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        let lit = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]);
        for (const [ox, oy, cr] of craters) {
          const e = Math.hypot(x - (cx + ox), y - (cy + oy));
          if (e < cr) lit *= .55; else if (e < cr + 1.2 && x - cx - ox < 0) lit = Math.min(1, lit * 1.25 + .1);
        }
        const level = lit * (colours.length - 1) + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - .5) * .9;
        const index = Math.max(0, Math.min(colours.length - 1, Math.round(level)));
        this.put(x, y, tint ? tint(y, colours[index]) : colours[index]);
      }
    }
  }
  // Rolling silhouette: a periodic sum of sines so layers scroll seamlessly.
  hills(base, amp, waves, colour, edge) {
    for (let x = 0; x < this.w; x++) {
      let h = 0;
      for (const [cycles, weight, phase] of waves) h += Math.sin(x / this.w * Math.PI * 2 * cycles + phase) * weight;
      const top = Math.round(base - h * amp);
      for (let y = top; y < this.h; y++) this.put(x, y, y === top && edge ? edge : colour);
    }
  }
  stars(seed, count, colours, size = 1) {
    const next = rand(seed);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(next() * this.w), y = Math.floor(next() * this.h), c = colours[Math.floor(next() * colours.length)];
      this.rect(x, y, size, size, c);
    }
  }
  toCanvas() {
    const { canvas, ctx } = canvasOf(this.w, this.h);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(this.data.buffer), this.w, this.h), 0, 0);
    return canvas;
  }
}

const starLayer = (seed, count, colours) => { const r = new Raster(); r.stars(seed, count, colours); return r.toCanvas(); };
const tile = (ctx, layer, offset, alpha = 1) => {
  const x = -Math.floor(((offset % WIDTH) + WIDTH) % WIDTH);
  ctx.globalAlpha = alpha;
  ctx.drawImage(layer, x, 0); ctx.drawImage(layer, x + WIDTH, 0);
  ctx.globalAlpha = 1;
};

// Each builder returns { base, stars:[far, near], paint(ctx, time, motion, extra) }.
// `motion` is 0 for reduced motion, otherwise 1.
const BUILDERS = {
  frontier() {
    const r = new Raster(), bg = new Raster();
    bg.gradient(ramp(['#050a1a', '#0a1430', '#12214a', '#1b3158']));
    r.disc(96, 78, 22, ramp(['#101a3a', '#1f3a6e', '#3f78b0', '#8cc6d8']), { craters:[[-6, 4, 3], [7, -6, 2]] });
    r.disc(318, 52, 12, ramp(['#2a1830', '#573a63', '#9a6a8a', '#e0b4a8']));
    r.disc(404, 120, 8, ramp(['#10282e', '#1d5560', '#3f9aa0', '#9ae0d0']));
    // Low, dim rocky horizon: decoration only, well below the combat area.
    r.hills(258, 5, [[3, 1, .4], [7, .5, 1.3], [13, .25, 2.1]], hex('#0d1730'), hex('#1a2b52'));
    const base = r.toCanvas(), back = bg.toCanvas();
    const stars = [starLayer(11, 70, ramp(['#1c2c4c', '#2c456c'])), starLayer(12, 46, ramp(['#4e7098', '#8ab8d0']))];
    return { back, base, stars, paint(ctx, t, m) { ctx.drawImage(base, 0, 0); } };
  },
  violet() {
    const radius = 118, size = radius * 2 + 1, cx = 372, cy = 214;
    const lit = new Raster(size, size), mask = new Raster(size, size);
    lit.disc(radius, radius, radius, ramp(['#000000', '#1a0d2e', '#33205a', '#503a86', '#7a5cb4']), {});
    for (let i = 0; i < lit.data.length; i++) {
      const c = lit.data[i];
      mask.data[i] = c ? hex('#ffffff') : 0;
    }
    // Shadow/highlight overlay: sample the shaded sphere's luminance as dark alpha.
    const shade = new Raster(size, size);
    for (let i = 0; i < lit.data.length; i++) {
      const c = lit.data[i];
      if (!c) continue;
      const level = (c & 255) / 255;
      const checker = (i % size ^ Math.floor(i / size)) & 1;
      shade.data[i] = level < .12 || (level <= .2 && checker) ? ((hex('#05020d') & 0xffffff | 150 << 24) >>> 0) : 0;
    }
    const maskCanvas = mask.toCanvas(), shadeCanvas = shade.toCanvas();
    // Seamless banded texture: periodic wobble keeps the loop invisible.
    const texture = new Raster(WIDTH, size);
    const bands = ramp(['#2a1a52', '#3c2870', '#5a3c98', '#8a5ab8', '#b07ac8', '#d49cd0', '#5a3c98', '#2a1a52']);
    for (let y = 0; y < size; y++) for (let x = 0; x < WIDTH; x++) {
      const wobble = Math.sin(x / WIDTH * Math.PI * 4 + y * .07) * 3 + Math.sin(x / WIDTH * Math.PI * 2 + y * .02) * 5;
      const band = (y + wobble) / 11;
      const base = Math.floor(band) % bands.length, mix = band - Math.floor(band);
      const i = (base + bands.length) % bands.length, j = (i + 1) % bands.length;
      texture.data[y * WIDTH + x] = mix > BAYER[(y & 3) * 4 + (x & 3)] / 16 ? bands[j] : bands[i];
    }
    const textureCanvas = texture.toCanvas();
    const work = canvasOf(size, size);
    const bg = new Raster();
    bg.gradient(ramp(['#08051a', '#120a2c', '#1c1040']));
    const back = bg.toCanvas();
    const stars = [starLayer(21, 60, ramp(['#2a2650', '#463e78'])), starLayer(22, 40, ramp(['#8a7ec0', '#d0c4f0']))];
    return { back, stars, paint(ctx, t, m) {
      const scroll = m ? t * .006 : 0;
      work.ctx.globalCompositeOperation = 'source-over';
      work.ctx.clearRect(0, 0, size, size);
      tile(work.ctx, textureCanvas, scroll);
      work.ctx.globalCompositeOperation = 'destination-in';
      work.ctx.drawImage(maskCanvas, 0, 0);
      work.ctx.globalCompositeOperation = 'source-over';
      work.ctx.drawImage(shadeCanvas, 0, 0);
      ctx.drawImage(work.canvas, cx - radius, cy - radius);
    } };
  },
  ember() {
    const r = new Raster(), bg = new Raster();
    bg.gradient(ramp(['#1c0a1a', '#3a1424', '#6a2430', '#8c3a3c']));
    r.disc(118, 92, 54, ramp(['#2a0c14', '#6a1c24', '#b0382c', '#e07048', '#f0a878']), { craters:[[-14, 8, 6], [18, -12, 4], [6, 22, 5]] });
    const base = r.toCanvas(), back = bg.toCanvas();
    const far = new Raster(); far.hills(236, 12, [[2, 1, .6], [5, .55, 1.4], [9, .3, 2.6]], hex('#4a1c34'), hex('#7a3050'));
    const near = new Raster(); near.hills(258, 9, [[3, 1, 2.2], [7, .5, .5], [11, .3, 1.7]], hex('#2e1228'), hex('#5a2442'));
    const farLayer = far.toCanvas(), nearLayer = near.toCanvas();
    const stars = [starLayer(31, 40, ramp(['#6a3050', '#90506a'])), starLayer(32, 24, ramp(['#e0a8a0', '#f4d0c0']))];
    return { back, base, stars, paint(ctx, t, m) {
      ctx.drawImage(base, 0, 0);
      tile(ctx, farLayer, m ? t * .003 : 0); tile(ctx, nearLayer, m ? t * .006 : 0);
    } };
  },
  ruins() {
    const r = new Raster(), bg = new Raster();
    bg.gradient(ramp(['#080c1c', '#10162e', '#1c2442', '#2c3656']));
    r.disc(338, 104, 64, ramp(['#1c2036', '#3a4262', '#6a7898', '#a4b2c8', '#d4dcea']), { craters:[[-18, -10, 9], [20, 14, 7], [-4, 28, 5], [26, -22, 4]] });
    // Ruined skyline: tall at the edges, low in the middle, windows mostly dark.
    const next = rand(41);
    for (let x = 0; x < WIDTH;) {
      const width = 8 + Math.floor(next() * 14), edge = Math.min(x, WIDTH - x) / 150;
      const height = Math.round(8 + (1 - Math.min(1, edge)) * (30 + next() * 28) + next() * 6);
      const top = HEIGHT - height;
      r.rect(x, top, width - 1, height, hex('#070a16'));
      if (next() > .45) r.rect(x + 2, top - 3, 3, 3, hex('#070a16'));
      for (let wy = top + 4; wy < HEIGHT - 4; wy += 6) for (let wx = x + 2; wx < x + width - 3; wx += 4) {
        if (next() > .93) r.rect(wx, wy, 2, 2, hex('#7a6a4a'));
      }
      x += width;
    }
    const base = r.toCanvas(), back = bg.toCanvas();
    const stars = [starLayer(42, 52, ramp(['#242c4a', '#3c4a70'])), starLayer(43, 30, ramp(['#8ea0c0', '#d0d8e8']))];
    return { back, base, stars, paint(ctx) { ctx.drawImage(base, 0, 0); } };
  },
  lunar() {
    const r = new Raster(), bg = new Raster();
    bg.gradient(ramp(['#050c20', '#0a1a3c', '#123058', '#1a4470']));
    r.disc(128, 98, 44, ramp(['#0c1c3c', '#1c3c70', '#3a70a8', '#78b0d0', '#c0e4ee']), { craters:[[-12, -6, 6], [14, 12, 5], [4, -18, 3]] });
    r.disc(356, 170, 26, ramp(['#0e1a38', '#22407a', '#4a78b4', '#90c0dc']), { craters:[[6, 4, 4]] });
    r.disc(430, 52, 10, ramp(['#142038', '#2a4470', '#5a86b8', '#a8d0e4']));
    const base = r.toCanvas(), back = bg.toCanvas();
    const stars = [starLayer(51, 90, ramp(['#1c3458', '#2c4c78'])), starLayer(52, 56, ramp(['#6a9ac4', '#c0e0f0']))];
    return { back, base, stars, paint(ctx) { ctx.drawImage(base, 0, 0); } };
  },
  rift() {
    const cx = 318, cy = 132, tilt = -.28, rx = 150, ry = 40;
    const r = new Raster(), bg = new Raster();
    bg.gradient(ramp(['#030208', '#080414', '#100a22']));
    // Dim, fixed halo around the dark centre; the ring itself is animated.
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      const d = Math.hypot((x - cx) / 1.5, y - cy);
      if (d < 70 && d > 26 && (BAYER[(y & 3) * 4 + (x & 3)] / 16) < (70 - d) / 44 * .45) r.put(x, y, hex('#1a0e2e'));
    }
    const base = r.toCanvas(), back = bg.toCanvas();
    const next = rand(61);
    const bits = Array.from({ length:420 }, () => ({ a:next() * Math.PI * 2, w:.35 + next() * .5, s:.82 + next() * .36, c:Math.floor(next() * 4) }));
    const warm = ['#5a2a1a', '#a85a24', '#e0a040', '#f4e0b0'];
    const disc = new Raster(70, 70);
    disc.disc(35, 35, 22, ramp(['#000000', '#02010a', '#06030f']));
    const discCanvas = disc.toCanvas();
    const stars = [starLayer(62, 44, ramp(['#2a1e48', '#443468'])), starLayer(63, 26, ramp(['#8a7cc0', '#d8d0f0']))];
    return { back, base, stars, paint(ctx, t, m, { ringScale = 1 } = {}) {
      ctx.drawImage(base, 0, 0);
      const turn = m ? t * .00022 : 0, sin = Math.sin(tilt), cos = Math.cos(tilt);
      const draw = back => {
        for (const bit of bits) {
          const a = bit.a + turn * bit.w * Math.PI * 2;
          const px = Math.cos(a) * rx * bit.s * ringScale, py = Math.sin(a) * ry * bit.s * ringScale;
          if ((py < 0) !== back) continue;
          const x = Math.round(cx + px * cos - py * sin), y = Math.round(cy + px * sin + py * cos);
          ctx.fillStyle = warm[bit.c];
          ctx.fillRect(x, y, bit.c > 2 ? 2 : 1, 1);
        }
      };
      draw(true);
      ctx.drawImage(discCanvas, cx - 35, cy - 35);
      draw(false);
    } };
  },
};

// Dims decoration so bullets, rocks, pickups, and warnings stay on top.
const PLAY_DIM = 'rgba(6, 10, 20, .38)';

export class Backgrounds {
  constructor({ reduced = false } = {}) {
    this.reduced = reduced;
    this.motion = 1;
    this.brightness = 1;
    this.timeline = new RegionTimeline({ reduced });
    this.built = new Map();
    this.failed = new Set();
    this.queued = new Set();
  }
  setReduced(value) { this.reduced = value; this.timeline.reduced = value; }
  art(index) {
    if (this.failed.has(index)) return null;
    let art = this.built.get(index);
    if (!art) {
      try { art = BUILDERS[REGIONS[index].id](); this.built.set(index, art); }
      catch (error) { console.error(`Background ${REGIONS[index].id} failed`, error); this.failed.add(index); return null; }
    }
    return art;
  }
  // Build the next region between frames, never in the middle of one.
  preload(index) {
    if (index >= REGIONS.length || this.built.has(index) || this.queued.has(index)) return;
    this.queued.add(index);
    const build = () => { this.art(index); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(build, { timeout:1500 });
    else setTimeout(build, 50);
  }
  paintRegion(ctx, index, time, extra = {}) {
    const art = this.art(index);
    const motion = this.reduced ? 0 : this.motion;
    if (!art) { ctx.fillStyle = REGIONS[index].fallback; ctx.fillRect(0, 0, WIDTH, HEIGHT); return; }
    ctx.drawImage(art.back, 0, 0);
    tile(ctx, art.stars[0], motion * time * .0016);
    tile(ctx, art.stars[1], motion * time * .004);
    ctx.save();
    ctx.translate(extra.offsetX || 0, extra.offsetY || 0);
    art.paint(ctx, time, motion, extra);
    ctx.restore();
  }
  // Draws the scene for the current region and any transition in progress.
  draw(ctx, { time, wave, run, practice, dim, hold = false }) {
    const lines = this.timeline;
    if (!hold) lines.observe({ wave, time, run, practice });
    const index = lines.index;
    this.preload(index + 1);
    const move = lines.progress(time);
    if (!move) this.paintRegion(ctx, index, time);
    else {
      const { from, to, e, gesture } = move;
      if (gesture === 'orbital-pass') {
        this.paintRegion(ctx, from, time, { offsetX:-Math.round(e * 36) });
        ctx.globalAlpha = e; this.paintRegion(ctx, to, time, { offsetX:Math.round((1 - e) * 64) }); ctx.globalAlpha = 1;
      } else if (gesture === 'ring-convergence') {
        this.paintRegion(ctx, from, time);
        ctx.globalAlpha = e; this.paintRegion(ctx, to, time, { ringScale:1 + .22 * (1 - e) }); ctx.globalAlpha = 1;
        this.convergence(ctx, move.t);
      } else if (gesture === 'atmospheric-sweep') {
        this.paintRegion(ctx, from, time);
        const edge = Math.round(WIDTH * e);
        ctx.save();ctx.beginPath();ctx.rect(0,0,edge,HEIGHT);ctx.clip();
        this.paintRegion(ctx,to,time);ctx.restore();
        ctx.fillStyle=`rgba(130,55,70,${(.14*Math.sin(e*Math.PI)).toFixed(3)})`;
        ctx.fillRect(Math.max(0,edge-14),0,28,HEIGHT);
      } else if (gesture === 'skyline-emergence') {
        this.paintRegion(ctx,from,time);
        ctx.globalAlpha=e;this.paintRegion(ctx,to,time,{offsetY:Math.round((1-e)*6)});ctx.globalAlpha=1;
      } else if (gesture === 'cloud-clearance') {
        this.paintRegion(ctx,from,time);ctx.globalAlpha=e;
        this.paintRegion(ctx,to,time);ctx.globalAlpha=1;
        ctx.fillStyle=`rgba(50,70,110,${(.18*Math.sin(e*Math.PI)).toFixed(3)})`;
        for(let lane=0;lane<5;lane++)ctx.fillRect(Math.round((1-e)*WIDTH-lane*80),lane*54,90,14);
      } else {
        this.paintRegion(ctx, from, time);
        ctx.globalAlpha = e; this.paintRegion(ctx, to, time); ctx.globalAlpha = 1;
      }
    }
    if (dim) { ctx.fillStyle = PLAY_DIM; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
    if(this.brightness<1){ctx.fillStyle=`rgba(0,0,0,${1-this.brightness})`;ctx.fillRect(0,0,WIDTH,HEIGHT);}
    return lines.cue(time);
  }
  // A few distant star traces bend toward the emerging ring. Background only.
  convergence(ctx, t) {
    const cx = 318, cy = 132, next = rand(77);
    ctx.fillStyle = '#9a90d0';
    for (let i = 0; i < 14; i++) {
      const angle = next() * Math.PI * 2, start = 190 + next() * 70, spin = .9 + next() * .5;
      const progress = Math.max(0, Math.min(1, (t - .1 - next() * .15) / .6));
      for (let k = 0; k < 7; k++) {
        const p = Math.min(1, progress + k * .018), radius = start * (1 - p * .82);
        const a = angle + spin * p;
        const x = Math.round(cx + Math.cos(a) * radius), y = Math.round(cy + Math.sin(a) * radius * .6);
        ctx.globalAlpha = (.12 + .5 * (1 - k / 7)) * Math.sin(Math.min(1, progress) * Math.PI);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
}
