// Draws the boss layer: body sprites by kind, sub-targets, hostile shots, hazards and their
// telegraphs. Everything is a pure function of the scene and the visual clock, so pausing
// freezes it. The painters live next door: body-painters (one per boss), hazard-painters
// and shot-painters.
import { REGION_SHEETS, bossHazards, bossParts, bossShots, bossState } from './scene.mjs';
import { BODY_PAINTERS } from './body-painters.mjs';
import { BELOW_BODY, HAZARD_PAINTERS } from './hazard-painters.mjs';
import { SHOT_PAINTERS } from './shot-painters.mjs';
import { disc } from './draw-kit.mjs';

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
    body(ctx, scene, state, time) {
        const { art } = this,
            sheet = REGION_SHEETS[state.kind % 6];
        if (!art.ready(sheet)) {
            this.placeholder(ctx, state);
            return;
        }
        const { x, y } = state,
            flash = state.flash > 0 ? Math.min(1, state.flash / 80) * 0.7 : 0;
        const alpha = Math.min(1, state.entrance * 1.8 + 0.1);
        const damage = state.damage;
        BODY_PAINTERS[state.kind]?.({
            ctx,
            art,
            scene,
            time,
            sheet,
            state,
            x,
            y,
            alpha,
            flash,
            aux: state.aux,
            parts: bossParts(scene),
            frame: (key, extra = {}) => art.draw(ctx, sheet, key, x, y, { alpha, flash, ...extra }),
            overlay: (key) => {
                if (damage > 0) art.draw(ctx, sheet, `${key}-d${damage}`, x, y, { alpha });
            },
        });
    }
    // The sheet is still loading: a plain silhouette so the hit shapes are never a surprise.
    placeholder(ctx, state) {
        ctx.fillStyle = '#2c2c4a';
        disc(ctx, state.x, state.y, Math.min(state.mini ? 40 : 90, 100));
    }
    hazards(ctx, list, time, pass) {
        for (const h of list) {
            if ((pass === 'below') !== BELOW_BODY.has(h.kind)) continue;
            const warning = h.warn > 0;
            HAZARD_PAINTERS[h.kind]?.(ctx, h, {
                warning,
                urgency: warning ? 1 - h.warn / Math.max(1, h.warnTotal) : 1,
                blink: warning && h.warn < 260 && Math.floor(time / 60) % 2,
                time,
            });
        }
    }
    shots(ctx, scene, time) {
        const flicker = Math.floor(time / 110) % 2;
        for (const s of bossShots(scene))
            SHOT_PAINTERS[s.family]?.(ctx, this.art, s, time, flicker);
    }
}
