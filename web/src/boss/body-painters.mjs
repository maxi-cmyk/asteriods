import { pixelGlow as glow } from '../render/fx.mjs';
import { PART, bossPart } from './scene.mjs';
import { TAU, COLOUR, dottedRing, dottedOrbit } from './draw-kit.mjs';

// One painter per boss kind (the index is the engine's BossKind). Each receives `b`:
//   ctx, art, scene, time     what to draw onto, from, and when
//   state, aux, parts         the decoded boss state, its 16 floats and its sub-targets
//   A                         this kind's named aux slots (KINDS[kind].aux)
//   x, y, alpha, flash        position, entrance fade and damage flash
//   frame(key, extra)         draws the body sprite `key` from the boss's own sheet
//   overlay(key)              draws the damage-state overlay for the current damage level
const WARDEN_ORBIT = [
    [138, 78, 0.5],
    [152, 96, 2.2],
    [124, 70, 4.1],
    [106, 60, 3.2],
];

const sentinel = (b) => {
    const { ctx, x, y, time, aux, state, A } = b;
    const open = aux[A.open],
        index = Math.round(open * 3);
    glow(
        ctx,
        x,
        y,
        150,
        '255,170,90',
        (0.1 + 0.12 * Math.sin(time / 260)) * (state.stage >= 2 ? 1.4 : 1),
    );
    b.frame(
        index === 3 && state.stage >= 2 && Math.floor(time / 240) % 2
            ? 'sentinel-glow'
            : `sentinel-${index}`,
    );
    b.overlay('sentinel');
    if (open > 0.5) glow(ctx, x, y, 44, '255,200,120', 0.35 + 0.1 * Math.sin(time / 130));
};

const ringwarden = (b) => {
    const { ctx, art, x, y, aux, parts, A } = b;
    const scale = aux[A.scale] || 1;
    glow(ctx, x, y, 110, '120,90,255', 0.12 + (aux[A.charging] ? 0.14 : 0));
    b.frame(`ringwarden-core-${aux[A.charging] ? 1 : 0}`);
    b.overlay('ringwarden');
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
};

const cinderforge = (b) => {
    const { ctx, art, scene, sheet, x, y, time, aux, alpha, A } = b;
    glow(ctx, x, y, 190, '255,90,30', 0.2 + 0.06 * Math.sin(time / 210) + (aux[A.open] ? 0.18 : 0));
    const heat = aux[A.heat] < 0.5 ? 0 : aux[A.heat] < 0.62 ? 1 : 2;
    b.frame(`forge-${heat}`);
    b.overlay('forge');
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
    if (aux[A.open]) glow(ctx, x, y, 70, '255,244,200', 0.5 + 0.2 * Math.sin(time / 90));
};

const bastion = (b) => {
    const { ctx, art, state, x, y, time, aux, parts, alpha, flash, A } = b;
    b.frame('bastion-hull');
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
        alive[1] ? (aux[A.pods] ? 'bastion-pods-open' : 'bastion-pods') : 'bastion-pods-dead',
        x,
        y,
        { alpha, flash: alive[1] ? flash : 0 },
    );
    art.draw(
        ctx,
        'ruins',
        alive[2] ? (aux[A.pods] ? 'bastion-mine-open' : 'bastion-mine') : 'bastion-mine-dead',
        x,
        y,
        { alpha, flash: alive[2] ? flash : 0 },
    );
    b.overlay('bastion');
    glow(
        ctx,
        x + 114,
        y + 2,
        26,
        '255,110,60',
        0.2 + (aux[A.cannon] ? 0.3 : 0) + 0.1 * Math.sin(time / 200),
    );
    for (const part of parts) {
        if (part.kind !== PART.hard) continue;
        if (part.hp < 3) glow(ctx, part.x, part.y, 20, '255,120,50', 0.3);
    }
};

const tidecaller = (b) => {
    const { ctx, art, x, y, time, aux, parts, A } = b;
    const exposed = aux[A.exposed] > 0.5;
    b.frame(`tide-${Math.floor(time / 280) % 4}-${exposed ? 1 : 0}`);
    b.overlay('tide');
    if (exposed) glow(ctx, x, y - 37, 80, '255,120,220', 0.25 + 0.12 * Math.sin(time / 100));
    for (const part of parts) {
        if (part.kind !== PART.bubble) continue;
        art.draw(ctx, 'shots', 'bubble', part.x, part.y, { alpha: 0.9 });
    }
};

// The mirror: a bright rim and glints while it deflects; a thin dotted ring while it forms.
function mirrorShell(b, strength) {
    const { ctx, x, y, time } = b;
    if (strength < 1) {
        dottedRing(ctx, x, y, 104, COLOUR.white, 72, time / 500);
        return;
    }
    glow(ctx, x, y, 118, '170,230,255', 0.16 + 0.04 * Math.sin(time / 120));
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 104, 0, TAU);
    ctx.globalAlpha = 0.1 + 0.03 * Math.sin(time / 150);
    ctx.fillStyle = '#bfe8ff';
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#d8f4ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    dottedRing(ctx, x, y, 103, '#7fd0ff', 120, -time / 700);
    // Two glints sliding round the rim.
    for (let k = 0; k < 2; k++) {
        const a = time / 420 + k * Math.PI;
        glow(ctx, x + Math.cos(a) * 104, y + Math.sin(a) * 104, 14, '230,250,255', 0.5);
    }
}

const warden = (b) => {
    const { ctx, art, x, y, time, aux, parts, alpha, A } = b;
    const open = aux[A.coreOpen] > 0.5,
        cloak = aux[A.cloak],
        mirror = aux[A.mirror];
    // Cloaked it is gone but for a faint shimmer; it flickers on the way out and back in.
    if (cloak > 0.9) {
        dottedRing(ctx, x, y, 58 + 4 * Math.sin(time / 90), COLOUR.void, 24, time / 400);
        return;
    }
    const flicker = cloak > 0;
    if (flicker && Math.floor(time / 70) % 2) {
        dottedRing(ctx, x, y, 80, COLOUR.void, 36, time / 300);
        return;
    }
    const fade = flicker ? alpha * 0.55 : alpha;
    glow(
        ctx,
        x,
        y,
        170,
        '255,160,60',
        (0.14 + (open ? 0.26 + 0.1 * Math.sin(time / 90) : 0)) * (flicker ? 0.5 : 1),
    );
    b.frame(open ? 'warden-1' : 'warden-0', { alpha: fade });
    b.overlay('warden');
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
        if (part.kind === PART.star)
            art.draw(ctx, 'rift', `star-${part.slot}`, part.x, part.y, { alpha: fade });
    if (mirror > 0.25) mirrorShell(b, mirror > 0.75 ? 1 : 0);
};

const picket = (b) => {
    const { ctx, x, y, aux, A } = b;
    b.frame(`picket-${Math.round(aux[A.open] * 2)}`);
    b.overlay('picket');
    if (aux[A.open] > 0.5) glow(ctx, x, y, 28, '255,200,120', 0.35);
};

const shardling = (b) => {
    const { ctx, art, x, y, aux, alpha, state, A } = b;
    b.frame(`shardling-${state.attack ? 1 : 0}`);
    b.overlay('shardling');
    for (let k = 0; k < 3; k++) {
        const a = aux[A.spin] + (k * TAU) / 3,
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
};

const cinderling = (b) => {
    const { ctx, x, y, aux, A } = b;
    glow(ctx, x, y, 90, '255,90,30', 0.2 + (aux[A.open] ? 0.2 : 0));
    b.frame(aux[A.open] > 0.5 ? 'cinderling-1' : 'cinderling-0');
    b.overlay('cinderling');
};

const gunnery = (b) => {
    const { ctx, x, y, aux, A } = b;
    b.frame(aux[A.firing] > 0.5 ? 'gunnery-1' : 'gunnery-0');
    b.overlay('gunnery');
    glow(ctx, x + 68, y, 18, '255,120,80', 0.2 + (aux[A.firing] ? 0.3 : 0));
};

const moonjelly = (b) => {
    b.frame(`moonjelly-${Math.floor(b.time / 300) % 4}`);
    b.overlay('moonjelly');
};

const lensimp = (b) => {
    const { ctx, art, x, y, time, aux, alpha, A } = b;
    const blink = aux[A.blink] > 0.5;
    if (blink && Math.floor(time / 70) % 2) return; // flickers while blinking
    glow(ctx, x, y, 70, '255,170,70', 0.12);
    b.frame(aux[A.blink] ? 'lensimp-1' : 'lensimp-0', { alpha: blink ? 0.5 : alpha });
    b.overlay('lensimp');
    const a = aux[A.clock] * 1.4,
        sx = x + Math.cos(a) * 74,
        sy = y + Math.sin(a) * 40;
    dottedOrbit(ctx, x, y, 74, 40, 0, COLOUR.void);
    art.draw(ctx, 'rift', 'star-0', sx, sy);
};

// Indexed by BossKind: six bosses, then their six minis.
export const BODY_PAINTERS = [
    sentinel,
    ringwarden,
    cinderforge,
    bastion,
    tidecaller,
    warden,
    picket,
    shardling,
    cinderling,
    gunnery,
    moonjelly,
    lensimp,
];
