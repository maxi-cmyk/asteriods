import { WIDTH, HEIGHT } from './constants.mjs';
// Original, procedurally authored pixel backgrounds for each region. Nothing
// here is copied from the inspiration references: those are watermarked
// previews, so only their moods (a violet gas giant, a red world over pink
// terrain, a ruined moon, calm blue moons, a black-hole ring) guide the art.
// Light comes from the upper left, matching the sprite atlas.
//   backgrounds/raster.mjs          pixel raster, noise and dithering
//   backgrounds/scenery.mjs         star layers and rotating worlds
//   backgrounds/region-painters.mjs one painter per region
import { REGIONS, RegionTimeline } from './regions.mjs';
import { BUILDERS } from './backgrounds/region-painters.mjs';
import { rand } from './backgrounds/raster.mjs';
import { tile, drawWorld } from './backgrounds/scenery.mjs';

export { WIDTH, HEIGHT };

// Tier 3+ boss fights (waves 93 and up) play in front of something that should
// not exist: a quasi-star, a pulsar or a magnetar, picked by boss and tier. It
// replaces nothing; the region's own scenery dims behind a veil. Background only.
export const FIGHT_SCENERY = Object.freeze([
    { name: 'quasi-star', x: 138, y: 98, period: 0 },
    { name: 'pulsar', x: 150, y: 102, period: 9000 },
    { name: 'magnetar', x: 150, y: 102, period: 9000 },
]);
export const fightSceneryFor = ({ kind, tier }) =>
    FIGHT_SCENERY[((((kind % 6) + tier - 3) % 3) + 3) % 3];

// Dims decoration so bullets, rocks, pickups, and warnings stay on top.
const PLAY_DIM = 'rgba(8, 4, 22, .2)';

export class Backgrounds {
    constructor({ reduced = false } = {}) {
        this.reduced = reduced;
        this.motion = 1;
        this.brightness = 1;
        this.timeline = new RegionTimeline({ reduced });
        this.built = new Map();
        this.failed = new Set();
        this.queued = new Set();
        this.worlds = null;
        this.fightMix = 0;
        this.fightPick = null;
        this.fightTime = null;
    }
    // Sprites arrive after the game art loads; regions built earlier are rebuilt.
    setWorlds(worlds) {
        this.worlds = worlds;
        this.built.clear();
        this.failed.clear();
    }
    setReduced(value) {
        this.reduced = value;
        this.timeline.reduced = value;
    }
    art(index) {
        if (this.failed.has(index)) return null;
        let art = this.built.get(index);
        if (!art) {
            try {
                art = BUILDERS[REGIONS[index].id](this.worlds);
                this.built.set(index, art);
            } catch (error) {
                console.error(`Background ${REGIONS[index].id} failed`, error);
                this.failed.add(index);
                return null;
            }
        }
        return art;
    }
    // Build the next region between frames, never in the middle of one.
    preload(index) {
        if (index >= REGIONS.length || this.built.has(index) || this.queued.has(index)) return;
        this.queued.add(index);
        const build = () => {
            this.art(index);
        };
        if (typeof requestIdleCallback === 'function')
            requestIdleCallback(build, { timeout: 1500 });
        else setTimeout(build, 50);
    }
    paintRegion(ctx, index, time, extra = {}) {
        const art = this.art(index);
        const motion = this.reduced ? 0 : this.motion;
        if (!art) {
            ctx.fillStyle = REGIONS[index].fallback;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
            return;
        }
        ctx.drawImage(art.back, 0, 0);
        tile(ctx, art.stars[0], motion * time * 0.0016);
        tile(ctx, art.stars[1], motion * time * 0.004);
        ctx.save();
        ctx.translate(extra.offsetX || 0, extra.offsetY || 0);
        art.paint(ctx, time, motion, extra);
        ctx.restore();
    }
    // Draws the scene for the current region and any transition in progress.
    draw(ctx, { time, wave, run, practice, dim, hold = false, fight = null }) {
        const lines = this.timeline;
        if (!hold) lines.observe({ wave, time, run, practice });
        const index = lines.index;
        this.preload(index + 1);
        const move = lines.progress(time);
        if (!move) this.paintRegion(ctx, index, time);
        else {
            const { from, to, e, gesture } = move;
            if (gesture === 'orbital-pass') {
                this.paintRegion(ctx, from, time, { offsetX: -Math.round(e * 36) });
                ctx.globalAlpha = e;
                this.paintRegion(ctx, to, time, { offsetX: Math.round((1 - e) * 64) });
                ctx.globalAlpha = 1;
            } else if (gesture === 'ring-convergence') {
                this.paintRegion(ctx, from, time);
                ctx.globalAlpha = e;
                this.paintRegion(ctx, to, time, { ringScale: 1 + 0.22 * (1 - e) });
                ctx.globalAlpha = 1;
                this.convergence(ctx, move.t);
            } else if (gesture === 'atmospheric-sweep') {
                this.paintRegion(ctx, from, time);
                const edge = Math.round(WIDTH * e);
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, edge, HEIGHT);
                ctx.clip();
                this.paintRegion(ctx, to, time);
                ctx.restore();
                ctx.fillStyle = `rgba(130,55,70,${(0.14 * Math.sin(e * Math.PI)).toFixed(3)})`;
                ctx.fillRect(Math.max(0, edge - 14), 0, 28, HEIGHT);
            } else if (gesture === 'skyline-emergence') {
                this.paintRegion(ctx, from, time);
                ctx.globalAlpha = e;
                this.paintRegion(ctx, to, time, { offsetY: Math.round((1 - e) * 6) });
                ctx.globalAlpha = 1;
            } else if (gesture === 'cloud-clearance') {
                this.paintRegion(ctx, from, time);
                ctx.globalAlpha = e;
                this.paintRegion(ctx, to, time);
                ctx.globalAlpha = 1;
                ctx.fillStyle = `rgba(50,70,110,${(0.18 * Math.sin(e * Math.PI)).toFixed(3)})`;
                for (let lane = 0; lane < 5; lane++)
                    ctx.fillRect(Math.round((1 - e) * WIDTH - lane * 80), lane * 54, 90, 14);
            } else {
                this.paintRegion(ctx, from, time);
                ctx.globalAlpha = e;
                this.paintRegion(ctx, to, time);
                ctx.globalAlpha = 1;
            }
        }
        this.paintFight(ctx, time, fight);
        if (dim) {
            ctx.fillStyle = PLAY_DIM;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
        }
        if (this.brightness < 1) {
            ctx.fillStyle = `rgba(0,0,0,${1 - this.brightness})`;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
        }
        return lines.cue(time);
    }
    // Fades the tier 3+ backdrop in and out over about 0.7 s of visual time.
    paintFight(ctx, time, fight) {
        const active = !!fight && fight.tier >= 3;
        if (active) this.fightPick = fightSceneryFor(fight);
        const dt = this.fightTime === null ? 0 : Math.max(0, Math.min(100, time - this.fightTime));
        this.fightTime = time;
        this.fightMix = Math.max(
            0,
            Math.min(1, this.fightMix + (active ? dt : -dt) / (this.reduced ? 120 : 700)),
        );
        if (!this.fightMix || !this.fightPick || !this.worlds) return;
        ctx.fillStyle = `rgba(6, 3, 16, ${(0.55 * this.fightMix).toFixed(3)})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        const { name, x, y, period } = this.fightPick;
        drawWorld(ctx, this.worlds, name, x, y, time, this.reduced ? 0 : this.motion, {
            period: period || 1,
            alpha: this.fightMix,
        });
    }
    // A few distant star traces bend toward the emerging ring. Background only.
    convergence(ctx, t) {
        const cx = 318,
            cy = 132,
            next = rand(77);
        ctx.fillStyle = '#9a90d0';
        for (let i = 0; i < 14; i++) {
            const angle = next() * Math.PI * 2,
                start = 190 + next() * 70,
                spin = 0.9 + next() * 0.5;
            const progress = Math.max(0, Math.min(1, (t - 0.1 - next() * 0.15) / 0.6));
            for (let k = 0; k < 7; k++) {
                const p = Math.min(1, progress + k * 0.018),
                    radius = start * (1 - p * 0.82);
                const a = angle + spin * p;
                const x = Math.round(cx + Math.cos(a) * radius),
                    y = Math.round(cy + Math.sin(a) * radius * 0.6);
                ctx.globalAlpha =
                    (0.12 + 0.5 * (1 - k / 7)) * Math.sin(Math.min(1, progress) * Math.PI);
                ctx.fillRect(x, y, 1, 1);
            }
        }
        ctx.globalAlpha = 1;
    }
}
