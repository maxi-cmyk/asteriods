// Pixel rasters for the backgrounds: value noise, ordered dithering and a small canvas of
// 32-bit pixels with discs, hills, nebulae, bloom, halos and banded gas giants. Light comes
// from the upper left, matching the sprite atlas.
import { WIDTH, HEIGHT } from '../constants.mjs';

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const LIGHT = (() => {
    const x = -0.55,
        y = -0.6,
        z = 0.58,
        n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
})();

export const rand = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const hex = (value) => {
    const n = parseInt(value.slice(1), 16);
    return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
};
export const ramp = (list) => list.map(hex);
export const canvasOf = (w, h) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
};

export const unpack = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
export const pack = (r, g, b) =>
    ((255 << 24) |
        (Math.max(0, Math.min(255, b)) << 16) |
        (Math.max(0, Math.min(255, g)) << 8) |
        Math.max(0, Math.min(255, r))) >>>
    0;
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)] / 16;
// Posterise one channel to `levels` steps with ordered dither: chunky, never smooth.
export const step = (value, levels, x, y) =>
    (Math.floor((value / 255) * (levels - 1) + bayer(x, y)) / (levels - 1)) * 255;

// Value noise on a lattice, smoothly interpolated, summed over octaves.
export function fbm(seed, w, h, scale, octaves = 4) {
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
export class Raster {
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
