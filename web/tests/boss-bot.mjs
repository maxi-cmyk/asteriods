import { S } from '../src/runtime/scene-layout.mjs';
// A scripted pilot for the boss tests: it reads the same scene the renderer reads,
// picks the sub-target a person would, keeps clear of every shot, lethal hazard and
// body, and fires at a human rate. It proves a fight is beatable and measures how
// long the fight takes; it is not a speed-run.
import {
    BOSS_AT,
    HAZARD,
    PART,
    SHOT,
    bossHazards,
    bossParts,
    bossPart,
    bossShots,
    bossState,
} from '../src/boss/scene.mjs';

const SPEED = 3.65625,
    SHIP = 7;
const wrap = (a) => {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
};
const SHOT_R = [2, 3, 3, 4, 2.5, 4, 5, 5, 18, 2, 2.5, 3];

export function hazardHits(h, px, py, r = SHIP) {
    const dx = px - h.x,
        dy = py - h.y;
    switch (h.kind) {
        case HAZARD.lane:
        case HAZARD.beam:
        case HAZARD.arm: {
            const ca = Math.cos(h.a),
                sa = Math.sin(h.a),
                along = dx * ca + dy * sa,
                across = -dx * sa + dy * ca;
            const len = h.kind === HAZARD.beam ? 520 : h.b;
            const half = h.kind === HAZARD.lane ? h.c : h.kind === HAZARD.beam ? 5 : 5 + r * 0.3;
            return along >= 0 && along <= len && Math.abs(across) < half + r;
        }
        case HAZARD.pool:
            return dx * dx + dy * dy < (h.c + r) ** 2;
        case HAZARD.ring: {
            const dist = Math.hypot(dx, dy);
            if (Math.abs(dist - h.b) >= 4 + r * 0.6) return false;
            return Math.abs(wrap(Math.atan2(dy, dx) - h.a)) >= h.c;
        }
        default:
            return false;
    }
}
const lethal = (h) => h.kind <= HAZARD.arm;

export class BossBot {
    constructor(game, { shotsPerSecond = 6, margin = 12 } = {}) {
        this.game = game;
        this.every = Math.max(1, Math.round(50 / shotsPerSecond));
        this.margin = margin;
        this.tick = 0;
        this.stats = { shots: 0 };
    }
    body() {
        const v = new Float32Array(
            this.game.api.memory.buffer,
            this.game.api.web_test_boss_body(),
            97,
        );
        return Array.from({ length: v[0] }, (_, i) => ({
            x: v[1 + i * 3],
            y: v[2 + i * 3],
            r: v[3 + i * 3],
        }));
    }
    // The point a player would shoot at, or null to hold fire.
    target(scene, boss, parts) {
        const { x, y, aux } = boss,
            ship = { x: scene[S.SHIP_X], y: scene[S.SHIP_Y] };
        const nearest = (list) =>
            list.sort(
                (a, b) =>
                    Math.hypot(a.x - ship.x, a.y - ship.y) - Math.hypot(b.x - ship.x, b.y - ship.y),
            )[0];
        switch (boss.kind) {
            case 0:
                return aux[0] > 0.5 ? { x, y } : null;
            case 6:
                return aux[0] > 0.5 ? { x, y } : null;
            case 1:
                return { x, y };
            case 7:
                return { x, y };
            case 2: {
                const panels = Array.from({ length: 8 }, (_, i) => bossPart(scene, i)).filter(
                    (p) => p.exists,
                );
                const windows = panels.filter((p) => p.state >= 1);
                const pick = windows.length
                    ? nearest(windows)
                    : nearest(panels.filter((p) => p.state === 0));
                return scene[BOSS_AT + 16 + 1] ? { x, y } : pick || { x, y };
            }
            case 8:
                return aux[1] > 0.5 ? { x, y } : null;
            case 3: {
                const hard = parts
                    .filter((p) => p.kind === PART.hard)
                    .sort((a, b) => a.slot - b.slot)[0];
                return hard || { x: x + 114, y: y + 2 };
            }
            case 9:
                return { x: x + 68, y };
            case 4: {
                const bubbles = parts.filter((p) => p.kind === PART.bubble);
                return bubbles.length ? nearest(bubbles) : { x, y: y - 37 };
            }
            case 10:
                return { x, y: y - 25 };
            case 5: {
                const stars = parts.filter((p) => p.kind === PART.star);
                if (aux[1] > 0.5 || !stars.length) return { x, y };
                return nearest(stars);
            }
            case 11:
                return aux[1] > 0.5 ? null : { x, y };
            default:
                return { x, y };
        }
    }
    // Danger of standing at (px, py) `ahead` ticks from now.
    danger(px, py, scene, boss, shots, hazards, body, ahead) {
        let cost = 0;
        if (px < 16 || px > 464 || py < 16 || py > 248) cost += 1e4;
        for (const s of shots) {
            const reach = SHOT_R[s.family] + SHIP + this.margin;
            const sx = s.x + Math.cos(s.angle) * speedOf(s) * ahead,
                sy = s.y + Math.sin(s.angle) * speedOf(s) * ahead;
            const d = Math.hypot(sx - px, sy - py);
            if (s.family === SHOT.lob) continue;
            if (d < reach) cost += (400 * (reach - d)) / reach + 80;
        }
        for (const h of hazards) {
            if (!lethal(h)) continue;
            const soon = h.warn > 0 ? h.warn < 700 + 20 * ahead : true;
            if (!soon) continue;
            for (const grow of [0, 7])
                if (hazardHits(h, px, py, SHIP + this.margin * 0.5 + grow)) {
                    cost += 600 + (grow ? 0 : 400);
                    break;
                }
        }
        for (const c of body) {
            const d = Math.hypot(c.x - px, c.y - py),
                reach = c.r + SHIP + this.margin;
            if (d < reach) cost += (1000 * (reach - d)) / reach + 200;
        }
        return cost;
    }
    step(input = {}) {
        const game = this.game,
            scene = game.scene(),
            boss = bossState(scene);
        if (!boss.active) {
            game.step({ ...input });
            this.tick++;
            return;
        }
        const parts = bossParts(scene),
            shots = bossShots(scene),
            hazards = bossHazards(scene),
            body = this.body();
        const sx = scene[S.SHIP_X],
            sy = scene[S.SHIP_Y];
        const tgt = this.target(scene, boss, parts);
        // Prefer a standing spot near x=110 and the target's height, away from the body.
        const home = { x: 110, y: tgt ? Math.max(40, Math.min(230, tgt.y)) : 135 };
        const here = this.danger(sx, sy, scene, boss, shots, hazards, body, 0);
        let best = null;
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
                const len = Math.hypot(dx, dy) || 1,
                    mx = (dx / len) * SPEED,
                    my = (dy / len) * SPEED;
                let cost = 0;
                for (const ahead of [1, 3, 6, 10, 15, 22]) {
                    const px = sx + mx * ahead,
                        py = sy + my * ahead;
                    cost += this.danger(
                        Math.max(16, Math.min(464, px)),
                        Math.max(16, Math.min(248, py)),
                        scene,
                        boss,
                        shots,
                        hazards,
                        body,
                        ahead,
                    );
                }
                const nx = sx + mx,
                    ny = sy + my;
                // Drift home only when nothing threatens; keep going the way we were going.
                if (!here)
                    cost +=
                        Math.hypot(nx - home.x, (ny - home.y) * 0.35) * 0.35 + (dx || dy ? 0.2 : 0);
                if (this.last && this.last.dx === dx && this.last.dy === dy) cost -= 3;
                if (!best || cost < best.cost) best = { cost, dx, dy };
            }
        this.last = best;
        let aimX = 1,
            aimY = 0,
            fire = false;
        if (tgt) {
            const ax = tgt.x - sx,
                ay = tgt.y - sy,
                len = Math.hypot(ax, ay) || 1;
            aimX = ax / len;
            aimY = ay / len;
            fire = this.tick % this.every === 0;
            if (fire) this.stats.shots++;
        }
        game.step({
            ...input,
            x: 2048 + Math.round(best.dx * 2047),
            y: 2048 + Math.round(best.dy * 2047),
            aimX,
            aimY,
            firePressed: fire,
            fire,
        });
        this.tick++;
    }
}
function speedOf(s) {
    switch (s.family) {
        case SHOT.needle:
            return 2.2;
        case SHOT.shard:
            return 1.6;
        case SHOT.fast:
            return 2.6;
        case SHOT.bolt:
            return 3;
        case SHOT.sine:
            return 1.8;
        case SHOT.pellet:
            return 1.7;
        case SHOT.missile:
            return 1.4;
        case SHOT.mine:
            return 0.8;
        case SHOT.spore:
            return 1;
        case SHOT.ember:
            return 2.4;
        case SHOT.curve:
            return 2;
        default:
            return 0;
    }
}
