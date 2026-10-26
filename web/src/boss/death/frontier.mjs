// Death sequences for the frontier region's boss and mini-boss.
import { blockDisc, ease, pixelGlow } from '../../render/fx.mjs';
import {
    clamp01,
    snap4,
    FIRE,
    shake,
    flicker,
    fireball,
    rays,
    whiteFlash,
    rubble,
    body,
} from './fx.mjs';

export const SCRIPTS = {
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
};
