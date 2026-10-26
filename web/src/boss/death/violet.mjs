// Death sequences for the violet region's boss and mini-boss.
import { blockDisc, ease, hash } from '../../render/fx.mjs';
import { bossParts } from '../scene.mjs';
import { TAU, clamp01, snap4, shake, flicker, rays, ring, dots, whiteFlash, body } from './fx.mjs';

export const SCRIPTS = {
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
};
