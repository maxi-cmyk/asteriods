import { pixelGlow as glow } from '../render/fx.mjs';
import { HAZARD } from './scene.mjs';
import { TAU, COLOUR, px, dotted, dottedRing, dottedArc, band, disc } from './draw-kit.mjs';

// Hazards and their telegraphs. Telegraph language: dashed amber line = lane or beam,
// pulsing pink ring = area landing, dotted arc = spread, thin red line = aimed shot,
// white flash = damage (never a danger cue). Each painter takes the hazard `h` and
// `m = { warning, urgency, blink, time }`: warning is true while only the telegraph shows.

// Drawn under the boss body; the rest draw over it.
export const BELOW_BODY = new Set([
    HAZARD.pool,
    HAZARD.burn,
    HAZARD.tell,
    HAZARD.arc,
    HAZARD.aim,
    HAZARD.pull,
]);

export const HAZARD_PAINTERS = {
    [HAZARD.lane](ctx, h, { warning, blink }) {
        const half = h.c,
            x = h.x,
            y = h.y;
        if (warning) {
            dotted(ctx, x, y, h.a, h.b, blink ? COLOUR.white : COLOUR.amber, 9, 2);
            const ox = -Math.sin(h.a) * half,
                oy = Math.cos(h.a) * half;
            dotted(ctx, x + ox, y + oy, h.a, h.b, COLOUR.warn, 12);
            dotted(ctx, x - ox, y - oy, h.a, h.b, COLOUR.warn, 12);
        } else {
            band(ctx, x, y, h.a, h.b, half * 2, COLOUR.hot);
            band(ctx, x, y, h.a, h.b, Math.max(2, half * 0.45), COLOUR.white);
        }
    },
    // Scorched ground. Marked first by a dotted orange ring (a shot-down lob's landing), then a
    // charred patch with embers that flicker and a thin lick of flame; it dims as it dies down.
    [HAZARD.burn](ctx, h, { warning, time }) {
        const r = h.c;
        if (warning) {
            dottedRing(
                ctx,
                h.x,
                h.y,
                r,
                Math.floor(time / 110) % 2 ? COLOUR.white : COLOUR.hot,
                Math.round(r * 2.4),
                -time / 600,
            );
            return;
        }
        const fade = h.live < 1200 && Math.floor(time / 120) % 2 ? 0.45 : 1;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#1c0b08';
        disc(ctx, h.x, h.y, r);
        ctx.fillStyle = '#4a1a0a';
        disc(ctx, h.x, h.y, r - 3);
        for (let i = 0; i < r * 2.6; i++) {
            const a = i * 2.399 + Math.floor(time / 160) * 0.7,
                d = (((i * 37) % 100) / 100) * (r - 4);
            ctx.fillStyle = i % 3 ? '#ff7a1c' : '#ffd27a';
            px(ctx, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d);
        }
        dottedRing(ctx, h.x, h.y, r, '#c4501a', Math.round(r * 2.6), time / 900);
        // A lick of flame rising from the middle.
        ctx.fillStyle = '#ff9a2a';
        const lift = 3 + (Math.floor(time / 90) % 3);
        px(ctx, h.x - 1, h.y - lift, 2, lift);
        ctx.fillStyle = '#ffe27a';
        px(ctx, h.x, h.y - lift - 1, 1, 2);
        ctx.restore();
    },
    [HAZARD.pool](ctx, h, { warning, urgency, time }) {
        const r = h.c;
        if (warning) {
            // A pulsing pink ring on the floor, tightening as the plasma arrives.
            const wobble = 1 + 0.08 * Math.sin(time / 80);
            dottedRing(
                ctx,
                h.x,
                h.y,
                r * wobble + 3 * (1 - urgency),
                Math.floor(time / 90) % 2 ? COLOUR.white : COLOUR.pink,
                Math.round(r * 2.4),
                time / 700,
            );
            dottedRing(ctx, h.x, h.y, r * 0.55, COLOUR.pink, 18, -time / 500);
            return;
        }
        ctx.fillStyle = '#7a1604';
        disc(ctx, h.x, h.y, r);
        ctx.fillStyle = '#d83a0c';
        disc(ctx, h.x, h.y, r - 3);
        ctx.fillStyle = '#ff8a1c';
        for (let dy = -r + 4; dy <= r - 4; dy += 2)
            for (let dx = -r + 4; dx <= r - 4; dx += 2) {
                if (
                    dx * dx + dy * dy < (r - 5) ** 2 &&
                    ((dx + dy + Math.floor(time / 120)) / 2) % 2 === 0
                )
                    px(ctx, h.x + dx, h.y + dy);
            }
        ctx.fillStyle = '#ffe27a';
        disc(ctx, h.x - 2, h.y - 2, 4);
        glow(ctx, h.x, h.y, r + 10, '255,100,40', 0.3);
    },
    [HAZARD.beam](ctx, h, { warning, blink }) {
        if (warning) {
            // The whole wedge is dotted, with the opening edge dashed amber.
            dotted(ctx, h.x, h.y, h.c, 420, blink ? COLOUR.white : COLOUR.amber, 8, 2);
            dotted(ctx, h.x, h.y, h.e, 420, COLOUR.warn, 10);
            dottedArc(ctx, h.x, h.y, 150, h.c, h.e, COLOUR.warn, 6);
            dottedArc(ctx, h.x, h.y, 260, h.c, h.e, COLOUR.warn, 8);
            return;
        }
        dotted(ctx, h.x, h.y, h.e, 420, COLOUR.warn, 14);
        band(ctx, h.x, h.y, h.a, 520, 10, '#8a60e8');
        band(ctx, h.x, h.y, h.a, 520, 6, '#d8c4ff');
        band(ctx, h.x, h.y, h.a, 520, 2, '#ffffff');
    },
    [HAZARD.ring](ctx, h, { warning }) {
        const gap = { a: h.a, half: h.c };
        if (warning) {
            dottedRing(
                ctx,
                h.x,
                h.y,
                Math.max(8, h.b),
                '#b04a5a',
                Math.round(h.b * 1.1) + 12,
                0,
                gap,
            );
            // Mark the gap with two short ticks.
            for (const side of [-1, 1]) {
                const a = h.a + side * h.c;
                dotted(
                    ctx,
                    h.x + Math.cos(a) * (h.b - 8),
                    h.y + Math.sin(a) * (h.b - 8),
                    a,
                    16,
                    COLOUR.white,
                    3,
                );
            }
            return;
        }
        const dots = 40;
        for (let i = 0; i < dots; i++) {
            const a = h.a + h.c + (i / dots) * (TAU - h.c * 2);
            const X = h.x + Math.cos(a) * h.b,
                Y = h.y + Math.sin(a) * h.b;
            if (X < -6 || X > 486 || Y < -6 || Y > 276) continue;
            ctx.fillStyle = '#2a0c24';
            px(ctx, X - 2, Y - 2, 5, 5);
            ctx.fillStyle = '#ff7a8a';
            px(ctx, X - 1, Y - 1, 3, 3);
            ctx.fillStyle = '#fff0e0';
            px(ctx, X - 1, Y - 1, 1, 1);
        }
        // A crisp ring line ties the dots together.
        dottedRing(ctx, h.x, h.y, h.b, '#7a2a50', Math.round(h.b * 2), 0, gap);
    },
    [HAZARD.arm](ctx, h, { warning, blink }) {
        if (warning) {
            dottedArc(ctx, h.x, h.y, h.b, h.c, h.e, blink ? COLOUR.white : COLOUR.pink, 5);
            dotted(ctx, h.x, h.y, h.c, h.b, COLOUR.warn, 8);
            dotted(ctx, h.x, h.y, h.e, h.b, COLOUR.warn, 8);
            return;
        }
        band(ctx, h.x, h.y, h.a, h.b, 10, '#6a1858');
        band(ctx, h.x, h.y, h.a, h.b, 6, '#f060cc');
        band(ctx, h.x, h.y, h.a, h.b * 0.96, 2, '#ffd8f4');
        const tx = h.x + Math.cos(h.a) * h.b,
            ty = h.y + Math.sin(h.a) * h.b;
        ctx.fillStyle = '#ffa0e8';
        disc(ctx, tx, ty, 5);
        glow(ctx, tx, ty, 14, '255,100,220', 0.5);
    },
    // An area about to land.
    [HAZARD.tell](ctx, h, { blink, time }) {
        const r = h.b * (1 - 0.1 * Math.sin(time / 70));
        dottedRing(
            ctx,
            h.x,
            h.y,
            r,
            blink ? COLOUR.white : COLOUR.pink,
            Math.round(r * 1.2),
            time / 900,
        );
    },
    // A spread: the centre line and the two edges.
    [HAZARD.arc](ctx, h) {
        for (const side of [-1, 0, 1])
            dotted(ctx, h.x, h.y, h.a + side * h.b, h.c, side ? COLOUR.warn : COLOUR.amber, 7);
    },
    // An aimed shot.
    [HAZARD.aim](ctx, h, { blink }) {
        dotted(ctx, h.x, h.y, h.a, h.b, blink ? COLOUR.white : COLOUR.aim, 4);
    },
    // A gravity well drawing the ship in.
    [HAZARD.pull](ctx, h, { time }) {
        const pulse = (time / 14) % 90;
        for (let k = 0; k < 3; k++)
            dottedRing(ctx, h.x, h.y, 150 - ((pulse + k * 30) % 90) * 1.6, '#a88cff', 36, k);
    },
};
