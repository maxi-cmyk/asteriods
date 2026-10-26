// Death sequences for the ruins region's boss and mini-boss.
import { blockDisc, ease, hash } from '../../render/fx.mjs';
import { clamp01, FIRE, shake, flicker, fireball, rays, whiteFlash, rubble } from './fx.mjs';

export const SCRIPTS = {
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
};
