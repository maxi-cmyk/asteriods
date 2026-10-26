// Drawing helpers shared by the boss death scripts. `d` is the death context built by
// drawDeath: { ctx, art, kind, snap, state, x, y, age, sheet, reduced }.
import { BLOCK, blockDisc, ease, hash, pixelGlow } from '../../render/fx.mjs';

export const body = (d, key, opts = {}) => d.art.drawFx(d.ctx, d.sheet, key, d.x, d.y, opts);

export const TAU = Math.PI * 2;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const snap4 = (v) => Math.round(v / BLOCK) * BLOCK;
export const FIRE = ['#e8944a', '#ffd9a0', '#fff4dc', '#ffffff'];
export const VIOLET = ['#8a5ad8', '#c8a8ff', '#f0e4ff', '#ffffff'];

// ---------------------------------------------------------------- primitives
export function shake(d, amount, from = 0, to = Infinity) {
    if (d.reduced || d.age < from || d.age > to) return [0, 0];
    const n = Math.floor(d.age / 50);
    return [snap4((hash(n * 2.1) - 0.5) * amount), snap4((hash(n * 3.7 + 1) - 0.5) * amount)];
}
export const flicker = (d, every = 110, from = 0, to = Infinity) =>
    !d.reduced && d.age >= from && d.age <= to && Math.floor(d.age / every) % 2 ? 0.45 : 0;
export function fireball(d, x, y, since, scale = 1, colours = FIRE, life = 1500) {
    const a = d.age - since;
    if (a < 0 || a > life) return;
    const t = a / life,
        swell = ease(clamp01(a / 300)) * Math.max(0, 1 - Math.max(0, t - 0.2) * 1.25);
    const ctx = d.ctx;
    pixelGlow(ctx, x, y, Math.round(84 * scale), '255,140,60', 0.6 * Math.max(0, 1 - t));
    blockDisc(ctx, x, y, 50 * scale * swell, colours[0], 1);
    blockDisc(ctx, x, y, 38 * scale * swell, colours[1], 2);
    blockDisc(ctx, x, y, 26 * scale * swell, colours[2], 3);
    blockDisc(ctx, x, y, 15 * scale * swell, colours[3], 4);
}
export function rays(
    d,
    x,
    y,
    since,
    { count = 30, colours = ['#ffe6a0', '#ff9648', '#ffffff'], reach = 1, life = 650 } = {},
) {
    const a = d.age - since;
    if (a < 0 || a > life) return;
    const ctx = d.ctx,
        t = a / life;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * TAU + hash(i) * 0.08,
            start = (18 + hash(i + 4) * 14 + ease(t) * 40) * reach;
        const length = (12 + hash(i + 2) * 42 * (1 - t)) * reach;
        ctx.fillStyle = colours[i % colours.length];
        for (let k = 0; k < length; k++)
            ctx.fillRect(
                Math.round(x + Math.cos(angle) * (start + k)),
                Math.round(y + Math.sin(angle) * (start + k)),
                1,
                1,
            );
    }
}
export function ring(
    d,
    x,
    y,
    since,
    { speed = 0.22, colour = '#ffe8c0', life = 900, squash = 0.86, max = 400 } = {},
) {
    const a = d.age - since;
    if (a < 0 || a > life) return;
    const ctx = d.ctx,
        r = Math.min(max, ease(a / life) * speed * life);
    ctx.globalAlpha = 1 - a / life;
    ctx.fillStyle = colour;
    for (let i = 0, n = Math.round(r * 2.6) + 12; i < n; i++) {
        const angle = (i / n) * TAU;
        ctx.fillRect(
            Math.round(x + Math.cos(angle) * r),
            Math.round(y + Math.sin(angle) * r * squash),
            1,
            1,
        );
    }
    ctx.globalAlpha = 1;
}
export function dots(ctx, x, y, r, colour) {
    ctx.fillStyle = colour;
    for (let i = 0, n = Math.round(r * 2.4) + 8; i < n; i++)
        ctx.fillRect(
            Math.round(x + Math.cos((i / n) * TAU) * r),
            Math.round(y + Math.sin((i / n) * TAU) * r),
            1,
            1,
        );
}
export function whiteFlash(d, since, ms = 130, strength = 0.6) {
    const a = d.age - since;
    if (d.reduced || a < 0 || a > ms) return;
    d.ctx.fillStyle = `rgba(255,248,230,${(strength * (1 - a / ms)).toFixed(2)})`;
    d.ctx.fillRect(0, 0, 480, 270);
}
export function dim(d, alpha) {
    if (alpha <= 0) return;
    d.ctx.fillStyle = `rgba(4,2,12,${alpha.toFixed(2)})`;
    d.ctx.fillRect(0, 0, 480, 270);
}
// Pieces of the boss's own sprite thrown outward from `since`.
export function rubble(d, x, y, since, { speed = 1, life = 1500, count = 10 } = {}) {
    const a = d.age - since;
    if (a < 0 || a > life) return;
    const list = d.art.rubble(d.kind),
        ctx = d.ctx,
        t = a / life;
    for (let i = 0; i < count && list.length; i++) {
        const chunk = list[i % list.length],
            angle = hash(i * 3.1 + d.kind) * TAU,
            run = ease(clamp01(t * 1.4)) * (60 + hash(i + 5) * 120) * speed * 1.3;
        const lean = Math.hypot(chunk.dx, chunk.dy) || 1;
        const px = x + chunk.dx * 0.6 + ((chunk.dx / lean) * 0.7 + Math.cos(angle) * 0.5) * run;
        const py =
            y +
            chunk.dy * 0.6 +
            ((chunk.dy / lean) * 0.7 + Math.sin(angle) * 0.5) * run * 0.85 +
            t * t * 22;
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 0.55) / 0.45);
        ctx.drawImage(
            chunk.canvas,
            snap4(px - chunk.canvas.width / 2),
            snap4(py - chunk.canvas.height / 2),
        );
    }
    ctx.globalAlpha = 1;
}
export function embers(
    d,
    x,
    y,
    since,
    {
        count = 48,
        life = 1300,
        spread = 220,
        colours = ['#ff8a2a', '#ffd060', '#fff0b0', '#e84a1c'],
    } = {},
) {
    const ctx = d.ctx;
    for (let i = 0; i < count; i++) {
        const a = d.age - since - hash(i + 40) * 500;
        if (a < 0 || a > life) continue;
        const vx = (hash(i + 7) - 0.5) * 0.12,
            vy = -0.09 - hash(i + 11) * 0.08;
        const px = x + (hash(i) - 0.5) * spread * 0.5 + vx * a,
            py = y + (hash(i + 9) - 0.5) * 80 + vy * a + 0.00022 * a * a;
        ctx.globalAlpha = Math.min(1, (life - a) / 350);
        ctx.fillStyle = colours[i % colours.length];
        const size = hash(i + 3) > 0.7 ? 8 : 4;
        ctx.fillRect(snap4(px), snap4(py), size, size);
    }
    ctx.globalAlpha = 1;
}
let scratch = null;
export function dissolved(d, sheet, key, x, y, p, opts = {}) {
    // Draw the sprite into a scratch canvas, knock out 4 px blocks as p rises, then blit.
    if (!scratch) {
        scratch = document.createElement('canvas');
        scratch.width = 340;
        scratch.height = 340;
    }
    const s = scratch.getContext('2d');
    s.clearRect(0, 0, 340, 340);
    s.imageSmoothingEnabled = false;
    d.art.drawFx(s, sheet, key, 170, 170, opts);
    for (let by = 0; by < 340; by += BLOCK)
        for (let bx = 0; bx < 340; bx += BLOCK)
            if (hash(bx * 0.37 + by * 0.91 + d.kind) < p) s.clearRect(bx, by, BLOCK, BLOCK);
    d.ctx.drawImage(scratch, Math.round(x) - 170, Math.round(y) - 170);
}
export function bubbles(
    d,
    x,
    y,
    { count = 36, start = 0, span = 1600, life = 1400, spread = [180, 220] } = {},
) {
    for (let i = 0; i < count; i++) {
        const a = d.age - start - (i * span) / count;
        if (a < 0 || a > life) continue;
        const bx = x + (hash(i) - 0.5) * spread[0] + Math.sin(a * 0.004 + i) * 10,
            by = y + (hash(i + 3) - 0.5) * spread[1] - a * (0.05 + 0.06 * hash(i + 5));
        const s = 0.35 + 0.55 * hash(i + 8);
        d.art.drawFx(d.ctx, 'shots', 'bubble', bx, by, {
            sx: s,
            sy: s,
            alpha: Math.min(0.95, (life - a) / 300),
        });
    }
}
export function pops(d, x, y, from, to, spread = [160, 200]) {
    if (d.age < from || d.age > to) return;
    const n = Math.floor((d.age - from) / 90);
    for (let k = Math.max(0, n - 3); k <= n; k++) {
        const frame = Math.min(2, Math.floor((d.age - from - k * 90) / 70));
        if (frame < 0) continue;
        d.art.drawFx(
            d.ctx,
            'shots',
            `pop-${frame}`,
            x + (hash(k * 5.3 + d.kind) - 0.5) * spread[0],
            y + (hash(k * 7.1) - 0.5) * spread[1],
        );
    }
}
