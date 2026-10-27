import { S, BLOCKS } from '../../runtime/scene-layout.mjs';
import { WIDTH, COLOUR } from '../constants.mjs';
import { glow } from '../fx.mjs';

// The things that drift through the playfield. Each layer draws from `frame`:
// { ctx, px, scene, time, players, hulls, observer, reduced, bossArt, shake, cue }.

// Sprite names for every rock (size, look, spin frame), built once rather than per rock per frame.
const ROCK_SPRITES = Array.from({ length: 3 }, (_, size) =>
    Array.from({ length: 3 }, (_, look) =>
        Array.from({ length: 8 }, (_, frame) => `rock-${size}-${look}-${frame}`),
    ),
);
const ROCK_DIAMETER = [32, 20, 12];

// The layers below read the scene by index: it is the hot path, and a view per record would
// allocate dozens of typed arrays every frame.
export class RockLayer {
    draw({ px, scene }) {
        const { at, stride, count } = BLOCKS.ROCKS;
        for (let i = 0; i < count; i++) {
            const rock = at + i * stride;
            if (!scene[rock]) continue;
            const size = scene[rock + 5],
                diameter = ROCK_DIAMETER[size];
            const frame = ((Math.floor(scene[rock + 4] / (Math.PI / 4)) % 8) + 8) % 8;
            px.sprite(
                ROCK_SPRITES[size][i % 3][frame],
                scene[rock + 1] - diameter / 2,
                scene[rock + 2] - diameter / 2,
            );
        }
    }
}

// The notch on the right edge that says where the next rock will enter.
export class SpawnWarningLayer {
    draw({ ctx, px, scene }) {
        if (!scene[S.SPAWN_WARNING]) return;
        const y = Math.round(scene[S.SPAWN_Y]);
        ctx.fillStyle = scene[S.PENDING_FAST] ? COLOUR.hot : COLOUR.amber;
        if (scene[S.PENDING_FAST])
            px.text('FAST', WIDTH - 8, Math.max(0, y - 14), COLOUR.hot, 1, 'right');
        for (let i = 0; i < 4; i++) ctx.fillRect(WIDTH - 2 - i, y - i, 1, i * 2 + 1);
    }
}

export class PickupLayer {
    draw({ ctx, px, scene, time }) {
        if (scene[S.PICKUP_ACTIVE]) {
            glow(
                ctx,
                scene[S.PICKUP_X],
                scene[S.PICKUP_Y],
                11,
                scene[S.PICKUP_KIND] === 0 ? '239,185,99' : '110,240,255',
                0.45 + 0.15 * Math.sin(time / 180),
            );
            if (scene[S.PICKUP_KIND] === 2) {
                px.box(
                    Math.round(scene[S.PICKUP_X]) - 8,
                    Math.round(scene[S.PICKUP_Y]) - 7,
                    17,
                    15,
                    COLOUR.cyan,
                );
                px.text('2X', scene[S.PICKUP_X], scene[S.PICKUP_Y] - 3, COLOUR.cyan, 1, 'center');
            } else
                px.sprite(
                    scene[S.PICKUP_KIND] === 0 ? 'multishot' : 'shield',
                    scene[S.PICKUP_X] - 6,
                    scene[S.PICKUP_Y] - 6,
                );
        }
        // The ring that marks a pickup being collected.
        if (scene[S.COLLECT_CUE_MS]) {
            const radius = 8 + Math.floor((400 - scene[S.COLLECT_CUE_MS]) / 80);
            px.box(
                Math.round(scene[S.COLLECT_X]) - radius,
                Math.round(scene[S.COLLECT_Y]) - radius,
                radius * 2 + 1,
                radius * 2 + 1,
                COLOUR.cyan,
            );
        }
    }
}

const COOP_BULLET = ['#70d9ed', '#efb963'];
const COOP_GLOW = ['112,217,237', '239,185,99'];

// Each player's bullets in their own colour (co-op) or by weapon state (solo).
export class BulletLayer {
    draw({ ctx, scene, players }) {
        const { at, stride, count } = BLOCKS.BULLETS;
        for (let owner = 0; owner < (players ? players.length : 1); owner++) {
            const playerScene = players ? players[owner].scene : scene;
            const body = players
                ? COOP_BULLET[owner]
                : playerScene[S.MULTISHOT_MS] > 0
                  ? COLOUR.cyan
                  : COLOUR.amber;
            for (let i = 0; i < count; i++) {
                const bullet = at + i * stride;
                if (!playerScene[bullet]) continue;
                const x = playerScene[bullet + 1],
                    y = playerScene[bullet + 2],
                    vx = playerScene[bullet + 3],
                    vy = playerScene[bullet + 4];
                const length = Math.hypot(vx, vy) || 1;
                const dx = vx / length,
                    dy = vy / length;
                // Two bright pixels at the head, then the tail in the bullet's colour.
                ctx.fillStyle = COLOUR.ink;
                for (let pixel = 0; pixel < 2; pixel++)
                    ctx.fillRect(
                        Math.round(x - dx * pixel),
                        Math.round(y - dy * pixel),
                        owner === 1 ? 1 : 2,
                        2,
                    );
                ctx.fillStyle = body;
                for (let pixel = 2; pixel < 6; pixel++)
                    ctx.fillRect(
                        Math.round(x - dx * pixel),
                        Math.round(y - dy * pixel),
                        owner === 1 ? 1 : 2,
                        2,
                    );
                const tint = players
                    ? COOP_GLOW[owner]
                    : playerScene[S.MULTISHOT_MS] > 0
                      ? '112,217,237'
                      : '239,185,99';
                glow(ctx, x, y, 6, tint, 0.55);
                // A bullet still inside the muzzle zone gets a brief flash.
                if (
                    playerScene[S.SHIP_ALIVE] &&
                    Math.hypot(x - playerScene[S.SHIP_X], y - playerScene[S.SHIP_Y]) < 22
                )
                    glow(ctx, x, y, 9, '255,222,160', 0.8);
            }
        }
    }
}

export class ParticleLayer {
    draw({ ctx, scene }) {
        const { at, stride, count } = BLOCKS.PARTICLES;
        let colour = '';
        for (let i = 0; i < count; i++) {
            const particle = at + i * stride;
            if (!scene[particle]) continue;
            const next = scene[particle + 3] > 10 ? '#d8b890' : '#8a5a58';
            if (next !== colour) ctx.fillStyle = colour = next;
            ctx.fillRect(Math.round(scene[particle + 1]), Math.round(scene[particle + 2]), 1, 1);
        }
    }
}
