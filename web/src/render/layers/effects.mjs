import { S } from '../../runtime/scene-layout.mjs';
import { WIDTH, HEIGHT, COLOUR } from '../constants.mjs';
import { smallBlast, bossBlast } from '../fx.mjs';
import { deathMs, drawDeath } from '../../boss/death.mjs';
import { KINDS } from '../../boss/scene.mjs';

// Small explosions from rocks and ships.
export class EffectsLayer {
    draw({ ctx, observer, time }) {
        for (const effect of observer.effects) smallBlast(ctx, effect, time);
    }
}

// The boss death in progress, with its banner.
export class FinaleLayer {
    draw({ ctx, px, observer, bossArt, time, reduced }) {
        const { finale } = observer;
        if (!finale) return;
        // Each boss has its own death (boss/death.mjs); the plain blast is the fallback
        // while its art is still loading.
        if (!drawDeath(ctx, bossArt, finale, time, { reduced })) {
            const info = KINDS[finale.kind];
            bossBlast(ctx, finale, time, {
                width: WIDTH,
                height: HEIGHT,
                reduced,
                sprite: (name, x, y, scale) => px.sprite(name, x, y, scale),
                chunks: bossArt.rubble(finale.kind),
                scale: finale.mini ? 0.6 : Math.max(1, Math.max(...(info?.size || [220])) / 200),
            });
        }
        this.banner(ctx, px, finale, time);
    }
    banner(ctx, px, finale, time) {
        const age = time - finale.time;
        const end = deathMs(finale.kind) - 200;
        if (age < 350 || age > end) return;
        ctx.globalAlpha = Math.min(1, (age - 350) / 250, (end - age) / 250);
        const line = `${(KINDS[finale.kind]?.name || 'BOSS').toUpperCase()} DESTROYED`;
        px.text(line, WIDTH / 2 + 1, 191, '#1a0c2c', 2, 'center');
        px.text(line, WIDTH / 2, 190, '#ffe2aa', 2, 'center');
        ctx.globalAlpha = 1;
    }
}

// "WAVE n" at the start of a wave, and the name of a region as the flight enters it.
export class CueLayer {
    draw({ ctx, px, scene, cue }) {
        if (!scene[S.PRACTICE] && scene[S.WAVE_CUE] && scene[S.STATE] === 2)
            px.text(`WAVE ${scene[S.WAVE]}`, WIDTH / 2, 14, COLOUR.muted, 1, 'center');
        if (cue && !scene[S.PRACTICE] && scene[S.STATE] !== 3) {
            ctx.globalAlpha = cue.alpha;
            px.text(cue.name.toUpperCase(), WIDTH / 2, 44, COLOUR.cyan, 1, 'center');
            ctx.globalAlpha = 1;
        }
    }
}
