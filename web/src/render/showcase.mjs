// Small animated vignettes for menu screens: a violet sky, a lit planet slice
// and one or two ships idling with exhaust. Pure function of the clock, drawn
// from the same graded atlas the game uses, so menus preview real sprites.
import { hullSprite } from '../state/hangar.mjs';
import { glow } from './fx.mjs';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
};
const SKY = [
    [10, 6, 28],
    [24, 12, 56],
    [60, 22, 88],
    [120, 42, 104],
];
const LIGHT = (() => {
    const x = -0.7,
        y = -0.55,
        z = 0.6,
        n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
})();
const BANDS = [
    [92, 34, 120],
    [168, 70, 150],
    [230, 130, 150],
    [120, 48, 140],
    [70, 28, 110],
];

const cache = new Map();
// Static backdrop: dithered sky gradient, stars, and a banded planet rising
// from the lower right. Built once per size.
function backdrop(width, height, seed) {
    const key = `${width}x${height}:${seed}`;
    let canvas = cache.get(key);
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d'),
        image = ctx.createImageData(width, height),
        d = image.data;
    const radius = Math.round(height * 0.8),
        cx = Math.round(width * 0.84),
        cy = Math.round(height * 1.02);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const t = (y / (height - 1)) * (SKY.length - 1),
                i = Math.min(SKY.length - 2, Math.floor(t));
            const dither = BAYER[(y & 3) * 4 + (x & 3)] / 16;
            let c = SKY[t - i > dither ? i + 1 : i].slice();
            const dx = (x - cx) / radius,
                dy = (y - cy) / radius,
                d2 = dx * dx + dy * dy;
            if (d2 <= 1) {
                const nz = Math.sqrt(1 - d2),
                    lit = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]);
                const band =
                    (Math.sin((dy + Math.sin(x * 0.09 + y * 0.04) * 0.08) * 9) * 0.5 + 0.5) *
                    (BANDS.length - 1);
                const k = Math.min(BANDS.length - 2, Math.floor(band)),
                    u = band - k;
                const shade = 0.16 + 0.95 * lit ** 0.85,
                    rim =
                        Math.max(0, (d2 - 0.52) / 0.48) ** 2 * Math.min(1, lit * 1.4 + 0.15) * 0.85;
                c = [0, 1, 2].map((ch) => {
                    const v =
                        (BANDS[k][ch] + (BANDS[k + 1][ch] - BANDS[k][ch]) * u) * shade +
                        [255, 150, 120][ch] * rim;
                    return (Math.floor((v / 255) * 13 + dither) / 13) * 255;
                });
            }
            const at = (y * width + x) * 4;
            d[at] = c[0];
            d[at + 1] = c[1];
            d[at + 2] = c[2];
            d[at + 3] = 255;
        }
    ctx.putImageData(image, 0, 0);
    cache.set(key, canvas);
    return canvas;
}

function ship(ctx, art, { hull, x, y, direction = 0, scale = 1 }, time, reduced) {
    const cell = art.sprites[hullSprite(hull, direction)];
    if (!cell) return;
    const angle = (direction * Math.PI) / 8,
        dx = Math.cos(angle),
        dy = Math.sin(angle);
    const tail = 10 * scale,
        flick = reduced ? 1 : 1 + (Math.floor(time / 80) % 3);
    glow(ctx, x - dx * tail * 1.3, y - dy * tail * 1.3, Math.round(13 * scale), '255,130,60', 0.6);
    glow(ctx, x - dx * tail, y - dy * tail, Math.round(6 * scale), '120,220,255', 0.5);
    for (const [colour, length] of [
        ['#9d502e', 8],
        ['#efb963', 5],
        ['#fff5d2', 2.5],
    ]) {
        ctx.fillStyle = colour;
        const steps = Math.round((length + flick) * scale);
        for (let i = 0; i < steps; i++) {
            ctx.fillRect(
                Math.round(x - dx * (tail + i) - scale),
                Math.round(y - dy * (tail + i) - scale),
                Math.max(1, Math.round(scale * (length > 5 ? 3 : length > 3 ? 2 : 1))),
                Math.max(1, Math.round(scale * (length > 5 ? 3 : length > 3 ? 2 : 1))),
            );
        }
    }
    ctx.drawImage(
        art.atlas,
        cell.x,
        cell.y,
        cell.w,
        cell.h,
        Math.round(x - 16 * scale),
        Math.round(y - 16 * scale),
        cell.w * scale,
        cell.h * scale,
    );
}

// `ships`: [{ hull, x, y, direction, scale }] with positions in canvas pixels.
export function drawShowcase(ctx, art, { ships, time = 0, reduced = false, seed = 1 }) {
    const { width, height } = ctx.canvas;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(backdrop(width, height, seed), 0, 0);
    // Twinkling stars over the sky.
    for (let i = 0; i < Math.round((width * height) / 260); i++) {
        const pulse = reduced
            ? 0.8
            : 0.5 + 0.5 * Math.sin((time / 600) * (0.6 + hash(i + 3)) + hash(i + 4) * 6.28);
        ctx.fillStyle = `rgba(230,220,255,${(0.15 + 0.7 * pulse * pulse).toFixed(2)})`;
        ctx.fillRect(Math.floor(hash(i + 1) * width), Math.floor(hash(i + 2) * height * 0.7), 1, 1);
    }
    ships.forEach((s, i) => {
        const bob = reduced ? 0 : Math.sin(time / 700 + i * 2) * 2 * (s.scale || 1);
        ship(ctx, art, { ...s, y: s.y + bob }, time, reduced);
    });
}
