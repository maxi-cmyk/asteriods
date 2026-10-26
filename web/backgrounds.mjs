// Original, procedurally authored pixel backgrounds for each region. Nothing
// here is copied from the inspiration references: those are watermarked
// previews, so only their moods (a violet gas giant, a red world over pink
// terrain, a ruined moon, calm blue moons, a black-hole ring) guide the art.
// Light comes from the upper left, matching the sprite atlas.
import { REGIONS, RegionTimeline } from './regions.mjs';

export const WIDTH = 480;
export const HEIGHT = 270;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LIGHT = (() => {
    const x = -0.55,
        y = -0.6,
        z = 0.58,
        n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
})();

const rand = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hex = (value) => {
    const n = parseInt(value.slice(1), 16);
    return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
};
const ramp = (list) => list.map(hex);
const canvasOf = (w, h) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
};

const unpack = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
const pack = (r, g, b) =>
    ((255 << 24) |
        (Math.max(0, Math.min(255, b)) << 16) |
        (Math.max(0, Math.min(255, g)) << 8) |
        Math.max(0, Math.min(255, r))) >>>
    0;
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)] / 16;
// Posterise one channel to `levels` steps with ordered dither: chunky, never smooth.
const step = (value, levels, x, y) =>
    (Math.floor((value / 255) * (levels - 1) + bayer(x, y)) / (levels - 1)) * 255;

// Value noise on a lattice, smoothly interpolated, summed over octaves.
function fbm(seed, w, h, scale, octaves = 4) {
    const next = rand(seed),
        out = new Float32Array(w * h);
    let amp = 1,
        total = 0;
    for (let o = 0; o < octaves; o++) {
        const cell = Math.max(2, scale / 2 ** o),
            gw = Math.ceil(w / cell) + 3,
            gh = Math.ceil(h / cell) + 3;
        const grid = Float32Array.from({ length: gw * gh }, next);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const fx = x / cell,
                    fy = y / cell,
                    ix = Math.floor(fx),
                    iy = Math.floor(fy);
                const tx = fx - ix,
                    ty = fy - iy,
                    sx = tx * tx * (3 - 2 * tx),
                    sy = ty * ty * (3 - 2 * ty);
                const a = grid[iy * gw + ix],
                    b = grid[iy * gw + ix + 1],
                    c = grid[(iy + 1) * gw + ix],
                    d = grid[(iy + 1) * gw + ix + 1];
                out[y * w + x] += (a + (b - a) * sx + (c - a + (a - b - c + d) * sx) * sy) * amp;
            }
        total += amp;
        amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= total;
    return out;
}

// A raster is a 480x270 pixel buffer painted with a few pixel-art primitives.
class Raster {
    constructor(w = WIDTH, h = HEIGHT) {
        this.w = w;
        this.h = h;
        this.data = new Uint32Array(w * h);
    }
    put(x, y, colour) {
        if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = colour;
    }
    rect(x, y, w, h, colour) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, colour);
    }
    gradient(colours) {
        for (let y = 0; y < this.h; y++) {
            const t = (y / (this.h - 1)) * (colours.length - 1),
                i = Math.min(colours.length - 2, Math.floor(t));
            for (let x = 0; x < this.w; x++)
                this.data[y * this.w + x] =
                    t - i > BAYER[(y & 3) * 4 + (x & 3)] / 16 ? colours[i + 1] : colours[i];
        }
    }
    // A dithered, lit sphere. `shape` may carry craters and a per-row tint.
    disc(cx, cy, r, colours, { craters = [], tint = null, clipTop = -Infinity } = {}) {
        for (let y = Math.max(clipTop, cy - r); y <= cy + r; y++) {
            for (let x = cx - r; x <= cx + r; x++) {
                const dx = (x - cx) / r,
                    dy = (y - cy) / r,
                    d2 = dx * dx + dy * dy;
                if (d2 > 1) continue;
                const nz = Math.sqrt(1 - d2);
                let lit = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]);
                for (const [ox, oy, cr] of craters) {
                    const e = Math.hypot(x - (cx + ox), y - (cy + oy));
                    if (e < cr) lit *= 0.55;
                    else if (e < cr + 1.2 && x - cx - ox < 0) lit = Math.min(1, lit * 1.25 + 0.1);
                }
                const level =
                    lit * (colours.length - 1) + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.9;
                const index = Math.max(0, Math.min(colours.length - 1, Math.round(level)));
                this.put(x, y, tint ? tint(y, colours[index]) : colours[index]);
            }
        }
    }
    // Rolling silhouette: a periodic sum of sines so layers scroll seamlessly.
    hills(base, amp, waves, colour, edge) {
        for (let x = 0; x < this.w; x++) {
            let h = 0;
            for (const [cycles, weight, phase] of waves)
                h += Math.sin((x / this.w) * Math.PI * 2 * cycles + phase) * weight;
            const top = Math.round(base - h * amp);
            for (let y = top; y < this.h; y++) this.put(x, y, y === top && edge ? edge : colour);
        }
    }
    stars(seed, count, colours, size = 1) {
        const next = rand(seed);
        for (let i = 0; i < count; i++) {
            const x = Math.floor(next() * this.w),
                y = Math.floor(next() * this.h),
                c = colours[Math.floor(next() * colours.length)];
            this.rect(x, y, size, size, c);
        }
    }
    // Soft coloured cloud added over the existing pixels, then re-dithered.
    // `side` weights it toward an edge so the middle of the field stays calm.
    nebula(
        seed,
        [r, g, b],
        {
            threshold = 0.42,
            gain = 2.4,
            strength = 0.8,
            scale = 90,
            side = 'top',
            levels = 20,
        } = {},
    ) {
        const n = fbm(seed, this.w, this.h, scale);
        for (let y = 0; y < this.h; y++)
            for (let x = 0; x < this.w; x++) {
                const i = y * this.w + x;
                let weight = Math.max(0, Math.min(1, (n[i] - threshold) * gain)) * strength;
                weight *=
                    side === 'right'
                        ? Math.min(1, (x / this.w) * 1.2)
                        : side === 'top'
                          ? Math.max(0, 1.15 - (y / this.h) * 0.6)
                          : 1;
                if (weight <= 0) continue;
                const [cr, cg, cb] = unpack(this.data[i]);
                this.data[i] = pack(
                    step(cr + r * weight, levels, x, y),
                    step(cg + g * weight, levels, x, y),
                    step(cb + b * weight, levels, x, y),
                );
            }
    }
    // A warm light source off-screen: radial lift on the dithered backdrop.
    bloom(cx, cy, reach, [r, g, b], strength = 0.3, levels = 20) {
        for (let y = 0; y < this.h; y++)
            for (let x = 0; x < this.w; x++) {
                const t = 1 - Math.hypot(x - cx, y - cy) / reach;
                if (t <= 0) continue;
                const k = t * t * strength,
                    [cr, cg, cb] = unpack(this.data[y * this.w + x]);
                this.data[y * this.w + x] = pack(
                    step(cr + r * k, levels, x, y),
                    step(cg + g * k, levels, x, y),
                    step(cb + b * k, levels, x, y),
                );
            }
    }
    // Dithered atmosphere ring just outside a planet's limb.
    halo(cx, cy, r, width, colour) {
        for (let y = Math.max(0, cy - r - width); y <= Math.min(this.h - 1, cy + r + width); y++) {
            for (
                let x = Math.max(0, cx - r - width);
                x <= Math.min(this.w - 1, cx + r + width);
                x++
            ) {
                const d = Math.hypot(x - cx, y - cy) - r;
                if (d <= 0 || d > width) continue;
                const lean =
                    Math.max(0, (cx - x) * LIGHT[0] * -1 + (cy - y) * LIGHT[1] * -1) / r + 0.35;
                if ((1 - d / width) * Math.min(1, lean) * 0.9 > bayer(x, y)) this.put(x, y, colour);
            }
        }
    }
    // A lit gas giant: banded colour wobbled by noise-like sines, shaded by the
    // same light as every other body, with a bright atmospheric limb.
    bandedDisc(
        cx,
        cy,
        r,
        bands,
        { count = 11, warp = 0.16, atmosphere = [255, 150, 120], clipTop = -Infinity } = {},
    ) {
        const rgb = bands.map(unpack);
        for (let y = Math.max(clipTop, cy - r); y <= cy + r; y++) {
            for (let x = cx - r; x <= cx + r; x++) {
                const dx = (x - cx) / r,
                    dy = (y - cy) / r,
                    d2 = dx * dx + dy * dy;
                if (d2 > 1) continue;
                const nz = Math.sqrt(1 - d2);
                const lit = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]);
                const wobble =
                    Math.sin(x * 0.045 + y * 0.02) * 0.5 + Math.sin(x * 0.11 - y * 0.05) * 0.25;
                const band =
                    (Math.sin((dy + wobble * warp) * count) * 0.5 + 0.5) * (rgb.length - 1);
                const i = Math.min(rgb.length - 2, Math.floor(band)),
                    u = band - i;
                const shade = 0.16 + 0.95 * lit ** 0.85,
                    rim =
                        Math.max(0, (d2 - 0.52) / 0.48) ** 2 * Math.min(1, lit * 1.4 + 0.15) * 0.85;
                const channel = (k) => rgb[i][k] + (rgb[i + 1][k] - rgb[i][k]) * u;
                this.put(
                    x,
                    y,
                    pack(
                        step(channel(0) * shade + atmosphere[0] * rim, 14, x, y),
                        step(channel(1) * shade + atmosphere[1] * rim + (1 - shade) * 10, 14, x, y),
                        step(channel(2) * shade + atmosphere[2] * rim + (1 - shade) * 40, 14, x, y),
                    ),
                );
            }
        }
    }
    toCanvas() {
        const { canvas, ctx } = canvasOf(this.w, this.h);
        ctx.putImageData(
            new ImageData(new Uint8ClampedArray(this.data.buffer), this.w, this.h),
            0,
            0,
        );
        return canvas;
    }
}

// Sparse bright stars get a small cross so the field has points of focus.
const starLayer = (seed, count, colours, flares = 0) => {
    const r = new Raster();
    r.stars(seed, count, colours);
    const next = rand(seed + 500);
    for (let i = 0; i < flares; i++) {
        const x = 8 + Math.floor(next() * (WIDTH - 16)),
            y = 8 + Math.floor(next() * (HEIGHT - 60));
        r.put(x, y, hex('#ffffff'));
        for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ])
            r.put(x + dx, y + dy, hex('#96aaff'));
        r.put(x + 2, y, hex('#5a64be'));
        r.put(x - 2, y, hex('#5a64be'));
    }
    return r.toCanvas();
};
const tile = (ctx, layer, offset, alpha = 1) => {
    const x = -Math.floor(((offset % WIDTH) + WIDTH) % WIDTH);
    ctx.globalAlpha = alpha;
    ctx.drawImage(layer, x, 0);
    ctx.drawImage(layer, x + WIDTH, 0);
    ctx.globalAlpha = 1;
};

// Pre-rendered rotation strips from worlds.png. A world turns once every
// `period` ms (minutes, not seconds) and neighbouring frames crossfade, so the
// spin is felt only as slow drift. `motion` 0 (reduced motion) holds frame 0.
const S_ORBITS = [
    [38, 20, 0.5, '#9ad0ff'],
    [56, 30, 2.2, '#ffe9a0'],
    [74, 24, 4.1, '#ffb070'],
    [30, 16, 3.2, '#ffffff'],
];
function drawWorld(
    ctx,
    worlds,
    name,
    cx,
    cy,
    time,
    motion,
    { period = 180000, phase = 0, alpha = 1 } = {},
) {
    const w = worlds?.frames[name];
    if (!w) return;
    const turn = motion ? (((time / period + phase) % 1) + 1) % 1 : 0,
        at = turn * w.frames,
        i = Math.floor(at) % w.frames,
        mix = at - Math.floor(at);
    const x = Math.round(cx - w.w / 2),
        y = Math.round(cy - w.h / 2);
    ctx.globalAlpha = alpha;
    ctx.drawImage(worlds.image, w.x + i * w.w, w.y, w.w, w.h, x, y, w.w, w.h);
    ctx.globalAlpha = 1;
    if (motion && mix > 0.02) {
        ctx.globalAlpha = mix * alpha;
        ctx.drawImage(
            worlds.image,
            w.x + ((i + 1) % w.frames) * w.w,
            w.y,
            w.w,
            w.h,
            x,
            y,
            w.w,
            w.h,
        );
        ctx.globalAlpha = 1;
    }
}

// Each builder returns { base, stars:[far, near], paint(ctx, time, motion, extra) }.
// `motion` is 0 for reduced motion, otherwise 1.
const BUILDERS = {
    frontier(worlds) {
        const r = new Raster(),
            bg = new Raster();
        bg.gradient(ramp(['#09061c', '#1a0c3a', '#4a185c', '#96346a']));
        bg.nebula(101, [70, 20, 120], { threshold: 0.42, gain: 2.4, strength: 0.8 });
        bg.nebula(102, [20, 70, 130], {
            threshold: 0.5,
            gain: 2.8,
            strength: 0.6,
            scale: 40,
            side: 'right',
        });
        bg.bloom(40, 18, 210, [255, 150, 90], 0.35);
        // A storm giant fills the lower right, cropped by the ridge; a cratered moon hangs upper left.
        r.hills(
            252,
            8,
            [
                [3, 1, 0.4],
                [7, 0.5, 1.3],
                [13, 0.25, 2.1],
            ],
            hex('#04030f'),
            hex('#8a3a58'),
        );
        const base = r.toCanvas(),
            back = bg.toCanvas();
        const stars = [
            starLayer(11, 70, ramp(['#3a2c68', '#5a4c98'])),
            starLayer(12, 46, ramp(['#8a98c8', '#e0d8f0']), 8),
        ];
        return {
            back,
            base,
            stars,
            paint(ctx, t, m) {
                drawWorld(ctx, worlds, 'storm-giant', 398, 222, t, m, { period: 240000 });
                drawWorld(ctx, worlds, 'moon-small', 82, 74, t, m, { period: 170000, phase: 0.3 });
                drawWorld(ctx, worlds, 'moon-tiny', 304, 46, t, m, { period: 130000, phase: 0.6 });
                ctx.drawImage(base, 0, 0);
            },
        };
    },
    violet(worlds) {
        const bg = new Raster();
        bg.gradient(ramp(['#08051a', '#140a30', '#2c1248', '#5a2060']));
        bg.nebula(111, [90, 30, 130], { threshold: 0.4, gain: 2.2, strength: 0.8 });
        bg.nebula(112, [30, 60, 150], {
            threshold: 0.5,
            gain: 2.6,
            strength: 0.55,
            scale: 44,
            side: 'right',
        });
        bg.bloom(30, 14, 200, [255, 140, 100], 0.25);
        const back = bg.toCanvas();
        const stars = [
            starLayer(21, 60, ramp(['#2a2650', '#463e78'])),
            starLayer(22, 40, ramp(['#8a7ec0', '#d0c4f0']), 6),
        ];
        return {
            back,
            stars,
            paint(ctx, t, m) {
                drawWorld(ctx, worlds, 'ice-giant', 352, 168, t, m, { period: 260000 });
                drawWorld(ctx, worlds, 'ice-moon', 120, 70, t, m, { period: 150000, phase: 0.4 });
            },
        };
    },
    ember(worlds) {
        const r = new Raster(),
            bg = new Raster();
        bg.gradient(ramp(['#1c0a1a', '#3a1424', '#6a2430', '#8c3a3c']));
        bg.nebula(121, [120, 40, 60], { threshold: 0.42, gain: 2.2, strength: 0.7 });
        bg.bloom(30, 14, 220, [255, 170, 110], 0.3);
        const base = r.toCanvas(),
            back = bg.toCanvas();
        const far = new Raster();
        far.hills(
            236,
            12,
            [
                [2, 1, 0.6],
                [5, 0.55, 1.4],
                [9, 0.3, 2.6],
            ],
            hex('#4a1c34'),
            hex('#7a3050'),
        );
        const near = new Raster();
        near.hills(
            258,
            9,
            [
                [3, 1, 2.2],
                [7, 0.5, 0.5],
                [11, 0.3, 1.7],
            ],
            hex('#2e1228'),
            hex('#5a2442'),
        );
        const farLayer = far.toCanvas(),
            nearLayer = near.toCanvas();
        const stars = [
            starLayer(31, 40, ramp(['#6a3050', '#90506a'])),
            starLayer(32, 24, ramp(['#e0a8a0', '#f4d0c0']), 6),
        ];
        return {
            back,
            base,
            stars,
            paint(ctx, t, m) {
                ctx.drawImage(base, 0, 0);
                drawWorld(ctx, worlds, 'lava-world', 122, 100, t, m, { period: 200000 });
                drawWorld(ctx, worlds, 'hot-jupiter', 408, 62, t, m, {
                    period: 140000,
                    phase: 0.2,
                });
                tile(ctx, farLayer, m ? t * 0.003 : 0);
                tile(ctx, nearLayer, m ? t * 0.006 : 0);
            },
        };
    },
    ruins(worlds) {
        const r = new Raster(),
            bg = new Raster();
        bg.gradient(ramp(['#080c1c', '#10162e', '#1c2442', '#2c3656']));
        bg.nebula(131, [40, 56, 110], { threshold: 0.44, gain: 2.2, strength: 0.7 });
        bg.bloom(40, 14, 200, [220, 190, 170], 0.2);
        // Ruined skyline: tall at the edges, low in the middle, windows mostly dark.
        const next = rand(41);
        for (let x = 0; x < WIDTH; ) {
            const width = 8 + Math.floor(next() * 14),
                edge = Math.min(x, WIDTH - x) / 150;
            const height = Math.round(
                8 + (1 - Math.min(1, edge)) * (30 + next() * 28) + next() * 6,
            );
            const top = HEIGHT - height;
            r.rect(x, top, width - 1, height, hex('#070a16'));
            if (next() > 0.45) r.rect(x + 2, top - 3, 3, 3, hex('#070a16'));
            for (let wy = top + 4; wy < HEIGHT - 4; wy += 6)
                for (let wx = x + 2; wx < x + width - 3; wx += 4) {
                    if (next() > 0.93) r.rect(wx, wy, 2, 2, hex('#7a6a4a'));
                }
            x += width;
        }
        const base = r.toCanvas(),
            back = bg.toCanvas();
        const stars = [
            starLayer(42, 52, ramp(['#242c4a', '#3c4a70'])),
            starLayer(43, 30, ramp(['#8ea0c0', '#d0d8e8']), 6),
        ];
        return {
            back,
            base,
            stars,
            paint(ctx, t, m) {
                drawWorld(ctx, worlds, 'moon-large', 338, 104, t, m, { period: 300000 });
                ctx.drawImage(base, 0, 0);
            },
        };
    },
    lunar(worlds) {
        const r = new Raster(),
            bg = new Raster();
        bg.gradient(ramp(['#050c20', '#0a1a3c', '#123058', '#1a4470']));
        bg.nebula(141, [20, 90, 130], { threshold: 0.42, gain: 2.4, strength: 0.7 });
        bg.bloom(40, 14, 200, [160, 220, 255], 0.22);
        const base = r.toCanvas(),
            back = bg.toCanvas();
        const stars = [
            starLayer(51, 90, ramp(['#1c3458', '#2c4c78'])),
            starLayer(52, 56, ramp(['#6a9ac4', '#c0e0f0']), 6),
        ];
        return {
            back,
            base,
            stars,
            paint(ctx, t, m) {
                drawWorld(ctx, worlds, 'ocean-world', 128, 98, t, m, { period: 210000 });
                drawWorld(ctx, worlds, 'ice-moon', 356, 172, t, m, { period: 160000, phase: 0.5 });
                drawWorld(ctx, worlds, 'moon-tiny', 430, 52, t, m, { period: 120000, phase: 0.1 });
            },
        };
    },
    rift(worlds) {
        const cx = 318,
            cy = 132;
        const bg = new Raster();
        bg.gradient(ramp(['#030208', '#080414', '#100a22']));
        bg.nebula(151, [70, 24, 90], { threshold: 0.45, gain: 2.2, strength: 0.55, side: 'all' });
        const back = bg.toCanvas();
        const stars = [
            starLayer(62, 44, ramp(['#2a1e48', '#443468'])),
            starLayer(63, 26, ramp(['#8a7cc0', '#d8d0f0']), 6),
        ];
        // Sagittarius A*: a lopsided ring around a black shadow. Four stars circle it,
        // each taking minutes per orbit, and the image itself is static.
        return {
            back,
            stars,
            paint(ctx, t, m) {
                drawWorld(ctx, worlds, 'sgr-a', cx, cy, t, 0);
                for (const [ia, ib, rot, colour] of S_ORBITS) {
                    const angle = rot + (m ? (t / 1000 / 300) * Math.PI * 2 * (60 / ia) ** 1.5 : 0);
                    const co = Math.cos(rot),
                        so = Math.sin(rot);
                    const x = cx + ia * Math.cos(angle) * co - ib * Math.sin(angle) * so,
                        y = cy + ia * Math.cos(angle) * so + ib * Math.sin(angle) * co;
                    ctx.fillStyle = colour;
                    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
                }
            },
        };
    },
};

// Tier 3+ boss fights (waves 93 and up) play in front of something that should
// not exist: a quasi-star, a pulsar or a magnetar, picked by boss and tier. It
// replaces nothing; the region's own scenery dims behind a veil. Background only.
export const FIGHT_SCENERY = Object.freeze([
    { name: 'quasi-star', x: 138, y: 98, period: 0 },
    { name: 'pulsar', x: 150, y: 102, period: 9000 },
    { name: 'magnetar', x: 150, y: 102, period: 9000 },
]);
export const fightSceneryFor = ({ kind, tier }) =>
    FIGHT_SCENERY[((((kind % 6) + tier - 3) % 3) + 3) % 3];

// Dims decoration so bullets, rocks, pickups, and warnings stay on top.
const PLAY_DIM = 'rgba(8, 4, 22, .2)';

export class Backgrounds {
    constructor({ reduced = false } = {}) {
        this.reduced = reduced;
        this.motion = 1;
        this.brightness = 1;
        this.timeline = new RegionTimeline({ reduced });
        this.built = new Map();
        this.failed = new Set();
        this.queued = new Set();
        this.worlds = null;
        this.fightMix = 0;
        this.fightPick = null;
        this.fightTime = null;
    }
    // Sprites arrive after the game art loads; regions built earlier are rebuilt.
    setWorlds(worlds) {
        this.worlds = worlds;
        this.built.clear();
        this.failed.clear();
    }
    setReduced(value) {
        this.reduced = value;
        this.timeline.reduced = value;
    }
    art(index) {
        if (this.failed.has(index)) return null;
        let art = this.built.get(index);
        if (!art) {
            try {
                art = BUILDERS[REGIONS[index].id](this.worlds);
                this.built.set(index, art);
            } catch (error) {
                console.error(`Background ${REGIONS[index].id} failed`, error);
                this.failed.add(index);
                return null;
            }
        }
        return art;
    }
    // Build the next region between frames, never in the middle of one.
    preload(index) {
        if (index >= REGIONS.length || this.built.has(index) || this.queued.has(index)) return;
        this.queued.add(index);
        const build = () => {
            this.art(index);
        };
        if (typeof requestIdleCallback === 'function')
            requestIdleCallback(build, { timeout: 1500 });
        else setTimeout(build, 50);
    }
    paintRegion(ctx, index, time, extra = {}) {
        const art = this.art(index);
        const motion = this.reduced ? 0 : this.motion;
        if (!art) {
            ctx.fillStyle = REGIONS[index].fallback;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
            return;
        }
        ctx.drawImage(art.back, 0, 0);
        tile(ctx, art.stars[0], motion * time * 0.0016);
        tile(ctx, art.stars[1], motion * time * 0.004);
        ctx.save();
        ctx.translate(extra.offsetX || 0, extra.offsetY || 0);
        art.paint(ctx, time, motion, extra);
        ctx.restore();
    }
    // Draws the scene for the current region and any transition in progress.
    draw(ctx, { time, wave, run, practice, dim, hold = false, fight = null }) {
        const lines = this.timeline;
        if (!hold) lines.observe({ wave, time, run, practice });
        const index = lines.index;
        this.preload(index + 1);
        const move = lines.progress(time);
        if (!move) this.paintRegion(ctx, index, time);
        else {
            const { from, to, e, gesture } = move;
            if (gesture === 'orbital-pass') {
                this.paintRegion(ctx, from, time, { offsetX: -Math.round(e * 36) });
                ctx.globalAlpha = e;
                this.paintRegion(ctx, to, time, { offsetX: Math.round((1 - e) * 64) });
                ctx.globalAlpha = 1;
            } else if (gesture === 'ring-convergence') {
                this.paintRegion(ctx, from, time);
                ctx.globalAlpha = e;
                this.paintRegion(ctx, to, time, { ringScale: 1 + 0.22 * (1 - e) });
                ctx.globalAlpha = 1;
                this.convergence(ctx, move.t);
            } else if (gesture === 'atmospheric-sweep') {
                this.paintRegion(ctx, from, time);
                const edge = Math.round(WIDTH * e);
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, edge, HEIGHT);
                ctx.clip();
                this.paintRegion(ctx, to, time);
                ctx.restore();
                ctx.fillStyle = `rgba(130,55,70,${(0.14 * Math.sin(e * Math.PI)).toFixed(3)})`;
                ctx.fillRect(Math.max(0, edge - 14), 0, 28, HEIGHT);
            } else if (gesture === 'skyline-emergence') {
                this.paintRegion(ctx, from, time);
                ctx.globalAlpha = e;
                this.paintRegion(ctx, to, time, { offsetY: Math.round((1 - e) * 6) });
                ctx.globalAlpha = 1;
            } else if (gesture === 'cloud-clearance') {
                this.paintRegion(ctx, from, time);
                ctx.globalAlpha = e;
                this.paintRegion(ctx, to, time);
                ctx.globalAlpha = 1;
                ctx.fillStyle = `rgba(50,70,110,${(0.18 * Math.sin(e * Math.PI)).toFixed(3)})`;
                for (let lane = 0; lane < 5; lane++)
                    ctx.fillRect(Math.round((1 - e) * WIDTH - lane * 80), lane * 54, 90, 14);
            } else {
                this.paintRegion(ctx, from, time);
                ctx.globalAlpha = e;
                this.paintRegion(ctx, to, time);
                ctx.globalAlpha = 1;
            }
        }
        this.paintFight(ctx, time, fight);
        if (dim) {
            ctx.fillStyle = PLAY_DIM;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
        }
        if (this.brightness < 1) {
            ctx.fillStyle = `rgba(0,0,0,${1 - this.brightness})`;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
        }
        return lines.cue(time);
    }
    // Fades the tier 3+ backdrop in and out over about 0.7 s of visual time.
    paintFight(ctx, time, fight) {
        const active = !!fight && fight.tier >= 3;
        if (active) this.fightPick = fightSceneryFor(fight);
        const dt = this.fightTime === null ? 0 : Math.max(0, Math.min(100, time - this.fightTime));
        this.fightTime = time;
        this.fightMix = Math.max(
            0,
            Math.min(1, this.fightMix + (active ? dt : -dt) / (this.reduced ? 120 : 700)),
        );
        if (!this.fightMix || !this.fightPick || !this.worlds) return;
        ctx.fillStyle = `rgba(6, 3, 16, ${(0.55 * this.fightMix).toFixed(3)})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        const { name, x, y, period } = this.fightPick;
        drawWorld(ctx, this.worlds, name, x, y, time, this.reduced ? 0 : this.motion, {
            period: period || 1,
            alpha: this.fightMix,
        });
    }
    // A few distant star traces bend toward the emerging ring. Background only.
    convergence(ctx, t) {
        const cx = 318,
            cy = 132,
            next = rand(77);
        ctx.fillStyle = '#9a90d0';
        for (let i = 0; i < 14; i++) {
            const angle = next() * Math.PI * 2,
                start = 190 + next() * 70,
                spin = 0.9 + next() * 0.5;
            const progress = Math.max(0, Math.min(1, (t - 0.1 - next() * 0.15) / 0.6));
            for (let k = 0; k < 7; k++) {
                const p = Math.min(1, progress + k * 0.018),
                    radius = start * (1 - p * 0.82);
                const a = angle + spin * p;
                const x = Math.round(cx + Math.cos(a) * radius),
                    y = Math.round(cy + Math.sin(a) * radius * 0.6);
                ctx.globalAlpha =
                    (0.12 + 0.5 * (1 - k / 7)) * Math.sin(Math.min(1, progress) * Math.PI);
                ctx.fillRect(x, y, 1, 1);
            }
        }
        ctx.globalAlpha = 1;
    }
}
