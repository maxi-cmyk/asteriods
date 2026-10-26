// A death sequence of its own for every boss and mini-boss. Each one plays from a
// frozen copy of the last frame the boss was alive (`snap`), so it can reuse the
// live sprites, layers and sub-targets. All of it is presentation: a pure function
// of the snapshot and the age in visual milliseconds, so pausing freezes it.
//
//   Sentinel      plates blast off, the bare eye overloads
//   Ringwarden    blades shear away one by one, the core implodes, then shatters
//   Cinderforge   hatches pop with fire jets, the shell splits on a column of fire, embers rain
//   Bastion       chain explosions walk nose to stern, the hull breaks in two
//   Tidecaller    the bell deflates and dissolves into bubbles
//   Warden        everything is pulled into a point, a silence, then rings of light
//   Picket        splits top and bottom      Shardling   blades spin off, core pops
//   Cinderling    cracks and vents fire      Gunnery     bursts along the hull, snaps in two
//   Moonjelly     dissolves in bubbles       Lens Imp    flickers out, collapses to a point
import { BLOCK, blockDisc, ease, hash, pixelGlow } from './fx.mjs';
import { KINDS, bossParts, bossState } from './boss-scene.mjs';

export const DEATH_MS = [2400, 2400, 2800, 3000, 2600, 3000, 1500, 1500, 1700, 1700, 1500, 1600];
export const deathMs = (kind) => DEATH_MS[kind] ?? 2000;

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const snap4 = (v) => Math.round(v / BLOCK) * BLOCK;
const FIRE = ['#e8944a', '#ffd9a0', '#fff4dc', '#ffffff'];
const VIOLET = ['#8a5ad8', '#c8a8ff', '#f0e4ff', '#ffffff'];

// ---------------------------------------------------------------- primitives
function shake(d, amount, from = 0, to = Infinity) {
    if (d.reduced || d.age < from || d.age > to) return [0, 0];
    const n = Math.floor(d.age / 50);
    return [snap4((hash(n * 2.1) - 0.5) * amount), snap4((hash(n * 3.7 + 1) - 0.5) * amount)];
}
const flicker = (d, every = 110, from = 0, to = Infinity) =>
    !d.reduced && d.age >= from && d.age <= to && Math.floor(d.age / every) % 2 ? 0.45 : 0;
function fireball(d, x, y, since, scale = 1, colours = FIRE, life = 1500) {
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
function rays(
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
function ring(
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
function dots(ctx, x, y, r, colour) {
    ctx.fillStyle = colour;
    for (let i = 0, n = Math.round(r * 2.4) + 8; i < n; i++)
        ctx.fillRect(
            Math.round(x + Math.cos((i / n) * TAU) * r),
            Math.round(y + Math.sin((i / n) * TAU) * r),
            1,
            1,
        );
}
function whiteFlash(d, since, ms = 130, strength = 0.6) {
    const a = d.age - since;
    if (d.reduced || a < 0 || a > ms) return;
    d.ctx.fillStyle = `rgba(255,248,230,${(strength * (1 - a / ms)).toFixed(2)})`;
    d.ctx.fillRect(0, 0, 480, 270);
}
function dim(d, alpha) {
    if (alpha <= 0) return;
    d.ctx.fillStyle = `rgba(4,2,12,${alpha.toFixed(2)})`;
    d.ctx.fillRect(0, 0, 480, 270);
}
// Pieces of the boss's own sprite thrown outward from `since`.
function rubble(d, x, y, since, { speed = 1, life = 1500, count = 10 } = {}) {
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
function embers(
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
function dissolved(d, sheet, key, x, y, p, opts = {}) {
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
function bubbles(
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
function pops(d, x, y, from, to, spread = [160, 200]) {
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
const body = (d, key, opts = {}) => d.art.drawFx(d.ctx, d.sheet, key, d.x, d.y, opts);

// ---------------------------------------------------------------- the twelve
const SCRIPTS = {
    // 0: the plates blast off and the bare eye overloads.
    0(d) {
        const { x, y, age } = d,
            [sx, sy] = shake(d, 8, 0, 1500);
        if (age < 700) {
            body(d, Math.floor(age / 160) % 2 ? 'sentinel-glow' : 'sentinel-3', {
                dx: sx,
                dy: sy,
                flash: flicker(d, 120, 300),
            });
            pixelGlow(d.ctx, x, y, 110, '255,170,90', 0.1 + (age / 700) * 0.3);
        } else if (age < 1800) {
            body(d, 'sentinel-bare', { dx: sx, dy: sy, flash: flicker(d, 90, 900) });
            for (let k = 0; k < 4; k++) {
                const a = Math.PI / 4 + (k * Math.PI) / 2,
                    run = Math.min(180, (age - 700) * 0.22);
                body(d, `sentinel-plate-${k}`, {
                    dx: Math.cos(a) * run,
                    dy: Math.sin(a) * run + (age - 700) * (age - 700) * 0.00006,
                    rot: (k % 2 ? 1 : -1) * (age - 700) * 0.0007,
                    alpha: 1 - clamp01((age - 1300) / 500),
                });
            }
            for (let k = 0; k < 4; k++)
                fireball(
                    d,
                    x + Math.cos(Math.PI / 4 + (k * Math.PI) / 2) * 50,
                    y + Math.sin(Math.PI / 4 + (k * Math.PI) / 2) * 50,
                    700,
                    0.32,
                    FIRE,
                    500,
                );
            blockDisc(d.ctx, x, y, ease(clamp01((age - 700) / 1100)) * 44, '#ffffff', 5);
        }
        whiteFlash(d, 1650);
        rays(d, x, y, 1650);
        fireball(d, x, y, 1650, 1.2, FIRE, 1500);
        rubble(d, x, y, 1700);
    },

    // 1: blades shear away one by one, the core implodes, then shatters.
    1(d) {
        const { x, y, age } = d,
            [sx, sy] = shake(d, 6, 0, 900);
        const blades = bossParts(d.snap).filter((p) => p.kind === 0);
        const scale = d.state.aux[0] || 1;
        if (age < 900) {
            d.ctx.globalAlpha = 1 - age / 900;
            for (const r of [106 * scale, 70 * scale]) dots(d.ctx, x, y, r, '#a58cff');
            d.ctx.globalAlpha = 1;
        }
        blades.forEach((p, i) => {
            const t0 = 80 + i * 30,
                a = age - t0,
                angle = Math.atan2(p.y - y, p.x - x);
            const k = ((Math.round(angle / (Math.PI / 8)) % 16) + 16) % 16,
                size = p.slot < 16 ? 'outer' : 'inner';
            if (a < 0) d.art.drawFx(d.ctx, 'violet', `blade-${size}-${k}`, p.x + sx, p.y + sy);
            else if (a < 700)
                d.art.drawFx(
                    d.ctx,
                    'violet',
                    `blade-${size}-${k}`,
                    p.x + Math.cos(angle) * a * 0.16,
                    p.y + Math.sin(angle) * a * 0.16,
                    { rot: (i % 2 ? 1 : -1) * a * 0.005, alpha: 1 - a / 700 },
                );
        });
        if (age < 1500) {
            const s = age < 900 ? 1 : 1 - ease((age - 900) / 600) * 0.88;
            body(d, 'ringwarden-core-1', {
                dx: sx,
                dy: sy,
                sx: s,
                sy: s,
                flash: flicker(d, 100, 400),
            });
            if (age > 500)
                body(d, 'ringwarden-d2', {
                    dx: sx,
                    dy: sy,
                    sx: s,
                    sy: s,
                    alpha: clamp01((age - 500) / 300),
                });
            if (age >= 900)
                for (let i = 0; i < 20; i++) {
                    const t = (age - 900) / 600,
                        r = 100 * (1 - ease(t)),
                        a = (i * TAU) / 20 + t * 3;
                    d.ctx.fillStyle = i % 2 ? '#e0f6ff' : '#78a8ff';
                    d.ctx.fillRect(snap4(x + Math.cos(a) * r), snap4(y + Math.sin(a) * r), 4, 4);
                }
        }
        if (age >= 1450 && age < 1600)
            blockDisc(d.ctx, x, y, 8 + (age - 1450) * 0.12, '#ffffff', 3);
        whiteFlash(d, 1500, 110, 0.5);
        ring(d, x, y, 1500, { colour: '#c8e8ff', speed: 0.24, life: 1000 });
        ring(d, x, y, 1580, { colour: '#78a8ff', speed: 0.18, life: 1000 });
        rays(d, x, y, 1500, { colours: ['#a4d4ff', '#ffffff', '#78a8ff'], count: 24 });
        for (let i = 0; i < 14; i++) {
            const a = age - 1500;
            if (a < 0 || a > 1100) continue;
            const angle = hash(i * 2.7) * TAU,
                run = a * (0.1 + hash(i + 4) * 0.14),
                k = ((Math.round(angle / (Math.PI / 8)) % 16) + 16) % 16;
            d.art.drawFx(
                d.ctx,
                'violet',
                `blade-${i % 2 ? 'outer' : 'inner'}-${k}`,
                x + Math.cos(angle) * run,
                y + Math.sin(angle) * run * 0.85 + a * a * 0.00004,
                { rot: a * 0.006 * (i % 2 ? 1 : -1), alpha: 1 - a / 1100 },
            );
        }
        blockDisc(
            d.ctx,
            x,
            y,
            ease(clamp01((age - 1500) / 260)) * 30 * Math.max(0, 1 - (age - 1500) / 700),
            '#e8f6ff',
            6,
        );
    },

    // 2: hatches pop with fire jets, the shell splits on a column of fire, embers rain.
    2(d) {
        const { x, y, age } = d,
            [sx, sy] = shake(d, 4 + age / 200, 0, 1700),
            ctx = d.ctx;
        const panels = bossParts(d.snap).filter((p) => p.kind === 1);
        const whole = age < 900,
            halves = age >= 900 && age < 1750;
        pixelGlow(ctx, x, y, 190, '255,90,30', 0.25 + Math.min(0.4, age / 2000));
        if (whole) {
            body(d, 'forge-2', { dx: sx, dy: sy, flash: flicker(d, 100, 500) });
            body(d, 'forge-d2', { dx: sx, dy: sy, alpha: clamp01(age / 700) });
        } else if (halves) {
            const t = ease(clamp01((age - 900) / 800));
            for (const side of [-1, 1])
                body(d, 'forge-2', {
                    dx: side * t * 44 + sx,
                    dy: sy,
                    rot: side * t * 0.12,
                    clip: side < 0 ? [-170, -170, 170, 340] : [0, -170, 170, 340],
                    flash: flicker(d, 90, 1300),
                });
            const h = 250 * t,
                w = 8 + t * 28;
            for (const [scale, colour] of [
                [1, '#e8944a'],
                [0.62, '#ffd9a0'],
                [0.3, '#ffffff'],
            ]) {
                ctx.fillStyle = colour;
                const ww = snap4(w * scale),
                    hh = snap4(h * (0.6 + scale * 0.4));
                ctx.fillRect(snap4(x - ww / 2), snap4(y - hh / 2), ww, hh);
            }
        }
        panels.forEach((p, i) => {
            const t0 = 120 + i * 90,
                a = age - t0,
                angle = Math.atan2(p.y - y, p.x - x);
            if (a < 0) {
                if (whole) d.art.drawFx(ctx, 'ember', 'panel-0', p.x + sx, p.y + sy);
                return;
            }
            if (a < 160) {
                ctx.fillStyle = '#ffd060';
                for (let k = 0; k < 30; k++)
                    ctx.fillRect(
                        Math.round(p.x + Math.cos(angle) * k * 1.4),
                        Math.round(p.y + Math.sin(angle) * k * 1.4),
                        2,
                        2,
                    );
            }
            if (a < 900) {
                d.art.drawFx(
                    ctx,
                    'ember',
                    `panel-1${Math.floor(a / 90) % 2 ? 'a' : 'b'}`,
                    p.x + Math.cos(angle) * a * 0.2,
                    p.y + Math.sin(angle) * a * 0.2 + a * a * 0.0002,
                    { rot: a * 0.008 * (i % 2 ? 1 : -1), alpha: 1 - a / 900 },
                );
                pixelGlow(
                    ctx,
                    p.x + Math.cos(angle) * a * 0.2,
                    p.y + Math.sin(angle) * a * 0.2,
                    18,
                    '255,150,50',
                    0.5 * (1 - a / 900),
                );
            }
        });
        whiteFlash(d, 1500);
        rays(d, x, y, 1500, { reach: 1.4, colours: ['#ffd060', '#ff8a2a', '#ffffff'] });
        fireball(d, x, y, 1500, 1.5, FIRE, 1700);
        rubble(d, x, y, 1700, { speed: 1.1 });
        embers(d, x, y, 1700);
    },

    // 3: chain explosions walk nose to stern, the hull breaks in two.
    3(d) {
        const { x, y, age } = d,
            [sx, sy] = shake(d, 4 + age / 300, 0, 2300),
            ctx = d.ctx;
        const whole = age < 1500,
            split = age >= 1500 && age < 2500;
        const layers = ['bastion-cannon', 'bastion-pods', 'bastion-mine'];
        const piece = (clip, dx, dy, rot, alpha = 1) => {
            d.art.drawFx(ctx, 'ruins', 'bastion-hull', x, y, {
                dx: dx + sx,
                dy: dy + sy,
                rot,
                clip,
                alpha,
                flash: flicker(d, 100, 900),
            });
            if (d.state.stage >= 2)
                d.art.drawFx(ctx, 'ruins', 'bastion-flare', x, y, {
                    dx: dx + sx,
                    dy: dy + sy,
                    rot,
                    clip,
                    alpha,
                });
        };
        if (whole) {
            piece(null, 0, 0, 0);
            layers.forEach((key, i) => {
                const a = age - 500 - i * 250;
                d.art.drawFx(ctx, 'ruins', key, x, y, {
                    dx: sx + (a > 0 ? a * 0.04 * (i - 1) : 0),
                    dy: sy + (a > 0 ? a * a * 0.0004 : 0),
                    rot: a > 0 ? a * 0.002 * (i - 1) : 0,
                    alpha: a > 0 ? 1 - clamp01(a / 700) : 1,
                });
            });
        } else if (split) {
            const t = ease(clamp01((age - 1500) / 800));
            piece(
                [-170, -110, 210, 220],
                -t * 64,
                t * 44 + (age - 1500) * (age - 1500) * 0.00003,
                -t * 0.36,
                1 - clamp01((age - 2300) / 200),
            );
            piece([40, -110, 140, 220], t * 34, -t * 30, t * 0.22, 1 - clamp01((age - 2300) / 200));
            blockDisc(ctx, x + 40, y, 20 + t * 30, '#ffd9a0', 7);
            blockDisc(ctx, x + 40, y, 10 + t * 18, '#ffffff', 8);
        }
        for (let k = 0; k < 10; k++) {
            const t0 = 100 + k * 140;
            fireball(
                d,
                x - 150 + k * 30 + (hash(k) - 0.5) * 16,
                y + (hash(k + 3) - 0.5) * 40,
                t0,
                0.3 + (k % 3) * 0.1,
                FIRE,
                520,
            );
            if (d.age >= t0 && d.age < t0 + 60) whiteFlash(d, t0, 60, 0.12);
        }
        whiteFlash(d, 2200);
        rays(d, x + 114, y, 2200, { reach: 1.3 });
        fireball(d, x + 114, y, 2200, 1.3, FIRE, 1500);
        rubble(d, x + 60, y, 2200);
    },

    // 4: the bell deflates and dissolves into bubbles.
    4(d) {
        const { x, y, age } = d,
            ctx = d.ctx;
        const s = ease(clamp01(age / 1100)),
            sx = 1 + 0.25 * s,
            sy = 1 - 0.45 * s;
        const opts = { sx, sy, dy: (1 - sy) * 145, flash: flicker(d, 150, 200, 1000) };
        if (age < 1100) body(d, `tide-${Math.floor(age / 220) % 4}-1`, opts);
        else if (age < 2000)
            dissolved(d, d.sheet, 'tide-0-1', x, y + (1 - sy) * 145, (age - 1100) / 900, {
                sx,
                sy,
            });
        bubbles(d, x, y);
        pops(d, x, y, 1100, 2100);
        if (age > 1900) {
            const t = (age - 1900) / 700;
            blockDisc(ctx, x, y + 40, 24 * Math.sin(Math.min(1, t) * Math.PI), '#ffa0e8', 9);
            blockDisc(ctx, x, y + 40, 12 * Math.sin(Math.min(1, t) * Math.PI), '#ffffff', 10);
            ring(d, x, y + 40, 1900, { colour: '#78e8ff', speed: 0.16, life: 700, max: 120 });
            ring(d, x, y + 40, 2000, { colour: '#ffa0e8', speed: 0.12, life: 600, max: 90 });
        }
    },

    // 5: everything is pulled into a point, a silence, then rings of light.
    5(d) {
        const { x, y, age } = d,
            ctx = d.ctx,
            [sx, sy] = shake(d, 6, 0, 1400);
        const pull =
            age < 1300 ? ease(age / 1300) * 0.5 : 0.5 + ease(clamp01((age - 1300) / 400)) * 0.38;
        const s = Math.max(0.04, 1 - pull);
        if (age < 1750)
            body(d, 'warden-1', { dx: sx, dy: sy, sx: s, sy: s, flash: flicker(d, 90, 500, 1300) });
        for (const star of bossParts(d.snap).filter((p) => p.kind === 4)) {
            const t = ease(clamp01(age / 1000));
            if (t >= 1) continue;
            const r0 = Math.hypot(star.x - x, star.y - y),
                a0 = Math.atan2(star.y - y, star.x - x);
            d.art.drawFx(
                ctx,
                'rift',
                `star-${star.slot}`,
                x + Math.cos(a0 + t * 3.2) * r0 * (1 - t),
                y + Math.sin(a0 + t * 3.2) * r0 * (1 - t),
                { alpha: 1 - t * 0.5 },
            );
        }
        if (age < 1750)
            for (let k = 0; k < 3; k++) {
                const r = (150 - k * 36) * (1 - ease(clamp01(age / 1500)));
                ctx.fillStyle = k % 2 ? '#c8a8ff' : '#ffbe6e';
                for (let i = 0, n = Math.round(r * 1.6) + 6; i < n; i++)
                    ctx.fillRect(
                        Math.round(x + Math.cos((i / n) * TAU) * r),
                        Math.round(y + Math.sin((i / n) * TAU) * r),
                        1,
                        1,
                    );
            }
        dim(d, age < 1900 ? clamp01(age / 1500) * 0.55 : 0.55 * (1 - clamp01((age - 1900) / 700)));
        if (age >= 1300 && age < 1900)
            blockDisc(
                ctx,
                x,
                y,
                age < 1750 ? 5 + (age - 1300) * 0.015 : 12,
                '#ffffff',
                11 + Math.floor(age / 120),
            );
        whiteFlash(d, 1900, 160, 0.8);
        for (const [delay, colour, speed] of [
            [0, '#ffffff', 0.3],
            [90, '#ffbe6e', 0.25],
            [190, '#c8a8ff', 0.21],
            [300, '#ff8a4a', 0.17],
        ])
            ring(d, x, y, 1900 + delay, { colour, speed, life: 1000, max: 300, squash: 1 });
        rays(d, x, y, 1900, {
            count: 16,
            reach: 2.6,
            colours: ['#ffbe6e', '#ffffff', '#c8a8ff'],
            life: 800,
        });
        fireball(d, x, y, 1900, 0.8, VIOLET, 800);
        if (age > 2500) {
            ctx.globalAlpha = 1 - clamp01((age - 2500) / 500);
            blockDisc(ctx, x, y, 8, '#04020a', 12);
            ctx.globalAlpha = 1;
        }
    },

    // 6: Picket splits top and bottom with a last flick of its lance.
    6(d) {
        const { x, y, age } = d,
            [sx, sy] = shake(d, 6, 0, 400),
            ctx = d.ctx;
        if (age < 400) body(d, 'picket-2', { dx: sx, dy: sy, flash: flicker(d, 90, 100) });
        else if (age < 1200) {
            const t = ease(clamp01((age - 400) / 600));
            body(d, 'picket-2', {
                dy: -t * 36,
                dx: -t * 18,
                rot: -t * 0.25,
                clip: [-80, -80, 160, 80],
                alpha: 1 - clamp01((age - 1000) / 200),
            });
            body(d, 'picket-2', {
                dy: t * 36,
                dx: -t * 18,
                rot: t * 0.25,
                clip: [-80, 0, 160, 80],
                alpha: 1 - clamp01((age - 1000) / 200),
            });
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(snap4(x - 40 * t - 20), snap4(y - 2), snap4(80 * t + 40), 4);
            ctx.fillStyle = '#ffbe6e';
            ctx.fillRect(
                snap4(x - 60),
                snap4(y - 2),
                snap4(60 * Math.min(1, (age - 400) / 120)),
                4,
            );
        }
        whiteFlash(d, 900, 90, 0.3);
        rays(d, x, y, 900, { count: 18, reach: 0.8 });
        fireball(d, x, y, 900, 0.65, FIRE, 800);
        rubble(d, x, y, 950, { count: 8, speed: 0.7, life: 650 });
    },

    // 7: Shardling's blades spin off in three directions, the core shrinks and pops.
    7(d) {
        const { x, y, age } = d,
            ctx = d.ctx,
            [sx, sy] = shake(d, 4, 0, 500);
        const spin = d.state.aux[2] || 0;
        if (age < 900) {
            const s = age < 400 ? 1 : 1 - ease((age - 400) / 500) * 0.8;
            body(d, 'shardling-1', {
                dx: sx,
                dy: sy,
                sx: s,
                sy: s,
                flash: flicker(d, 90, 100, 800),
            });
        }
        for (let k = 0; k < 3; k++) {
            const a = spin + (k * TAU) / 3,
                run = 46 + Math.max(0, age - 150) * 0.22,
                kk = ((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16;
            if (age < 900)
                d.art.drawFx(
                    ctx,
                    'violet',
                    `blade-inner-${kk}`,
                    x + Math.cos(a) * run,
                    y + Math.sin(a) * run,
                    { rot: age * 0.01 * (k % 2 ? 1 : -1), alpha: 1 - clamp01((age - 600) / 300) },
                );
        }
        if (age >= 880 && age < 1000) blockDisc(ctx, x, y, 8, '#ffffff', 2);
        whiteFlash(d, 900, 80, 0.25);
        ring(d, x, y, 900, { colour: '#c8e8ff', speed: 0.16, life: 600, max: 90 });
        rays(d, x, y, 900, { count: 14, colours: ['#a4d4ff', '#ffffff'], reach: 0.8, life: 500 });
        blockDisc(
            ctx,
            x,
            y,
            ease(clamp01((age - 900) / 180)) * 20 * Math.max(0, 1 - (age - 900) / 500),
            '#e8f6ff',
            3,
        );
    },

    // 8: Cinderling cracks, vents fire from its shell, and bursts into embers.
    8(d) {
        const { x, y, age } = d,
            ctx = d.ctx,
            [sx, sy] = shake(d, 6, 0, 650);
        if (age < 650) {
            body(d, 'cinderling-1', { dx: sx, dy: sy, flash: flicker(d, 90, 200) });
            body(d, 'cinderling-d2', { dx: sx, dy: sy, alpha: clamp01(age / 400) });
            ctx.fillStyle = '#ffd060';
            for (let j = 0; j < 8; j++) {
                if (Math.floor(age / 70 + j) % 3 === 0) continue;
                const a = (j * TAU) / 8 + hash(j) * 0.3;
                for (let k = 0; k < 18; k++)
                    ctx.fillRect(
                        Math.round(x + Math.cos(a) * (54 + k * 1.5)),
                        Math.round(y + Math.sin(a) * (54 + k * 1.5)),
                        2,
                        2,
                    );
            }
        }
        whiteFlash(d, 650, 100, 0.35);
        rays(d, x, y, 650, { reach: 0.9 });
        fireball(d, x, y, 650, 0.85, FIRE, 1000);
        rubble(d, x, y, 700, { count: 7, speed: 0.8, life: 900 });
        embers(d, x, y, 700, { count: 26, spread: 150, life: 950 });
    },

    // 9: Gunnery bursts along the hull, then snaps in two.
    9(d) {
        const { x, y, age } = d,
            ctx = d.ctx,
            [sx, sy] = shake(d, 5, 0, 900);
        const piece = (clip, dx, dy, rot, alpha = 1) =>
            d.art.drawFx(ctx, 'ruins', 'gunnery-1', x, y, {
                dx: dx + sx,
                dy: dy + sy,
                rot,
                clip,
                alpha,
                flash: flicker(d, 100, 150, 700),
            });
        if (age < 800) piece(null, 0, 0, 0);
        else if (age < 1500) {
            const t = ease(clamp01((age - 800) / 600));
            piece(
                [-100, -60, 110, 120],
                -t * 40,
                t * 26,
                -t * 0.3,
                1 - clamp01((age - 1300) / 200),
            );
            piece([10, -60, 100, 120], t * 20, -t * 18, t * 0.18, 1 - clamp01((age - 1300) / 200));
        }
        for (let k = 0; k < 5; k++)
            fireball(
                d,
                x - 80 + k * 38,
                y + (hash(k + 6) - 0.5) * 20,
                100 + k * 120,
                0.26 + (k % 2) * 0.08,
                FIRE,
                450,
            );
        whiteFlash(d, 1100, 80, 0.3);
        rays(d, x + 68, y, 1100, { reach: 0.9, count: 20 });
        fireball(d, x + 68, y, 1100, 0.9, FIRE, 600);
        rubble(d, x, y, 1100, { count: 8, speed: 0.8, life: 600 });
    },

    // 10: Moonjelly dissolves in a stream of bubbles.
    10(d) {
        const { x, y, age } = d;
        const s = ease(clamp01(age / 600)),
            sx = 1 + 0.2 * s,
            sy = 1 - 0.4 * s,
            dy = (1 - sy) * 95;
        if (age < 600)
            body(d, `moonjelly-${Math.floor(age / 200) % 4}`, {
                sx,
                sy,
                dy,
                flash: flicker(d, 130, 100),
            });
        else if (age < 1300)
            dissolved(d, d.sheet, 'moonjelly-0', x, y + dy, (age - 600) / 700, { sx, sy });
        bubbles(d, x, y, { count: 16, span: 900, life: 900, spread: [110, 140] });
        pops(d, x, y, 600, 1300, [100, 130]);
        if (age > 1200) {
            const t = (age - 1200) / 300;
            blockDisc(d.ctx, x, y + 20, 14 * Math.sin(Math.min(1, t) * Math.PI), '#ffa0e8', 3);
            ring(d, x, y + 20, 1200, { colour: '#78e8ff', speed: 0.12, life: 500, max: 70 });
        }
    },

    // 11: Lens Imp flickers out, collapses to a point and rings once.
    11(d) {
        const { x, y, age } = d,
            ctx = d.ctx;
        if (age < 600) {
            if (Math.floor(age / 70) % 2 === 0) body(d, 'lensimp-1', { alpha: 0.9 - age / 900 });
        } else if (age < 1050) {
            const s = Math.max(0.04, 1 - ease((age - 600) / 450) * 0.96);
            body(d, 'lensimp-1', { sx: s, sy: s });
            dim(d, 0.35 * clamp01((age - 600) / 450));
        }
        if (age >= 900 && age < 1100) blockDisc(ctx, x, y, 6, '#ffffff', 5);
        whiteFlash(d, 1100, 100, 0.5);
        ring(d, x, y, 1100, { colour: '#ffffff', speed: 0.24, life: 800, max: 170, squash: 1 });
        ring(d, x, y, 1180, { colour: '#ffbe6e', speed: 0.19, life: 800, max: 130, squash: 1 });
        rays(d, x, y, 1100, { count: 12, reach: 1.4, colours: ['#ffbe6e', '#ffffff'], life: 600 });
        if (age > 1300) {
            ctx.globalAlpha = 1 - clamp01((age - 1300) / 300);
            blockDisc(ctx, x, y, 6, '#04020a', 2);
            ctx.globalAlpha = 1;
        }
    },
};

// Draws one boss's death. `finale` is {x, y, time, kind, snap}; returns false when the
// art for it has not loaded, so the caller can fall back to the plain blast.
export function drawDeath(ctx, art, finale, time, { reduced = false } = {}) {
    const kind = finale.kind,
        info = KINDS[kind],
        script = SCRIPTS[kind];
    if (!script || !finale.snap || !art.ready(info.region)) return false;
    const d = {
        ctx,
        art,
        kind,
        snap: finale.snap,
        state: bossState(finale.snap),
        x: finale.x,
        y: finale.y,
        age: time - finale.time,
        sheet: info.region,
        reduced,
    };
    if (d.age < 0 || d.age > deathMs(kind)) return true;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    script(d);
    ctx.restore();
    return true;
}
