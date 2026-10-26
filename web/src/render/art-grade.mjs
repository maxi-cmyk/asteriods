// Re-lights the stock sprite atlas at load time: rocks get a warm sun-side rim
// and cool violet shadows, the ship is lifted slightly so it reads against
// busy backgrounds. The PNG on disk stays untouched, so the grey original
// remains the single source of truth for shape and animation.
// Light comes from the upper left, matching backgrounds.mjs.
const ROCK_RAMP = [
    [0, [14, 8, 34]],
    [0.3, [50, 28, 78]],
    [0.55, [116, 72, 112]],
    [0.78, [214, 150, 128]],
    [1, [255, 230, 190]],
];
const RIM = [255, 200, 150];

const ramp = (t) => {
    t = Math.max(0, Math.min(1, t));
    for (let i = 1; i < ROCK_RAMP.length; i++) {
        const [p1, c1] = ROCK_RAMP[i];
        if (t <= p1) {
            const [p0, c0] = ROCK_RAMP[i - 1],
                u = (t - p0) / (p1 - p0);
            return [
                c0[0] + (c1[0] - c0[0]) * u,
                c0[1] + (c1[1] - c0[1]) * u,
                c0[2] + (c1[2] - c0[2]) * u,
            ];
        }
    }
    return ROCK_RAMP.at(-1)[1];
};

function relightRock(ctx, { x, y, w, h }) {
    const image = ctx.getImageData(x, y, w, h),
        d = image.data;
    const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 0;
    const out = new Uint8ClampedArray(d.length);
    for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
            const at = (j * w + i) * 4;
            if (!d[at + 3]) continue;
            const lum = (d[at] * 0.3 + d[at + 1] * 0.59 + d[at + 2] * 0.11) / 255;
            const side = -((i / w - 0.5) * 0.75 + (j / h - 0.5) * 0.65) * 1.6;
            // Four steps keep the pixel-art banding the atlas already has.
            const t =
                Math.round(Math.max(0, Math.min(1, lum * 1.15 + side * 0.55 - 0.05)) * 11) / 11;
            let [r, g, b] = ramp(t);
            const shade = Math.max(0, -side);
            r += shade * 3.6;
            g += shade * 12;
            b += shade * 31;
            // Sun-facing silhouette edge catches a warm rim.
            if (!solid(i - 1, j) || !solid(i, j - 1)) {
                r = r * 0.5 + RIM[0] * 0.6;
                g = g * 0.5 + RIM[1] * 0.6;
                b = b * 0.5 + RIM[2] * 0.6;
            }
            out[at] = r;
            out[at + 1] = g;
            out[at + 2] = b;
            out[at + 3] = d[at + 3];
        }
    d.set(out);
    ctx.putImageData(image, x, y);
}

function liftShip(ctx, { x, y, w, h }) {
    const image = ctx.getImageData(x, y, w, h),
        d = image.data;
    for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        d[i] = d[i] * 1.2 + 14;
        d[i + 1] = d[i + 1] * 1.2 + 14;
        d[i + 2] = d[i + 2] * 1.2 + 18;
    }
    ctx.putImageData(image, x, y);
}

export function gradeAtlas(atlas, sprites) {
    const canvas = document.createElement('canvas');
    canvas.width = atlas.width;
    canvas.height = atlas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas, 0, 0);
    for (const [name, cell] of Object.entries(sprites)) {
        if (name.startsWith('rock-')) relightRock(ctx, cell);
        else if (name === 'ship' || name.startsWith('ship-aim-')) liftShip(ctx, cell);
        // Hangar hulls are authored bright, so they skip the lift.
    }
    return canvas;
}
