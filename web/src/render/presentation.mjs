import { WIDTH, HEIGHT } from './constants.mjs';
// Menu-time presentation: the animated Home overlay and the Play launch
// sequence. Both are pure functions of a presentation clock, so they hold no
// gameplay state, never touch the simulation RNG, and freeze when not drawn.
import { glow } from './fx.mjs';
import { hullSprite } from '../state/hangar.mjs';
export { WIDTH, HEIGHT };
const TAU = Math.PI * 2;
const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
};

// Home overlay over the static violet backdrop: stars twinkle, a few flare
// crosses pulse, dust drifts toward the planet and a shooting star crosses the
// sky every few seconds. Everything is closed-form in `ms`, so it holds no
// state and freezes when not drawn. Reduced motion draws nothing.
const SKY = [
    [60, 40],
    [150, 22],
    [210, 70],
    [290, 18],
    [340, 54],
    [395, 30],
    [452, 78],
    [24, 120],
    [110, 160],
    [196, 128],
    [262, 96],
    [300, 150],
    [30, 210],
    [90, 244],
    [170, 200],
    [330, 236],
    [410, 214],
    [460, 168],
    [240, 22],
    [128, 96],
];
export function drawHome(ctx, ms, { reduced = false, art = null, hull = 'vanguard' } = {}) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (reduced) return;
    const t = Math.floor(ms / 50) * 0.05;
    // Twinkling stars: each fades on its own slow period.
    for (let i = 0; i < 90; i++) {
        const x = Math.floor(hash(i + 1) * WIDTH),
            y = Math.floor(hash(i + 2) * (HEIGHT - 30));
        const pulse = 0.5 + 0.5 * Math.sin(t * (0.6 + hash(i + 3) * 1.4) + hash(i + 4) * TAU);
        ctx.fillStyle = `rgba(${hash(i + 5) > 0.5 ? '220,210,255' : '255,225,200'}, ${(0.1 + 0.7 * pulse * pulse).toFixed(3)})`;
        ctx.fillRect(x, y, 1, 1);
    }
    // Flare crosses on a few bright stars.
    for (const [i, [x, y]] of SKY.entries()) {
        if (i % 3) continue;
        const k = 0.5 + 0.5 * Math.sin(t * (0.5 + hash(i) * 0.8) + i * 1.7);
        if (k < 0.35) continue;
        ctx.fillStyle = `rgba(255,255,255,${(0.5 + 0.5 * k).toFixed(3)})`;
        ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = `rgba(150,170,255,${(0.7 * k).toFixed(3)})`;
        ctx.fillRect(x - 1, y, 1, 1);
        ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x, y - 1, 1, 1);
        ctx.fillRect(x, y + 1, 1, 1);
    }
    // Dust drifts right and slightly down, wrapping at the edges.
    for (let i = 0; i < 36; i++) {
        const speed = 6 + hash(i + 11) * 18;
        const x = (hash(i + 12) * WIDTH + t * speed) % WIDTH,
            y = (hash(i + 13) * HEIGHT + t * speed * 0.22) % HEIGHT;
        ctx.fillStyle = `rgba(255,200,170,${(0.12 + 0.22 * hash(i + 14)).toFixed(3)})`;
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    if (art) {
        sunGlare(ctx, t);
        flyby(ctx, art, hull, t);
    }
    // Shooting star: an 11 second loop, visible for the first 0.9 s.
    const phase = (t % 11) / 0.9;
    if (phase < 1) {
        const loop = Math.floor(t / 11),
            startX = 40 + hash(loop + 70) * 260,
            startY = 10 + hash(loop + 71) * 70;
        for (let k = 0; k < 14; k++) {
            const p = phase * 1.2 - k * 0.03;
            if (p < 0 || p > 1) continue;
            ctx.fillStyle = `rgba(255,${240 - k * 8},${210 - k * 10},${(1 - k / 14).toFixed(3)})`;
            ctx.fillRect(
                Math.round(startX + p * 150),
                Math.round(startY + p * 70),
                1 + (k < 2 ? 1 : 0),
                1,
            );
        }
    }
}

// Sunlight skimming the planet's limb: a soft bloom that breathes, a thin
// anamorphic streak and a few faint lens ghosts along the line from the sun
// (off-screen upper left) through the planet. Additive, so it only brightens.
const GLARE = [262, 150];
function sunGlare(ctx, t) {
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.7),
        flutter = 0.5 + 0.5 * Math.sin(t * 2.3 + 1);
    const [x, y] = GLARE;
    glow(ctx, x, y, 78, '255,160,110', 0.26 + 0.12 * breathe);
    glow(ctx, x, y, 30, '255,232,196', 0.34 + 0.2 * breathe);
    glow(ctx, x, y, 9, '255,255,246', 0.55 + 0.3 * flutter);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const streak = ctx.createLinearGradient(x - 120, 0, x + 120, 0);
    streak.addColorStop(0, 'rgba(255,190,140,0)');
    streak.addColorStop(0.5, `rgba(255,236,206,${(0.55 + 0.25 * breathe).toFixed(2)})`);
    streak.addColorStop(1, 'rgba(255,190,140,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(x - 120, y, 240, 1);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - 70, y - 1, 140, 3);
    ctx.restore();
    // Ghosts: reflections of the sun spaced along the sun-to-planet line.
    const [sx, sy, px, py] = [30, 10, 372, 214];
    for (const [f, r, a] of [
        [0.3, 14, 0.1],
        [0.56, 7, 0.14],
        [0.8, 22, 0.07],
    ]) {
        glow(
            ctx,
            sx + (px - sx) * f,
            sy + (py - sy) * f,
            r,
            '255,200,160',
            a * (0.7 + 0.3 * breathe),
        );
    }
}

// A ship crosses the sky every 17 seconds, diving in from the top and passing in
// front of the planet, clear of the menu column on the left. It flies the hull equipped for the active profile.
const FLYBY_MS = 17000,
    FLYBY_SPAN = 12000;
function flyby(ctx, art, hull, t) {
    const cycle = (t * 1000) % FLYBY_MS;
    if (cycle > FLYBY_SPAN) return;
    const p = cycle / FLYBY_SPAN,
        path = (q) => [150 + q * 410, -34 + q * 304 + Math.sin(q * TAU) * 6];
    const [x, y] = path(p),
        [nx, ny] = path(Math.min(1, p + 0.01));
    const angle = Math.atan2(ny - y, nx - x);
    const direction = ((Math.round((angle * 8) / Math.PI) % 16) + 16) % 16;
    const cell = art.sprites[hullSprite(hull, direction)];
    if (!cell) return;
    const scale = 2,
        dx = Math.cos(angle),
        dy = Math.sin(angle),
        tail = 10 * scale;
    glow(ctx, x - dx * tail * 1.5, y - dy * tail * 1.5, 22, '255,130,60', 0.65);
    glow(ctx, x - dx * tail, y - dy * tail, 10, '120,220,255', 0.5);
    const flick = 1 + (Math.floor(t * 12) % 3);
    for (const [colour, length, size] of [
        ['#9d502e', 9, 5],
        ['#efb963', 6, 3],
        ['#fff5d2', 3, 2],
    ]) {
        ctx.fillStyle = colour;
        for (let i = 0; i < (length + flick) * scale; i += 2) {
            ctx.fillRect(
                Math.round(x - dx * (tail + i) - size / 2),
                Math.round(y - dy * (tail + i) - size / 2),
                size,
                size,
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
    // Passing the glare, the hull catches a brief highlight.
    const near = 1 - Math.min(1, Math.hypot(x - GLARE[0], y - GLARE[1]) / 95);
    if (near > 0) glow(ctx, x, y, 26, '255,236,200', 0.35 * near);
}

// First-person launch: a restrained cockpit window frames blue-white stars
// that stretch and rush past, then settle on arrival. No exterior ship.
export const WARP_ACTION_MS = 2400;
export const WARP_HOLD_MS = 800;
export const WARP_TOTAL_MS = WARP_ACTION_MS + WARP_HOLD_MS;
export const warpSpeed = (ms) => {
    if (ms <= 0) return 0;
    if (ms >= WARP_ACTION_MS) return 0;
    const t = ms / WARP_ACTION_MS;
    return t < 0.55 ? (t / 0.55) ** 2 : Math.max(0, 1 - ((t - 0.55) / 0.45) ** 1.4);
};
// Integrating speed keeps stars moving forward while the streak length settles.
export function warpDistance(ms) {
    const end = Math.min(Math.max(ms, 0), WARP_ACTION_MS);
    let distance = 0;
    for (let time = 0; time < end; time += 20) {
        distance += ((0.25 + warpSpeed(time) * 2.2) * Math.min(20, end - time)) / 1000;
    }
    return distance;
}
export function drawWarp(ctx, ms) {
    ms = Math.floor(ms / 40) * 40;
    const speed = warpSpeed(ms),
        cx = WIDTH / 2,
        cy = HEIGHT / 2;
    ctx.fillStyle = '#07031a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Violet nebula glow at the vanishing point, brightening as speed builds.
    const glowRadius = 150 + speed * 70;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    glow.addColorStop(0, `rgba(255, 150, 110, ${(0.1 + speed * 0.28).toFixed(3)})`);
    glow.addColorStop(0.35, `rgba(150, 70, 190, ${(0.14 + speed * 0.12).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(7, 3, 26, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const travel = warpDistance(ms);
    for (let i = 0; i < 150; i++) {
        const angle = hash(i) * TAU,
            lane = 0.12 + hash(i + 17) * 0.88;
        // Each star's distance from the centre loops, so the field never empties.
        const base = (hash(i + 41) + travel * (0.2 + lane * 0.6)) % 1;
        const r = 6 + base * base * 300 * lane + base * 20;
        const tail = 1 + speed * (r * 0.22);
        const x1 = cx + Math.cos(angle) * r,
            y1 = cy + Math.sin(angle) * r * 0.9;
        const x0 = cx + Math.cos(angle) * (r - tail),
            y0 = cy + Math.sin(angle) * (r - tail) * 0.9;
        // Streaks run from violet in the distance to warm white up close; a few are amber.
        const warm = hash(i + 7) > 0.82;
        const red = warm ? 255 : 170 + Math.round(85 * lane),
            green = warm ? 190 + Math.round(40 * lane) : 150 + Math.round(86 * lane),
            blue = warm ? 120 : 255 - Math.round(40 * lane);
        ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${(0.2 + 0.7 * base).toFixed(2)})`;
        ctx.lineWidth = base > 0.75 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x0) + 0.5, Math.round(y0) + 0.5);
        ctx.lineTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
        ctx.stroke();
    }
    // Fixed perspective window and instrument sill: dark violet with an amber rim light.
    ctx.fillStyle = '#0a0518';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(5, 0);
    ctx.lineTo(18, 202);
    ctx.lineTo(31, 244);
    ctx.lineTo(0, 244);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(WIDTH, 0);
    ctx.lineTo(WIDTH - 5, 0);
    ctx.lineTo(WIDTH - 18, 202);
    ctx.lineTo(WIDTH - 31, 244);
    ctx.lineTo(WIDTH, 244);
    ctx.fill();
    ctx.fillRect(0, 244, WIDTH, 26);
    ctx.strokeStyle = '#5a3c98';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5.5, 0);
    ctx.lineTo(18.5, 202);
    ctx.lineTo(31.5, 244);
    ctx.lineTo(WIDTH - 31.5, 244);
    ctx.lineTo(WIDTH - 18.5, 202);
    ctx.lineTo(WIDTH - 5.5, 0);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 190, 110, ${(0.25 + speed * 0.5).toFixed(2)})`;
    ctx.beginPath();
    ctx.moveTo(31.5, 243.5);
    ctx.lineTo(WIDTH - 31.5, 243.5);
    ctx.stroke();
    const lights = ['#ffbe6e', '#be96e6', '#78ebff'];
    [95, 230, 355].forEach((x, i) => {
        ctx.fillStyle = '#160a34';
        ctx.fillRect(x, 251, 28, 10);
        ctx.fillStyle = lights[i];
        ctx.fillRect(x + 4, 254, 16, 1);
        ctx.fillRect(x + 4, 257, 10, 1);
    });
    if (ms >= WARP_ACTION_MS - 300) {
        ctx.fillStyle = '#fff0d0';
        ctx.globalAlpha = Math.min(1, (ms - (WARP_ACTION_MS - 300)) / 300);
        ctx.fillRect(WIDTH / 2 - 1, HEIGHT / 2 - 1, 2, 2);
        ctx.globalAlpha = 1;
    }
}

// Owns one launch: `finish` runs once, whether the clip ends, is skipped, or
// is cancelled. Reduced motion swaps the tunnel for a brief calm fade.
export class LaunchSequence {
    constructor({ reduced = false } = {}) {
        this.reduced = reduced;
        this.active = false;
        this.start = 0;
        this.done = null;
    }
    begin(now, done) {
        this.active = true;
        this.start = now;
        this.done = done;
    }
    get total() {
        return this.reduced ? 250 : WARP_TOTAL_MS;
    }
    elapsed(now) {
        return now - this.start;
    }
    tick(now) {
        if (this.active && this.elapsed(now) >= this.total) this.end(true);
    }
    skip() {
        if (this.active) this.end(true);
    }
    cancel() {
        if (this.active) this.end(false);
    }
    end(started) {
        const done = this.done;
        this.active = false;
        this.done = null;
        done?.(started);
    }
}
