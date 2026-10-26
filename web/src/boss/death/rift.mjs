// Death sequences for the rift region's boss and mini-boss.
import { blockDisc, ease } from '../../render/fx.mjs';
import { bossParts } from '../scene.mjs';
import {
    TAU,
    clamp01,
    VIOLET,
    shake,
    flicker,
    fireball,
    rays,
    ring,
    whiteFlash,
    dim,
    body,
} from './fx.mjs';

export const SCRIPTS = {
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
