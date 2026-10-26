// Death sequences for the ember region's boss and mini-boss.
import { ease, hash, pixelGlow } from '../../render/fx.mjs';
import { bossParts } from '../scene.mjs';
import {
    TAU,
    clamp01,
    snap4,
    FIRE,
    shake,
    flicker,
    fireball,
    rays,
    whiteFlash,
    rubble,
    embers,
    body,
} from './fx.mjs';

export const SCRIPTS = {
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
};
