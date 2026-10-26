// Star layers and the pre-rendered rotating worlds that region painters place.
import { WIDTH, HEIGHT } from '../constants.mjs';
import { rand, hex, Raster } from './raster.mjs';

// Sparse bright stars get a small cross so the field has points of focus.
export const starLayer = (seed, count, colours, flares = 0) => {
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
export const tile = (ctx, layer, offset, alpha = 1) => {
    const x = -Math.floor(((offset % WIDTH) + WIDTH) % WIDTH);
    ctx.globalAlpha = alpha;
    ctx.drawImage(layer, x, 0);
    ctx.drawImage(layer, x + WIDTH, 0);
    ctx.globalAlpha = 1;
};

// Pre-rendered rotation strips from worlds.png. A world turns once every
// `period` ms (minutes, not seconds) and neighbouring frames crossfade, so the
// spin is felt only as slow drift. `motion` 0 (reduced motion) holds frame 0.
export const S_ORBITS = [
    [38, 20, 0.5, '#9ad0ff'],
    [56, 30, 2.2, '#ffe9a0'],
    [74, 24, 4.1, '#ffb070'],
    [30, 16, 3.2, '#ffffff'],
];
export function drawWorld(
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
