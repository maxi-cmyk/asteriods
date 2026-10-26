import { S, BLOCKS, records } from '../../runtime/scene-layout.mjs';
import { WIDTH, COLOUR } from '../constants.mjs';
import { glow } from '../fx.mjs';

// The things that drift through the playfield. Each layer draws from `frame`:
// { ctx, px, scene, time, players, hulls, observer, reduced, bossArt, shake, cue }.

export class RockLayer {
    draw({ px, scene }) {
        for (const [i, rock] of records(scene, BLOCKS.ROCKS).entries()) {
            if (!rock[0]) continue;
            const size = rock[5],
                diameter = [32, 20, 12][size];
            const frame = ((Math.floor(rock[4] / (Math.PI / 4)) % 8) + 8) % 8;
            px.sprite(
                `rock-${size}-${i % 3}-${frame}`,
                rock[1] - diameter / 2,
                rock[2] - diameter / 2,
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
        for (const [owner, playerScene] of (players?.map((p) => p.scene) || [scene]).entries()) {
            for (const bullet of records(playerScene, BLOCKS.BULLETS)) {
                if (!bullet[0]) continue;
                const length = Math.hypot(bullet[3], bullet[4]) || 1;
                const dx = bullet[3] / length,
                    dy = bullet[4] / length;
                for (let pixel = 0; pixel < 6; pixel++) {
                    ctx.fillStyle =
                        pixel < 2
                            ? COLOUR.ink
                            : players
                              ? COOP_BULLET[owner]
                              : playerScene[S.MULTISHOT_MS] > 0
                                ? COLOUR.cyan
                                : COLOUR.amber;
                    ctx.fillRect(
                        Math.round(bullet[1] - dx * pixel),
                        Math.round(bullet[2] - dy * pixel),
                        owner === 1 ? 1 : 2,
                        2,
                    );
                }
                const tint = players
                    ? COOP_GLOW[owner]
                    : playerScene[S.MULTISHOT_MS] > 0
                      ? '112,217,237'
                      : '239,185,99';
                glow(ctx, bullet[1], bullet[2], 6, tint, 0.55);
                // A bullet still inside the muzzle zone gets a brief flash.
                if (
                    playerScene[S.SHIP_ALIVE] &&
                    Math.hypot(
                        bullet[1] - playerScene[S.SHIP_X],
                        bullet[2] - playerScene[S.SHIP_Y],
                    ) < 22
                )
                    glow(ctx, bullet[1], bullet[2], 9, '255,222,160', 0.8);
            }
        }
    }
}

export class ParticleLayer {
    draw({ ctx, scene }) {
        for (const particle of records(scene, BLOCKS.PARTICLES)) {
            if (!particle[0]) continue;
            ctx.fillStyle = particle[3] > 10 ? '#d8b890' : '#8a5a58';
            ctx.fillRect(Math.round(particle[1]), Math.round(particle[2]), 1, 1);
        }
    }
}
