// One painter per region: its sky, nebulae, stars and scenery.
import { WIDTH, HEIGHT } from '../constants.mjs';
import { rand, hex, ramp, Raster } from './raster.mjs';
import { starLayer, tile, S_ORBITS, drawWorld } from './scenery.mjs';

// Each builder returns { base, stars:[far, near], paint(ctx, time, motion, extra) }.
// `motion` is 0 for reduced motion, otherwise 1.
export const BUILDERS = {
    frontier(worlds) {
        const r = new Raster(),
            bg = new Raster();
        bg.gradient(ramp(['#09061c', '#1a0c3a', '#4a185c', '#96346a']));
        bg.nebula(101, [70, 20, 120], { threshold: 0.42, gain: 2.4, strength: 0.8 });
        bg.nebula(102, [20, 70, 130], {
            threshold: 0.5,
            gain: 2.8,
            strength: 0.6,
            scale: 40,
            side: 'right',
        });
        bg.bloom(40, 18, 210, [255, 150, 90], 0.35);
        // A storm giant fills the lower right, cropped by the ridge; a cratered moon hangs upper left.
        r.hills(
            252,
            8,
            [
                [3, 1, 0.4],
                [7, 0.5, 1.3],
                [13, 0.25, 2.1],
            ],
            hex('#04030f'),
            hex('#8a3a58'),
        );
        const base = r.toCanvas(),
            back = bg.toCanvas();
        const stars = [
            starLayer(11, 70, ramp(['#3a2c68', '#5a4c98'])),
            starLayer(12, 46, ramp(['#8a98c8', '#e0d8f0']), 8),
        ];
        return {
            back,
            base,
            stars,
            paint(ctx, t, m) {
                drawWorld(ctx, worlds, 'storm-giant', 398, 222, t, m, { period: 240000 });
                drawWorld(ctx, worlds, 'moon-small', 82, 74, t, m, { period: 170000, phase: 0.3 });
                drawWorld(ctx, worlds, 'moon-tiny', 304, 46, t, m, { period: 130000, phase: 0.6 });
                ctx.drawImage(base, 0, 0);
            },
        };
    },
    violet(worlds) {
        const bg = new Raster();
        bg.gradient(ramp(['#08051a', '#140a30', '#2c1248', '#5a2060']));
        bg.nebula(111, [90, 30, 130], { threshold: 0.4, gain: 2.2, strength: 0.8 });
        bg.nebula(112, [30, 60, 150], {
            threshold: 0.5,
            gain: 2.6,
            strength: 0.55,
            scale: 44,
            side: 'right',
        });
        bg.bloom(30, 14, 200, [255, 140, 100], 0.25);
        const back = bg.toCanvas();
        const stars = [
            starLayer(21, 60, ramp(['#2a2650', '#463e78'])),
            starLayer(22, 40, ramp(['#8a7ec0', '#d0c4f0']), 6),
        ];
        return {
            back,
            stars,
            paint(ctx, t, m) {
                drawWorld(ctx, worlds, 'ice-giant', 352, 168, t, m, { period: 260000 });
                drawWorld(ctx, worlds, 'ice-moon', 120, 70, t, m, { period: 150000, phase: 0.4 });
            },
        };
    },
    ember(worlds) {
        const r = new Raster(),
            bg = new Raster();
        bg.gradient(ramp(['#1c0a1a', '#3a1424', '#6a2430', '#8c3a3c']));
        bg.nebula(121, [120, 40, 60], { threshold: 0.42, gain: 2.2, strength: 0.7 });
        bg.bloom(30, 14, 220, [255, 170, 110], 0.3);
        const base = r.toCanvas(),
            back = bg.toCanvas();
        const far = new Raster();
        far.hills(
            236,
            12,
            [
                [2, 1, 0.6],
                [5, 0.55, 1.4],
                [9, 0.3, 2.6],
            ],
            hex('#4a1c34'),
            hex('#7a3050'),
        );
        const near = new Raster();
        near.hills(
            258,
            9,
            [
                [3, 1, 2.2],
                [7, 0.5, 0.5],
                [11, 0.3, 1.7],
            ],
            hex('#2e1228'),
            hex('#5a2442'),
        );
        const farLayer = far.toCanvas(),
            nearLayer = near.toCanvas();
        const stars = [
            starLayer(31, 40, ramp(['#6a3050', '#90506a'])),
            starLayer(32, 24, ramp(['#e0a8a0', '#f4d0c0']), 6),
        ];
        return {
            back,
            base,
            stars,
            paint(ctx, t, m) {
                ctx.drawImage(base, 0, 0);
                drawWorld(ctx, worlds, 'lava-world', 122, 100, t, m, { period: 200000 });
                drawWorld(ctx, worlds, 'hot-jupiter', 408, 62, t, m, {
                    period: 140000,
                    phase: 0.2,
                });
                tile(ctx, farLayer, m ? t * 0.003 : 0);
                tile(ctx, nearLayer, m ? t * 0.006 : 0);
            },
        };
    },
    ruins(worlds) {
        const r = new Raster(),
            bg = new Raster();
        bg.gradient(ramp(['#080c1c', '#10162e', '#1c2442', '#2c3656']));
        bg.nebula(131, [40, 56, 110], { threshold: 0.44, gain: 2.2, strength: 0.7 });
        bg.bloom(40, 14, 200, [220, 190, 170], 0.2);
        // Ruined skyline: tall at the edges, low in the middle, windows mostly dark.
        const next = rand(41);
        for (let x = 0; x < WIDTH; ) {
            const width = 8 + Math.floor(next() * 14),
                edge = Math.min(x, WIDTH - x) / 150;
            const height = Math.round(
                8 + (1 - Math.min(1, edge)) * (30 + next() * 28) + next() * 6,
            );
            const top = HEIGHT - height;
            r.rect(x, top, width - 1, height, hex('#070a16'));
            if (next() > 0.45) r.rect(x + 2, top - 3, 3, 3, hex('#070a16'));
            for (let wy = top + 4; wy < HEIGHT - 4; wy += 6)
                for (let wx = x + 2; wx < x + width - 3; wx += 4) {
                    if (next() > 0.93) r.rect(wx, wy, 2, 2, hex('#7a6a4a'));
                }
            x += width;
        }
        const base = r.toCanvas(),
            back = bg.toCanvas();
        const stars = [
            starLayer(42, 52, ramp(['#242c4a', '#3c4a70'])),
            starLayer(43, 30, ramp(['#8ea0c0', '#d0d8e8']), 6),
        ];
        return {
            back,
            base,
            stars,
            paint(ctx, t, m) {
                drawWorld(ctx, worlds, 'moon-large', 338, 104, t, m, { period: 300000 });
                ctx.drawImage(base, 0, 0);
            },
        };
    },
    lunar(worlds) {
        const r = new Raster(),
            bg = new Raster();
        bg.gradient(ramp(['#050c20', '#0a1a3c', '#123058', '#1a4470']));
        bg.nebula(141, [20, 90, 130], { threshold: 0.42, gain: 2.4, strength: 0.7 });
        bg.bloom(40, 14, 200, [160, 220, 255], 0.22);
        const base = r.toCanvas(),
            back = bg.toCanvas();
        const stars = [
            starLayer(51, 90, ramp(['#1c3458', '#2c4c78'])),
            starLayer(52, 56, ramp(['#6a9ac4', '#c0e0f0']), 6),
        ];
        return {
            back,
            base,
            stars,
            paint(ctx, t, m) {
                drawWorld(ctx, worlds, 'ocean-world', 128, 98, t, m, { period: 210000 });
                drawWorld(ctx, worlds, 'ice-moon', 356, 172, t, m, { period: 160000, phase: 0.5 });
                drawWorld(ctx, worlds, 'moon-tiny', 430, 52, t, m, { period: 120000, phase: 0.1 });
            },
        };
    },
    rift(worlds) {
        const cx = 318,
            cy = 132;
        const bg = new Raster();
        bg.gradient(ramp(['#030208', '#080414', '#100a22']));
        bg.nebula(151, [70, 24, 90], { threshold: 0.45, gain: 2.2, strength: 0.55, side: 'all' });
        const back = bg.toCanvas();
        const stars = [
            starLayer(62, 44, ramp(['#2a1e48', '#443468'])),
            starLayer(63, 26, ramp(['#8a7cc0', '#d8d0f0']), 6),
        ];
        // Sagittarius A*: a lopsided ring around a black shadow. Four stars circle it,
        // each taking minutes per orbit, and the image itself is static.
        return {
            back,
            stars,
            paint(ctx, t, m) {
                drawWorld(ctx, worlds, 'sgr-a', cx, cy, t, 0);
                for (const [ia, ib, rot, colour] of S_ORBITS) {
                    const angle = rot + (m ? (t / 1000 / 300) * Math.PI * 2 * (60 / ia) ** 1.5 : 0);
                    const co = Math.cos(rot),
                        so = Math.sin(rot);
                    const x = cx + ia * Math.cos(angle) * co - ib * Math.sin(angle) * so,
                        y = cy + ia * Math.cos(angle) * so + ib * Math.sin(angle) * co;
                    ctx.fillStyle = colour;
                    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
                }
            },
        };
    },
};
