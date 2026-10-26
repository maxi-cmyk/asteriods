import { pixelGlow as glow } from '../render/fx.mjs';
import { SHOT } from './scene.mjs';
import { px } from './draw-kit.mjs';

// One painter per hostile shot family: (ctx, art, shot, time, flicker) where `flicker`
// alternates 0/1 every 110 ms for two-frame sprites.
export const SHOT_PAINTERS = {
    [SHOT.needle]: (ctx, art, s) => art.draw(ctx, 'shots', 'needle', s.x, s.y),
    [SHOT.shard]: (ctx, art, s) => art.draw(ctx, 'shots', 'shard', s.x, s.y),
    [SHOT.fast]: (ctx, art, s) => art.drawRotated(ctx, 'shots', 'fast', s.x, s.y, s.angle),
    [SHOT.bolt](ctx, art, s) {
        art.drawRotated(ctx, 'shots', 'bolt', s.x, s.y, s.angle);
        glow(ctx, s.x, s.y, 8, '255,150,100', 0.35);
    },
    [SHOT.sine]: (ctx, art, s) => art.draw(ctx, 'shots', 'sine', s.x, s.y),
    [SHOT.pellet]: (ctx, art, s) => art.draw(ctx, 'shots', 'pellet', s.x, s.y),
    [SHOT.ember]: (ctx, art, s, time, flicker) =>
        art.draw(ctx, 'shots', `ember-${flicker}`, s.x, s.y),
    [SHOT.curve](ctx, art, s) {
        art.draw(ctx, 'shots', 'curve', s.x, s.y);
        glow(ctx, s.x, s.y, 7, '255,120,230', 0.35);
    },
    [SHOT.missile](ctx, art, s, time, flicker) {
        const tail = 8;
        ctx.fillStyle = flicker ? '#ffcf70' : '#ff8a3a';
        px(ctx, s.x - Math.cos(s.angle) * tail, s.y - Math.sin(s.angle) * tail, 2, 2);
        px(ctx, s.x - Math.cos(s.angle) * (tail + 3), s.y - Math.sin(s.angle) * (tail + 3), 1, 1);
        art.drawRotated(ctx, 'shots', 'missile', s.x, s.y, s.angle);
    },
    [SHOT.mine]: (ctx, art, s, time) =>
        art.draw(
            ctx,
            'shots',
            Math.floor(time / (s.age > 1400 ? 90 : 220)) % 2 ? 'mine-1' : 'mine-0',
            s.x,
            s.y,
        ),
    [SHOT.spore]: (ctx, art, s, time, flicker) =>
        art.draw(ctx, 'shots', `spore-${flicker}`, s.x, s.y, { alpha: 0.92 }),
    // Plasma arcs over the floor: a lifted sprite above its landing shadow.
    [SHOT.lob](ctx, art, s) {
        const life = Math.max(1, s.aux),
            lift = Math.sin(Math.min(1, s.age / life) * Math.PI) * 34;
        ctx.fillStyle = '#2a1030';
        px(ctx, s.x - 4, s.y + 1, 9, 2);
        art.draw(ctx, 'shots', 'lob-0', s.x, s.y - lift);
        glow(ctx, s.x, s.y - lift, 11, '255,110,40', 0.4);
    },
};
