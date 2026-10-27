// The autopilot for the Home demo. It flies a real run: it reads the scene the renderer reads,
// dodges rocks, shoots them, fights every boss with the same steering the boss tests use
// (boss-pilot.mjs), picks up power-ups and spends the shield and laser, and feeds the engine the
// inputs a person would. Nothing here touches the engine's state; it only returns inputs.
import { S, BLOCKS } from '../runtime/scene-layout.mjs';
import { bossHazards, bossParts, bossShots, bossState } from '../boss/scene.mjs';
import { BossPilot } from './boss-pilot.mjs';

const SHIP = 7,
    WIDTH = 480,
    BULLET_SPEED = 18.75,
    FIRE_EVERY = 6, // ticks between shots: eight a second
    ROCK_MARGIN = 9,
    HOME_X = 110,
    LASER_HOLD_TICKS = 80, // the charge takes 1.5 s (75 ticks)
    LASER_MIN_ROCKS = 4,
    LASER_ABORT_DANGER = 120;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export class Pilot {
    constructor(game) {
        this.game = game;
        this.rocks = [];
        this.tick = 0;
        this.laserTicks = 0;
        this.boss = new BossPilot(game, {
            margin: 12,
            extraDanger: (px, py, ahead) => this.rockDanger(px, py, ahead),
        });
    }
    // Every live rock as { x, y, r, vx, vy }, read straight from the scene.
    #readRocks(scene) {
        const { at, stride, count } = BLOCKS.ROCKS;
        const rocks = [];
        for (let i = 0; i < count; i++) {
            const rock = at + i * stride;
            if (!scene[rock]) continue;
            rocks.push({
                x: scene[rock + 1],
                y: scene[rock + 2],
                r: scene[rock + 3],
                vx: scene[rock + 6],
                vy: scene[rock + 7],
            });
        }
        return rocks;
    }
    // The cost of standing at (px, py) `ahead` ticks from now, given where the rocks are heading.
    rockDanger(px, py, ahead) {
        let cost = 0;
        for (const rock of this.rocks) {
            const d = Math.hypot(rock.x + rock.vx * ahead - px, rock.y + rock.vy * ahead - py);
            const reach = rock.r + SHIP + ROCK_MARGIN;
            if (d < reach) cost += (500 * (reach - d)) / reach + 150;
        }
        return cost;
    }
    // The rock worth shooting next: the closest ahead of the ship, nearer lanes first.
    #rockTarget(sx, sy) {
        let best = null,
            bestScore = Infinity;
        for (const rock of this.rocks) {
            if (rock.x < sx + 14 || rock.x > WIDTH) continue;
            const score = rock.x - sx + Math.abs(rock.y - sy) * 0.6;
            if (score < bestScore) {
                best = rock;
                bestScore = score;
            }
        }
        if (!best) return null;
        // Bullets are quick, but a rock still drifts a little while one is in flight.
        const flight = Math.hypot(best.x - sx, best.y - sy) / BULLET_SPEED;
        return { x: best.x + best.vx * flight, y: best.y + best.vy * flight };
    }
    // The inputs for this tick, as Runtime.step takes them.
    decide(scene) {
        this.tick++;
        const sx = scene[S.SHIP_X],
            sy = scene[S.SHIP_Y];
        this.rocks = this.#readRocks(scene);
        const state = bossState(scene);
        let shots = [],
            hazards = [],
            body = [],
            target = null;
        if (state.active) {
            shots = bossShots(scene);
            hazards = bossHazards(scene);
            body = this.boss.body();
            target = this.boss.target(scene, state, bossParts(scene));
        }
        const rockTarget = this.#rockTarget(sx, sy);
        target ??= rockTarget;
        // Stand back from the action at the target's height, or go and fetch a power-up.
        let home = { x: HOME_X, y: target ? clamp(target.y, 40, 230) : 135 };
        if (scene[S.PICKUP_ACTIVE] && scene[S.PICKUP_X] < WIDTH - 40)
            home = { x: scene[S.PICKUP_X], y: scene[S.PICKUP_Y] };
        const move = this.boss.steer(scene, { shots, hazards, body }, home);

        let aimX = 1,
            aimY = 0,
            fire = false;
        if (target) {
            const ax = target.x - sx,
                ay = target.y - sy,
                length = Math.hypot(ax, ay) || 1;
            aimX = ax / length;
            aimY = ay / length;
            fire = this.tick % FIRE_EVERY === 0 && length < WIDTH + 40;
        }
        // The laser: when it is ready and rocks are bunched up, hold the trigger through the
        // charge; let go if the way gets dangerous (charging blocks the gun).
        const charging = scene[S.CHARGING] > 0;
        if (!this.laserTicks && !charging) {
            const ready = scene[S.LASER_COOLDOWN_MS] === 0 && !state.active;
            const ahead = this.rocks.filter((rock) => rock.x > sx + 40 && rock.x < WIDTH).length;
            if (ready && ahead >= LASER_MIN_ROCKS && move.cost < LASER_ABORT_DANGER)
                this.laserTicks = LASER_HOLD_TICKS;
        }
        if (this.laserTicks && move.cost >= LASER_ABORT_DANGER) this.laserTicks = 0;
        const laser = this.laserTicks > 0;
        if (laser) {
            this.laserTicks--;
            fire = false;
        }
        // A stored shield is for when a hit is about to land.
        const shield = !!scene[S.SHIELD_STORED] && move.cost > 300;

        return {
            x: 2048 + Math.round(move.dx * 2047),
            y: 2048 + Math.round(move.dy * 2047),
            aimX,
            aimY,
            firePressed: fire,
            fire,
            laser,
            shield,
        };
    }
}
