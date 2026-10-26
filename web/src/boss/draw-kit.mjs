// Small pixel-drawing primitives shared by the boss painters: dotted lines, rings and arcs
// (telegraphs are dotted so they never read as solid hazards), rotated bands and discs.
export const TAU = Math.PI * 2;
export const COLOUR = {
    amber: '#efb963',
    warn: '#b07448',
    hot: '#ff9370',
    white: '#fff0c8',
    pink: '#ff5aa0',
    aim: '#ff5a5a',
    void: '#b49cff',
};

export const px = (ctx, x, y, w = 1, h = 1) => ctx.fillRect(Math.round(x), Math.round(y), w, h);

const offscreen = (X, Y) => X < -4 || X > 484 || Y < -4 || Y > 274;

export function dotted(ctx, x, y, angle, length, colour, gap = 4, size = 1, from = 0) {
    ctx.fillStyle = colour;
    const cx = Math.cos(angle),
        cy = Math.sin(angle);
    for (let d = from; d < length; d += gap) {
        const X = x + cx * d,
            Y = y + cy * d;
        if (offscreen(X, Y)) continue;
        px(ctx, X, Y, size, size);
    }
}

// `skip` leaves a gap { a, half } in the ring.
export function dottedRing(ctx, x, y, radius, colour, dots = 48, phase = 0, skip = null) {
    ctx.fillStyle = colour;
    for (let i = 0; i < dots; i++) {
        const a = phase + (i / dots) * TAU;
        if (skip && Math.abs(Math.atan2(Math.sin(a - skip.a), Math.cos(a - skip.a))) < skip.half)
            continue;
        const X = x + Math.cos(a) * radius,
            Y = y + Math.sin(a) * radius;
        if (offscreen(X, Y)) continue;
        px(ctx, X, Y);
    }
}

export function dottedArc(ctx, x, y, radius, a0, a1, colour, gap = 5) {
    ctx.fillStyle = colour;
    const steps = Math.max(8, Math.floor((Math.abs(a1 - a0) * radius) / gap));
    for (let i = 0; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps;
        px(ctx, x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
}

export function dottedOrbit(ctx, cx, cy, ia, ib, rot, colour) {
    ctx.fillStyle = colour;
    const cr = Math.cos(rot),
        sr = Math.sin(rot);
    for (let j = 0; j < 120; j += 1) {
        const t = (j / 120) * TAU,
            ex = ia * Math.cos(t),
            ey = ib * Math.sin(t);
        px(ctx, cx + ex * cr - ey * sr, cy + ex * sr + ey * cr);
    }
}

// A filled rectangle from (x, y) along `angle`.
export function band(ctx, x, y, angle, length, width, colour) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.fillStyle = colour;
    ctx.fillRect(0, -Math.round(width / 2), Math.round(length), Math.round(width));
    ctx.restore();
}

// A filled blocky disc in the current fill style.
export function disc(ctx, cx, cy, r) {
    const radius = Math.max(1, Math.round(r));
    for (let dy = -radius; dy <= radius; dy++) {
        const half = Math.floor(Math.sqrt(radius * radius - dy * dy + 0.5));
        ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
    }
}
