// Draws the boss layer: body sprites by kind, sub-targets, hostile shots, hazards
// and their telegraphs. Everything is a pure function of the scene and the visual
// clock, so pausing freezes it. Telegraph language (nextSteps.md): dashed amber
// line = lane or beam, pulsing pink ring = area landing, dotted arc = spread,
// thin red line = aimed shot, white flash = damage (never a danger cue).
import { pixelGlow as glow } from '../render/fx.mjs';
import {
    HAZARD,
    PART,
    SHOT,
    bossHazards,
    bossPart,
    bossParts,
    bossShots,
    bossState,
} from './scene.mjs';

const TAU = Math.PI * 2;
const COLOUR = {
    amber: '#efb963',
    warn: '#b07448',
    hot: '#ff9370',
    white: '#fff0c8',
    pink: '#ff5aa0',
    aim: '#ff5a5a',
    void: '#b49cff',
};
const WARDEN_ORBIT = [
    [138, 78, 0.5],
    [152, 96, 2.2],
    [124, 70, 4.1],
    [106, 60, 3.2],
];
const px = (ctx, x, y, w = 1, h = 1) => ctx.fillRect(Math.round(x), Math.round(y), w, h);

function dotted(ctx, x, y, angle, length, colour, gap = 4, size = 1, from = 0) {
    ctx.fillStyle = colour;
    const cx = Math.cos(angle),
        cy = Math.sin(angle);
    for (let d = from; d < length; d += gap) {
        const X = x + cx * d,
            Y = y + cy * d;
        if (X < -4 || X > 484 || Y < -4 || Y > 274) continue;
        px(ctx, X, Y, size, size);
    }
}
function dottedRing(ctx, x, y, radius, colour, dots = 48, phase = 0, skip = null) {
    ctx.fillStyle = colour;
    for (let i = 0; i < dots; i++) {
        const a = phase + (i / dots) * TAU;
        if (skip && Math.abs(Math.atan2(Math.sin(a - skip.a), Math.cos(a - skip.a))) < skip.half)
            continue;
        const X = x + Math.cos(a) * radius,
            Y = y + Math.sin(a) * radius;
        if (X < -4 || X > 484 || Y < -4 || Y > 274) continue;
        px(ctx, X, Y);
    }
}
function dottedArc(ctx, x, y, radius, a0, a1, colour, gap = 5) {
    ctx.fillStyle = colour;
    const steps = Math.max(8, Math.floor((Math.abs(a1 - a0) * radius) / gap));
    for (let i = 0; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps;
        px(ctx, x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
}
function band(ctx, x, y, angle, length, width, colour) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.fillStyle = colour;
    ctx.fillRect(0, -Math.round(width / 2), Math.round(length), Math.round(width));
    ctx.restore();
}
function disc(ctx, cx, cy, r) {
    const radius = Math.max(1, Math.round(r));
    for (let dy = -radius; dy <= radius; dy++) {
        const half = Math.floor(Math.sqrt(radius * radius - dy * dy + 0.5));
        ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
    }
}

export class BossLayer {
    constructor(art, { reduced = false } = {}) {
        this.art = art;
        this.reduced = reduced;
    }
    // Boss, parts and hazards sit under the ship; shots draw above rocks.
    draw(ctx, scene, time) {
        const state = bossState(scene);
        if (!state.active) return;
        const hazards = bossHazards(scene);
        this.hazards(ctx, hazards, time, 'below');
        this.body(ctx, scene, state, time);
        this.hazards(ctx, hazards, time, 'above');
        this.shots(ctx, scene, time);
    }

    // ---------------------------------------------------------------- bodies
    body(ctx, scene, state, time) {
        const art = this.art,
            sheet = ['frontier', 'violet', 'ember', 'ruins', 'lunar', 'rift'][state.kind % 6];
        if (!art.ready(sheet)) {
            this.placeholder(ctx, state);
            return;
        }
        const { x, y } = state,
            flash = state.flash > 0 ? Math.min(1, state.flash / 80) * 0.7 : 0;
        const alpha = Math.min(1, state.entrance * 1.8 + 0.1);
        const dmg = state.damage;
        const frame = (key, extra = {}) =>
            art.draw(ctx, sheet, key, x, y, { alpha, flash, ...extra });
        const overlay = (key) => {
            if (dmg > 0) art.draw(ctx, sheet, `${key}-d${dmg}`, x, y, { alpha });
        };
        const aux = state.aux,
            parts = bossParts(scene);
        switch (state.kind) {
            case 0: {
                const open = aux[0],
                    index = Math.round(open * 3);
                glow(
                    ctx,
                    x,
                    y,
                    150,
                    '255,170,90',
                    (0.1 + 0.12 * Math.sin(time / 260)) * (state.stage >= 2 ? 1.4 : 1),
                );
                frame(
                    index === 3 && state.stage >= 2 && Math.floor(time / 240) % 2
                        ? 'sentinel-glow'
                        : `sentinel-${index}`,
                );
                overlay('sentinel');
                if (open > 0.5)
                    glow(ctx, x, y, 44, '255,200,120', 0.35 + 0.1 * Math.sin(time / 130));
                break;
            }
            case 6: {
                const index = Math.round(aux[0] * 2);
                frame(`picket-${index}`);
                overlay('picket');
                if (aux[0] > 0.5) glow(ctx, x, y, 28, '255,200,120', 0.35);
                break;
            }
            case 1:
                this.ringwarden(ctx, state, parts, time, frame, overlay);
                break;
            case 7: {
                frame(`shardling-${state.attack ? 1 : 0}`);
                overlay('shardling');
                for (let k = 0; k < 3; k++) {
                    const a = aux[2] + (k * TAU) / 3,
                        bx = x + Math.cos(a) * 46,
                        by = y + Math.sin(a) * 46;
                    art.draw(
                        ctx,
                        'violet',
                        `blade-inner-${((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16}`,
                        bx,
                        by,
                        { alpha },
                    );
                }
                break;
            }
            case 2: {
                glow(
                    ctx,
                    x,
                    y,
                    190,
                    '255,90,30',
                    0.2 + 0.06 * Math.sin(time / 210) + (aux[1] ? 0.18 : 0),
                );
                const heat = aux[0] < 0.5 ? 0 : aux[0] < 0.62 ? 1 : 2;
                frame(`forge-${heat}`);
                overlay('forge');
                // Fire churning behind the lattice: a few slow-orbiting additive flares.
                for (let k = 0; k < 7; k++) {
                    const a = time / (2400 + k * 310) + k * 2.1,
                        r = 28 + ((k * 37) % 70);
                    glow(
                        ctx,
                        x + Math.cos(a) * r,
                        y + Math.sin(a * 1.3) * r * 0.9,
                        30,
                        k % 2 ? '255,140,40' : '255,200,90',
                        0.16 + 0.08 * Math.sin(time / 170 + k),
                    );
                }
                for (let i = 0; i < 8; i++) {
                    const part = bossPart(scene, i);
                    if (!part.exists) continue;
                    const key =
                        part.state === 0
                            ? 'panel-0'
                            : `panel-${part.state}${Math.floor(time / 130 + i) % 2 ? 'a' : 'b'}`;
                    art.draw(ctx, sheet, key, part.x, part.y, { alpha });
                    if (part.state) glow(ctx, part.x, part.y, 22, '255,150,50', 0.4);
                }
                if (aux[1]) glow(ctx, x, y, 70, '255,244,200', 0.5 + 0.2 * Math.sin(time / 90));
                break;
            }
            case 8: {
                glow(ctx, x, y, 90, '255,90,30', 0.2 + (aux[1] ? 0.2 : 0));
                frame(aux[1] > 0.5 ? 'cinderling-1' : 'cinderling-0');
                overlay('cinderling');
                break;
            }
            case 3:
                this.bastion(ctx, state, parts, time, frame, overlay);
                break;
            case 9: {
                frame(aux[0] > 0.5 ? 'gunnery-1' : 'gunnery-0');
                overlay('gunnery');
                glow(ctx, x + 68, y, 18, '255,120,80', 0.2 + (aux[0] ? 0.3 : 0));
                break;
            }
            case 4: {
                const exposed = aux[2] > 0.5;
                frame(`tide-${Math.floor(time / 280) % 4}-${exposed ? 1 : 0}`);
                overlay('tide');
                if (exposed)
                    glow(ctx, x, y - 37, 80, '255,120,220', 0.25 + 0.12 * Math.sin(time / 100));
                for (const part of parts) {
                    if (part.kind !== PART.bubble) continue;
                    art.draw(ctx, 'shots', 'bubble', part.x, part.y, { alpha: 0.9 });
                }
                break;
            }
            case 10: {
                frame(`moonjelly-${Math.floor(time / 300) % 4}`);
                overlay('moonjelly');
                break;
            }
            case 5:
                this.warden(ctx, state, parts, time, frame, overlay);
                break;
            case 11: {
                const blink = aux[1] > 0.5;
                if (blink && Math.floor(time / 70) % 2) break; // flickers while blinking
                glow(ctx, x, y, 70, '255,170,70', 0.12);
                frame(aux[1] ? 'lensimp-1' : 'lensimp-0', { alpha: blink ? 0.5 : alpha });
                overlay('lensimp');
                const a = aux[0] * 1.4,
                    sx = x + Math.cos(a) * 74,
                    sy = y + Math.sin(a) * 40;
                dottedOrbit(ctx, x, y, 74, 40, 0, COLOUR.void);
                art.draw(ctx, 'rift', 'star-0', sx, sy);
                break;
            }
            default:
                break;
        }
    }
    placeholder(ctx, state) {
        // The sheet is still loading: a plain silhouette so the hit shapes are never a surprise.
        ctx.fillStyle = '#2c2c4a';
        disc(ctx, state.x, state.y, Math.min(state.mini ? 40 : 90, 100));
    }
    ringwarden(ctx, state, parts, time, frame, overlay) {
        const art = this.art,
            { x, y, aux } = state,
            scale = aux[0] || 1;
        glow(ctx, x, y, 110, '120,90,255', 0.12 + (aux[3] ? 0.14 : 0));
        frame(`ringwarden-core-${aux[3] ? 1 : 0}`);
        overlay('ringwarden');
        ctx.fillStyle = '#5a3caa';
        for (const radius of [106 * scale, 70 * scale])
            dottedRing(ctx, x, y, radius, '#a58cff', Math.round(radius * 2.4), 0);
        for (const part of parts) {
            if (part.kind !== PART.blade) continue;
            const outer = part.slot < 16,
                angle = Math.atan2(part.y - y, part.x - x);
            const k = ((Math.round(angle / (Math.PI / 8)) % 16) + 16) % 16;
            art.draw(ctx, 'violet', `blade-${outer ? 'outer' : 'inner'}-${k}`, part.x, part.y, {
                alpha: 1,
            });
        }
    }
    bastion(ctx, state, parts, time, frame, overlay) {
        const art = this.art,
            { x, y, aux } = state,
            alpha = Math.min(1, state.entrance * 1.8 + 0.1);
        const flash = state.flash > 0 ? Math.min(1, state.flash / 80) * 0.7 : 0;
        frame('bastion-hull');
        if (state.stage >= 2) art.draw(ctx, 'ruins', 'bastion-flare', x, y, { alpha });
        const alive = [false, false, false];
        for (const part of parts) if (part.kind === PART.hard) alive[part.slot] = true;
        art.draw(ctx, 'ruins', alive[0] ? 'bastion-cannon' : 'bastion-cannon-dead', x, y, {
            alpha,
            flash: alive[0] ? flash : 0,
        });
        art.draw(
            ctx,
            'ruins',
            alive[1] ? (aux[1] ? 'bastion-pods-open' : 'bastion-pods') : 'bastion-pods-dead',
            x,
            y,
            { alpha, flash: alive[1] ? flash : 0 },
        );
        art.draw(
            ctx,
            'ruins',
            alive[2] ? (aux[1] ? 'bastion-mine-open' : 'bastion-mine') : 'bastion-mine-dead',
            x,
            y,
            { alpha, flash: alive[2] ? flash : 0 },
        );
        overlay('bastion');
        glow(
            ctx,
            x + 114,
            y + 2,
            26,
            '255,110,60',
            0.2 + (aux[0] ? 0.3 : 0) + 0.1 * Math.sin(time / 200),
        );
        for (const part of parts) {
            if (part.kind !== PART.hard) continue;
            if (part.hp < 3) glow(ctx, part.x, part.y, 20, '255,120,50', 0.3);
        }
    }
    warden(ctx, state, parts, time, frame, overlay) {
        const art = this.art,
            { x, y, aux } = state,
            open = aux[1] > 0.5;
        glow(ctx, x, y, 170, '255,160,60', 0.14 + (open ? 0.26 + 0.1 * Math.sin(time / 90) : 0));
        frame(open ? 'warden-1' : 'warden-0');
        overlay('warden');
        for (let i = 0; i < 4; i++)
            dottedOrbit(
                ctx,
                x,
                y,
                WARDEN_ORBIT[i][0],
                WARDEN_ORBIT[i][1],
                WARDEN_ORBIT[i][2],
                COLOUR.void,
            );
        for (const part of parts)
            if (part.kind === PART.star) art.draw(ctx, 'rift', `star-${part.slot}`, part.x, part.y);
    }

    // ---------------------------------------------------------------- hazards
    hazards(ctx, list, time, pass) {
        for (const h of list) {
            const below =
                h.kind === HAZARD.pool ||
                h.kind === HAZARD.tell ||
                h.kind === HAZARD.arc ||
                h.kind === HAZARD.aim ||
                h.kind === HAZARD.pull;
            if ((pass === 'below') !== below) continue;
            const warning = h.warn > 0,
                urgency = warning ? 1 - h.warn / Math.max(1, h.warnTotal) : 1;
            const blink = warning && h.warn < 260 && Math.floor(time / 60) % 2;
            switch (h.kind) {
                case HAZARD.lane:
                    this.lane(ctx, h, warning, blink, time);
                    break;
                case HAZARD.pool:
                    this.pool(ctx, h, warning, urgency, time);
                    break;
                case HAZARD.beam:
                    this.beam(ctx, h, warning, blink);
                    break;
                case HAZARD.ring:
                    this.ring(ctx, h, warning, time);
                    break;
                case HAZARD.arm:
                    this.arm(ctx, h, warning, blink, time);
                    break;
                case HAZARD.tell: {
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
                    break;
                }
                case HAZARD.arc:
                    for (const side of [-1, 0, 1])
                        dotted(
                            ctx,
                            h.x,
                            h.y,
                            h.a + side * h.b,
                            h.c,
                            side ? COLOUR.warn : COLOUR.amber,
                            7,
                        );
                    break;
                case HAZARD.aim:
                    dotted(ctx, h.x, h.y, h.a, h.b, blink ? COLOUR.white : COLOUR.aim, 4);
                    break;
                case HAZARD.pull: {
                    const pulse = (time / 14) % 90;
                    for (let k = 0; k < 3; k++)
                        dottedRing(
                            ctx,
                            h.x,
                            h.y,
                            150 - ((pulse + k * 30) % 90) * 1.6,
                            '#a88cff',
                            36,
                            k,
                        );
                    break;
                }
                default:
                    break;
            }
        }
    }
    lane(ctx, h, warning, blink, time) {
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
    }
    pool(ctx, h, warning, urgency, time) {
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
    }
    beam(ctx, h, warning, blink) {
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
    }
    ring(ctx, h, warning, time) {
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
    }
    arm(ctx, h, warning, blink, time) {
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
    }

    // ---------------------------------------------------------------- shots
    shots(ctx, scene, time) {
        const art = this.art;
        for (const s of bossShots(scene)) {
            const flicker = Math.floor(time / 110) % 2;
            switch (s.family) {
                case SHOT.needle:
                    art.draw(ctx, 'shots', 'needle', s.x, s.y);
                    break;
                case SHOT.shard:
                    art.draw(ctx, 'shots', 'shard', s.x, s.y);
                    break;
                case SHOT.fast:
                    art.drawRotated(ctx, 'shots', 'fast', s.x, s.y, s.angle);
                    break;
                case SHOT.bolt:
                    art.drawRotated(ctx, 'shots', 'bolt', s.x, s.y, s.angle);
                    glow(ctx, s.x, s.y, 8, '255,150,100', 0.35);
                    break;
                case SHOT.sine:
                    art.draw(ctx, 'shots', 'sine', s.x, s.y);
                    break;
                case SHOT.pellet:
                    art.draw(ctx, 'shots', 'pellet', s.x, s.y);
                    break;
                case SHOT.ember:
                    art.draw(ctx, 'shots', `ember-${flicker}`, s.x, s.y);
                    break;
                case SHOT.curve:
                    art.draw(ctx, 'shots', 'curve', s.x, s.y);
                    glow(ctx, s.x, s.y, 7, '255,120,230', 0.35);
                    break;
                case SHOT.missile: {
                    const tail = 8;
                    ctx.fillStyle = flicker ? '#ffcf70' : '#ff8a3a';
                    px(ctx, s.x - Math.cos(s.angle) * tail, s.y - Math.sin(s.angle) * tail, 2, 2);
                    px(
                        ctx,
                        s.x - Math.cos(s.angle) * (tail + 3),
                        s.y - Math.sin(s.angle) * (tail + 3),
                        1,
                        1,
                    );
                    art.drawRotated(ctx, 'shots', 'missile', s.x, s.y, s.angle);
                    break;
                }
                case SHOT.mine:
                    art.draw(
                        ctx,
                        'shots',
                        Math.floor(time / (s.age > 1400 ? 90 : 220)) % 2 ? 'mine-1' : 'mine-0',
                        s.x,
                        s.y,
                    );
                    break;
                case SHOT.spore:
                    art.draw(ctx, 'shots', `spore-${flicker}`, s.x, s.y, { alpha: 0.92 });
                    break;
                case SHOT.lob: {
                    // Plasma arcs over the floor: a lifted sprite above its landing shadow.
                    const life = Math.max(1, s.aux),
                        lift = Math.sin(Math.min(1, s.age / life) * Math.PI) * 34;
                    ctx.fillStyle = '#2a1030';
                    px(ctx, s.x - 4, s.y + 1, 9, 2);
                    art.draw(ctx, 'shots', 'lob-0', s.x, s.y - lift);
                    glow(ctx, s.x, s.y - lift, 11, '255,110,40', 0.4);
                    break;
                }
                default:
                    break;
            }
        }
    }
}

function dottedOrbit(ctx, cx, cy, ia, ib, rot, colour) {
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
