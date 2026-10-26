// Death sequences for the lunar region's boss and mini-boss.
import { blockDisc, ease } from '../../render/fx.mjs';
import { clamp01, flicker, ring, dissolved, bubbles, pops, body } from './fx.mjs';

export const SCRIPTS = {
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
};
