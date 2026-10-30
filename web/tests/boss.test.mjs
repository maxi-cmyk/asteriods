import { S } from '../src/runtime/scene-layout.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRuntime } from '../src/runtime/runtime.mjs';
import { BossBot } from './boss-bot.mjs';
import {
    ATTACK,
    HAZARD,
    KINDS,
    PART,
    SHOT,
    bossHazards,
    bossParts,
    bossPart,
    bossShots,
    bossState,
} from '../src/boss/scene.mjs';
const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
const set = (game, field, value) => game.api.web_test_boss_set(field, value);
const K = [3, 6, 7, 5, 5, 4, 5, 8, 5, 8, 8, 6]; // sub-hits per design hit, mirrors BOSS_K
const ENTRANCE = 75; // ticks: 1.4 s plus a margin
async function newGame(seed = 7) {
    let state = seed;
    return createRuntime(bytes, {
        random: () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0),
    });
}
// A scored wave fight in a clean room (rocks cleared, ship centred left).
async function waveGame(wave, players = 1, health = 0, seed = 7) {
    const game = await newGame(seed);
    game.start();
    game.api.web_scenario(0);
    game.api.web_test_boss(wave, players, health);
    set(game, 5, 1e6); // tests that need hits clear this
    return game;
}
async function practiceGame(kind, tier = 0, seed = 7) {
    const game = await newGame(seed);
    game.start(true);
    game.api.web_boss_practice(kind, tier, 0);
    return game;
}
const ticks = (game, count, input = {}) => {
    for (let i = 0; i < count; i++) game.step(input);
};
const until = (game, test, limit = 2000, input = () => ({})) => {
    for (let i = 0; i < limit; i++) {
        if (test(bossState(game.scene()), game.scene())) return i;
        game.step(input());
    }
    throw new Error('condition not reached');
};
const stats = (game) => {
    const v = new Float32Array(game.api.memory.buffer, game.api.web_test_boss_stats(), 16);
    return {
        violations: v[0],
        maxShots: v[1],
        maxHazards: v[2],
        entranceHits: v[3],
        corridor: v[4],
        hitsTaken: v[5],
        health: v[6],
        phase: v[7],
        mask: v[8],
        kind: v[9],
        lifeLost: v[10],
        maximum: v[11],
    };
};
const body = (game) => {
    const v = new Float32Array(game.api.memory.buffer, game.api.web_test_boss_body(), 97);
    return Array.from({ length: v[0] }, (_, i) => ({
        x: v[1 + i * 3],
        y: v[2 + i * 3],
        r: v[3 + i * 3],
    }));
};
// Aim from a spot level with the target and fire single shots into it.
function shoot(game, target, count, { from = 80 } = {}) {
    set(game, 3, Math.max(20, target.x - from));
    set(game, 4, target.y);
    let fired = 0;
    for (let i = 0; i < count * 3 && fired < count; i++) {
        const s = game.scene(),
            dx = target.x - s[4],
            dy = target.y - s[5],
            len = Math.hypot(dx, dy) || 1;
        const press = i % 3 === 0;
        if (press) fired++;
        game.step({
            aimX: dx / len,
            aimY: dy / len,
            firePressed: press,
            fire: press,
            x: 2048,
            y: 2048,
        });
    }
    ticks(game, 3);
}

test('every wave fight maps to its boss, its health and its tier', async () => {
    const base = (wave) => 18 + 6 * (Math.min(10, wave / 5) - 1);
    for (const [wave, kind] of [
        [5, 0],
        [10, 1],
        [15, 2],
        [20, 3],
        [25, 4],
        [30, 5],
        [35, 0],
        [60, 5],
        [65, 0],
    ]) {
        const tier = Math.floor((wave / 5 - 1) / 6);
        for (const players of [1, 2]) {
            const game = await waveGame(wave, players);
            const state = bossState(game.scene());
            assert.equal(state.kind, kind, `wave ${wave}`);
            assert.equal(state.tier, tier);
            assert.equal(state.mini, false);
            const designed = tier >= 1 ? Math.floor((base(wave) * 12) / 10) : base(wave);
            assert.equal(state.maximum, designed * K[kind] * players, `wave ${wave} x${players}`);
        }
    }
    for (const [wave, kind] of [
        [3, 6],
        [8, 7],
        [13, 8],
        [18, 9],
        [23, 10],
        [28, 11],
        [33, 6],
    ]) {
        const game = await waveGame(wave);
        const state = bossState(game.scene());
        assert.equal(state.kind, kind, `mini wave ${wave}`);
        assert.equal(state.mini, true);
        const region = kind - 6,
            tier = Math.floor((wave - 3) / 5 / 6),
            designed = (6 + 2 * region) * (tier >= 1 ? 12 / 10 : 1);
        assert.equal(state.maximum, Math.floor(designed) * K[kind]);
    }
});

test('the entrance is harmless for 1.4 s and then the body hurts', async () => {
    const game = await waveGame(5);
    set(game, 3, 330);
    set(game, 4, 135);
    set(game, 5, 0);
    ticks(game, 60);
    assert.equal(game.scene()[S.LIVES], 3);
    assert.equal(stats(game).entranceHits, 0);
    assert(bossState(game.scene()).entrance < 1);
    // Shots pass through an unfinished entrance without scratching it.
    const hp = bossState(game.scene()).health;
    ticks(game, 5, { aimX: 1, firePressed: true });
    assert.equal(bossState(game.scene()).health, hp);
    ticks(game, 20);
    assert.equal(game.state, 'death');
});

test('the Sentinel only takes damage while its plates are open', async () => {
    const game = await waveGame(5);
    ticks(game, ENTRANCE + 30); // rest ends, the first lance begins
    const target = () => ({ x: bossState(game.scene()).x, y: bossState(game.scene()).y });
    until(game, (state) => state.attack === ATTACK.lance && state.gate < 0.2);
    const hp = bossState(game.scene()).health;
    shoot(game, target(), 4);
    assert.equal(bossState(game.scene()).health, hp, 'closed plates absorb shots');
    until(game, (state) => state.attack === 0 && state.gate > 0.9);
    shoot(game, target(), 3);
    assert(bossState(game.scene()).health < hp, 'open plates take damage');
});

test('the laser is one 8-point hit on an open boss and cannot repeat on a hold', async () => {
    const game = await waveGame(5);
    set(game, 3, 100);
    set(game, 4, 135);
    for (let i = 0; i < 76; i++) {
        const scene = game.scene(),
            dx = 366 - scene[S.SHIP_X],
            dy = 135 - scene[S.SHIP_Y],
            length = Math.hypot(dx, dy);
        game.step({ y: 0, laser: true, aimX: dx / length, aimY: dy / length });
    }
    assert.equal(game.state, 'playing');
    assert.equal(game.scene()[S.LIVES], 3);
    assert.equal(bossState(game.scene()).health, 54 - 8 * K[0]);
    assert.equal(game.stats().laserShots, 1);
    ticks(game, 15, { laser: true, aimX: 1 });
    assert.equal(bossState(game.scene()).health, 54 - 8 * K[0]);
});

test('dying never resets the boss; threats are cleared and the ship returns protected', async () => {
    const game = await waveGame(5);
    ticks(game, ENTRANCE + 50);
    const hp = bossState(game.scene()).health,
        wave = bossState(game.scene()).wave;
    set(game, 1, hp - 5); // a wounded boss
    const wounded = bossState(game.scene()).health;
    set(game, 5, 0);
    game.api.web_test_overlap();
    ticks(game, 3);
    assert.equal(game.state, 'death');
    assert.equal(bossShots(game.scene()).length, 0);
    assert(bossHazards(game.scene()).every((h) => h.kind > HAZARD.arm));
    until(game, (_, scene) => scene[S.STATE] === 2 && scene[S.SHIP_ALIVE] === 1, 400);
    const back = bossState(game.scene());
    assert(back.active);
    assert.equal(back.health, wounded);
    assert.equal(back.wave, wave);
    assert(game.scene()[S.INVINCIBLE_MS] > 0, 'respawn protection');
});

test('a flawless fight pays 50% more, losing a life pays the base', async () => {
    for (const flawless of [true, false]) {
        const game = await waveGame(5, 1, 1);
        ticks(game, ENTRANCE);
        set(game, 5, flawless ? 1e6 : 0);
        if (!flawless) {
            set(game, 5, 0);
            game.api.web_test_overlap();
            ticks(game, 3);
            until(game, (_, s) => s[0] === 2 && s[6] === 1, 400);
        }
        const before = game.scene()[S.SCORE];
        until(game, (state) => state.attack === 0 && state.gate > 0.9, 800);
        const s = bossState(game.scene());
        shoot(game, { x: s.x, y: s.y }, 3);
        ticks(game, 40);
        assert.equal(bossState(game.scene()).active, false);
        assert.equal(game.scene()[S.BOSS_KILLS], 1);
        assert.equal(game.scene()[S.SCORE] - before, flawless ? 2625 : 1750);
        assert.equal(game.scene()[S.RUN_DESTROYED], 0, 'boss kills never count as asteroids');
        assert.equal(game.scene()[S.WAVE], 5);
        ticks(game, 20);
        assert.equal(game.scene()[S.WAVE], 5);
        // The overlap rock the unflawless run spawned sits still forever, so only check clean runs.
        if (flawless) {
            ticks(game, 700);
            assert(game.scene()[S.WAVE] >= 6);
        }
    }
});

test('a mini-boss shares its wave with half the rocks and holds the wave open', async () => {
    const game = await waveGame(3);
    assert.equal(bossState(game.scene()).mini, true);
    ticks(game, 50 * 30); // rocks all gone, wave must wait
    assert.equal(game.scene()[S.WAVE], 3);
    assert(bossState(game.scene()).active);
    const hp = 1;
    set(game, 1, hp);
    until(game, (state) => state.attack === 0 && state.gate > 0.9, 800);
    const s = bossState(game.scene());
    shoot(game, { x: s.x, y: s.y }, 3);
    ticks(game, 10);
    assert.equal(bossState(game.scene()).active, false);
    ticks(game, 300);
    assert(game.scene()[S.WAVE] >= 4, 'the wave moves on once the mini is down');
    assert.equal(bossState(game.scene()).defeated & (1 << 6), 1 << 6);
});

const HEALTH = 3; // PICKUP_HEALTH
// Takes the boss down in one blow and returns the pickup it left, if any.
function defeat(game) {
    ticks(game, ENTRANCE);
    set(game, 0, 0);
    ticks(game, 2);
    assert.equal(bossState(game.scene()).active, false);
    const scene = game.scene();
    return scene[S.PICKUP_ACTIVE]
        ? { kind: scene[S.PICKUP_KIND], x: scene[S.PICKUP_X], y: scene[S.PICKUP_Y] }
        : null;
}

test('every boss leaves exactly one health pickup, and flying through it restores a life', async () => {
    const game = await waveGame(5);
    const drop = defeat(game);
    assert.equal(drop?.kind, HEALTH);
    const lives = game.scene()[S.LIVES];
    set(game, 3, drop.x);
    set(game, 4, drop.y);
    ticks(game, 3);
    assert.equal(game.scene()[S.PICKUP_ACTIVE], 0);
    assert.equal(game.scene()[S.LIVES], lives + 1);
});

test('a mini-boss leaves a health pickup about half the time', async () => {
    let drops = 0;
    const runs = 24;
    for (let seed = 1; seed <= runs; seed++) {
        const game = await waveGame(3, 1, 0, seed);
        if (defeat(game)?.kind === HEALTH) drops++;
    }
    assert(drops > 3 && drops < runs - 3, `${drops} of ${runs} mini-bosses dropped health`);
});

test('boss practice drops no health', async () => {
    const game = await practiceGame(0);
    assert.equal(defeat(game), null);
});

test('practice and a fresh retry do not inherit a previous boss', async () => {
    const game = await waveGame(5);
    game.start(true);
    ticks(game, 100);
    assert.equal(game.scene()[S.BOSS_ACTIVE], 0);
    assert.equal(game.scene()[S.BOSS_KILLS], 0);
    game.start();
    ticks(game, 80);
    assert.equal(game.scene()[S.BOSS_ACTIVE], 0);
});

test('boss practice never costs a life and reports hits taken', async () => {
    const game = await practiceGame(2);
    ticks(game, ENTRANCE);
    set(game, 3, 300);
    set(game, 4, 135);
    set(game, 5, 0);
    ticks(game, 60);
    assert.equal(game.scene()[S.LIVES], 3);
    assert.equal(game.state, 'playing');
    assert(stats(game).hitsTaken > 0);
    assert.equal(bossState(game.scene()).practice, true);
});

test('multishot plus 2x fire keeps per-projectile accounting while damaging the boss', async () => {
    const game = await waveGame(5);
    ticks(game, ENTRANCE);
    until(game, (state) => state.attack === 0 && state.gate > 0.9, 800);
    game.api.web_test_pickup(0);
    game.step();
    game.api.web_test_pickup(2);
    game.step();
    set(game, 3, 100);
    set(game, 4, 135);
    game.step({ firePressed: true, aimX: 1 });
    ticks(game, 5);
    ticks(game, 50, { y: 0 });
    assert.equal(game.stats().spawned, 6);
    assert(game.stats().hits >= 1);
    assert(game.stats().hits <= 6);
    assert(bossState(game.scene()).health < 54);
    assert.equal(game.scene()[S.BOSS_KILLS], 0);
});

test('stored shield absorbs a boss lance and holds cannot cause repeated life loss', async () => {
    const game = await waveGame(5);
    set(game, 5, 0);
    game.api.web_test_pickup(1);
    game.step({ shield: true });
    set(game, 3, 150);
    set(game, 4, 135);
    ticks(game, 175);
    assert.equal(game.scene()[S.LIVES], 3);
    assert.equal(game.scene()[S.SHIELD], 0, 'the shield took the lance');
});

test('assists lengthen telegraphs by 30% and calm the lens bend', async () => {
    const lance = async (long) => {
        const game = await waveGame(5);
        game.api.web_boss_assist(long, 0);
        until(game, (state) => bossHazards(game.scene()).some((h) => h.kind === HAZARD.lane), 600);
        return bossHazards(game.scene()).find((h) => h.kind === HAZARD.lane).warnTotal;
    };
    assert.equal(await lance(0), 900);
    assert.equal(await lance(1), 1170);
});

test('boss pickups arrive once per phase boundary', async () => {
    const game = await waveGame(15); // Cinderforge: three phases (Ringwarden has timed shields)
    ticks(game, ENTRANCE);
    const max = bossState(game.scene()).maximum;
    set(game, 0, Math.ceil(max * 0.4)); // below 66%
    ticks(game, 2);
    assert.equal(game.scene()[S.PICKUP_ACTIVE], 1);
    assert.equal(game.scene()[S.PICKUP_KIND], 1);
    assert.equal(bossState(game.scene()).stage, 2);
});

test('every fight keeps its promises: warnings, caps, corridor, entrance, body room', async () => {
    for (const kind of KINDS.keys()) {
        for (const tier of [0, 1, 2]) {
            const game = await practiceGame(kind, tier, 100 + kind);
            const bot = new BossBot(game);
            let steps = 0,
                minLeft = 999;
            for (; steps < 150 * 50; steps++) {
                bot.step();
                const scene = game.scene();
                if (!scene[S.BOSS_ACTIVE] && steps > 100) break;
                if (scene[S.BOSS_STAGE] > 0 && steps % 25 === 0)
                    for (const [i, c] of body(game).entries()) {
                        if (kind === 5 && i > 0) continue; // the S-stars are satellites, not the body
                        minLeft = Math.min(minLeft, c.x - c.r);
                    }
            }
            const s = stats(game),
                name = `${KINDS[kind].name} tier ${tier}`;
            assert.equal(s.violations, 0, `${name}: lethal hazard without its warning`);
            assert(s.maxShots <= 48, `${name}: ${s.maxShots} shots`);
            assert(s.maxHazards <= 6, `${name}: ${s.maxHazards} hazards`);
            assert.equal(s.entranceHits, 0, `${name}: entrance`);
            assert(s.corridor >= 42, `${name}: corridor ${s.corridor}`);
            assert(minLeft >= 216 - 1, `${name}: body reaches x=${minLeft}`);
            assert.equal(bossState(game.scene()).active, false, `${name}: not beaten in 150 s`);
        }
    }
});

test('tiers shorten rests and tier II adds a frenzy phase', async () => {
    const game = await practiceGame(1, 2);
    ticks(game, ENTRANCE);
    const max = bossState(game.scene()).maximum;
    assert.equal(max, Math.floor((24 * 12) / 10) * K[1]);
    set(game, 0, Math.floor(max * 0.1));
    ticks(game, 2);
    assert.equal(bossState(game.scene()).stage, 4, 'a fourth phase at 15% health');
});

test('the Ringwarden: blades absorb shots and break, the core only takes what gets through', async () => {
    const game = await practiceGame(1);
    ticks(game, ENTRANCE);
    const blade = bossParts(game.scene()).find((p) => p.kind === PART.blade && p.slot < 16);
    const hp = bossState(game.scene()).health;
    shoot(game, blade, 1);
    assert.equal(bossPart(game.scene(), blade.index).exists, false);
    assert.equal(bossState(game.scene()).health, hp);
    ticks(game, 50 * 6.5);
    assert.equal(
        bossPart(game.scene(), blade.index).exists,
        true,
        'blades regrow after six seconds',
    );
});

test('the Cinderforge: shell blocks, a panel breaks after three hits and becomes a window', async () => {
    const game = await practiceGame(2);
    ticks(game, ENTRANCE);
    const hp = bossState(game.scene()).health;
    const panel = bossPart(game.scene(), 2);
    shoot(game, panel, 2);
    assert.equal(bossPart(game.scene(), 2).state, 0);
    shoot(game, bossPart(game.scene(), 2), 1);
    assert.equal(bossPart(game.scene(), 2).state, 2);
    assert.equal(
        bossState(game.scene()).health,
        hp,
        'breaking a panel hurts the panel, not the boss',
    );
    shoot(game, bossPart(game.scene(), 2), 2);
    assert(bossState(game.scene()).health < hp, 'a broken panel is a window');
});

test('the Bastion: hardpoints fall at six hits, the bridge takes half until they do', async () => {
    const game = await practiceGame(3);
    ticks(game, ENTRANCE);
    const bridge = () => ({ x: bossState(game.scene()).x + 114, y: bossState(game.scene()).y + 2 });
    const hp = bossState(game.scene()).health;
    shoot(game, bridge(), 4, { from: 60 });
    assert.equal(hp - bossState(game.scene()).health, 2, 'four shots, half damage');
    for (const [i, slot] of [
        [0, 0],
        [1, 1],
        [2, 2],
    ]) {
        const part = () => bossPart(game.scene(), slot);
        shoot(game, part(), 6, { from: 60 });
        assert.equal(part().exists, false, `hardpoint ${i} destroyed`);
    }
    const h2 = bossState(game.scene()).health;
    shoot(game, bridge(), 2, { from: 60 });
    assert.equal(h2 - bossState(game.scene()).health, 2, 'full damage once they are gone');
    ticks(game, 50 * 8.5);
    assert.equal(
        bossParts(game.scene()).filter((p) => p.kind === PART.hard).length,
        3,
        'rebuilt once after eight seconds',
    );
});

test('the Tidecaller: the bubble shield, and a laser that pops all three', async () => {
    const game = await practiceGame(4);
    ticks(game, ENTRANCE);
    const bell = () => ({ x: bossState(game.scene()).x, y: bossState(game.scene()).y - 37 });
    const hp = bossState(game.scene()).health;
    shoot(game, bell(), 3, { from: 120 });
    assert.equal(bossState(game.scene()).health, hp, 'the bell takes no damage under a bubble');
    set(game, 3, 60);
    set(game, 4, bell().y);
    for (let i = 0; i < 80; i++) {
        const s = game.scene(),
            b = bell(),
            dx = b.x - s[4],
            dy = b.y - s[5],
            l = Math.hypot(dx, dy);
        game.step({ laser: true, aimX: dx / l, aimY: dy / l, x: 2048, y: 2048 });
    }
    assert.equal(bossParts(game.scene()).filter((p) => p.kind === PART.bubble).length, 0);
    assert(bossState(game.scene()).health < hp);
});

test('the Horizon Warden: plates absorb shots outside the window', async () => {
    const game = await practiceGame(5);
    ticks(game, ENTRANCE);
    const centre = () => ({ x: bossState(game.scene()).x, y: bossState(game.scene()).y });
    until(game, (state) => state.aux[1] < 0.5, 500);
    const hp = bossState(game.scene()).health;
    shoot(game, centre(), 3, { from: 160 });
    assert.equal(bossState(game.scene()).health, hp);
    until(game, (state) => state.aux[1] > 0.5, 700);
    shoot(game, centre(), 3, { from: 160 });
    assert(bossState(game.scene()).health < hp, 'the window opens the core');
});

test('shootable projectiles: missiles take two shots, lobs split into embers and cancel their pool', async () => {
    const gunnery = await practiceGame(9);
    until(
        gunnery,
        () => bossShots(gunnery.scene()).some((s) => s.family === SHOT.missile),
        900,
        () => ({ x: 2048, y: 2048 }),
    );
    const missile = bossShots(gunnery.scene()).find((s) => s.family === SHOT.missile);
    shoot(gunnery, missile, 1, { from: 30 });
    assert.equal(
        bossShots(gunnery.scene()).some((s) => s.family === SHOT.missile && s.hp === 1),
        true,
        'two hit points',
    );
    shoot(
        gunnery,
        bossShots(gunnery.scene()).find((s) => s.family === SHOT.missile),
        1,
        { from: 30 },
    );
    assert.equal(
        bossShots(gunnery.scene()).some((s) => s.family === SHOT.missile),
        false,
    );
    const ling = await practiceGame(8);
    until(
        ling,
        () => bossShots(ling.scene()).some((s) => s.family === SHOT.lob),
        900,
        () => ({ x: 2048, y: 2048 }),
    );
    assert.equal(
        bossHazards(ling.scene()).filter((h) => h.kind === HAZARD.pool).length,
        1,
        'the landing marker is up',
    );
    const lob = bossShots(ling.scene()).find((s) => s.family === SHOT.lob);
    shoot(ling, lob, 1, { from: 30 });
    assert.equal(
        bossShots(ling.scene()).filter((s) => s.family === SHOT.ember).length >= 3,
        true,
        'three slow embers',
    );
    assert.equal(
        bossHazards(ling.scene()).filter((h) => h.kind === HAZARD.pool).length,
        0,
        'the pool is cancelled',
    );
});

test('boss practice can start in a later phase, frenzy included', async () => {
    const game = await newGame();
    game.start(true);
    game.api.web_boss_practice(1, 0, 3);
    ticks(game, ENTRANCE);
    assert.equal(bossState(game.scene()).stage, 3);
    const max = bossState(game.scene()).maximum;
    assert(bossState(game.scene()).health <= Math.floor(max * 0.33) + 1);
    const frenzy = await newGame();
    frenzy.start(true);
    frenzy.api.web_boss_practice(2, 2, 4);
    ticks(frenzy, ENTRANCE);
    assert.equal(bossState(frenzy.scene()).stage, 4);
});

// Shield spawn times (seconds into the fight) over `seconds` of an untouched fight.
function shieldDrops(game, seconds) {
    const times = [];
    let was = false;
    const start = game.scene()[S.GAME_MS];
    for (let i = 0; i < seconds * 50; i++) {
        game.step({});
        const scene = game.scene();
        const fresh = scene[S.PICKUP_ACTIVE] && scene[S.PICKUP_X] > 440;
        if (fresh && !was) times.push((scene[S.GAME_MS] - start) / 1000);
        was = fresh;
    }
    return times;
}

test('Ringwarden alone drops a shield every 7 seconds', async () => {
    const ringwarden = await waveGame(10);
    const drops = shieldDrops(ringwarden, 36);
    assert(drops.length >= 4, `drops: ${drops}`);
    drops.slice(1).forEach((t, i) => assert(Math.abs(t - drops[i] - 7) < 0.1, `gap ${drops}`));
    // The first fight of the run (Sentinel) and the later bosses keep their phase-based drops.
    for (const wave of [5, 15, 20]) {
        const other = await waveGame(wave);
        assert.equal(shieldDrops(other, 22).length, 0, `wave ${wave} drops nothing in phase 1`);
    }
});

// A practice fight that starts in `phase`, with the pilot untouchable.
async function phaseGame(kind, phase, seed = 7) {
    const game = await newGame(seed);
    game.start(true);
    game.api.web_boss_practice(kind, 0, phase);
    set(game, 5, 1e6);
    return game;
}
const ENTRANCE_TICKS = ENTRANCE;
const angleError = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test('the Warden mirror throws shots back at the pilot instead of taking them', async () => {
    const game = await phaseGame(5, 2);
    ticks(game, ENTRANCE_TICKS);
    until(game, (state) => state.aux[5] > 0.75, 3000);
    const hp = bossState(game.scene()).health;
    const centre = { x: bossState(game.scene()).x, y: bossState(game.scene()).y };
    shoot(game, centre, 1, { from: 150 });
    ticks(game, 3);
    const scene = game.scene();
    assert.equal(bossState(scene).health, hp, 'the core takes nothing through the mirror');
    const back = bossShots(scene).filter((s) => s.family === SHOT.fast);
    assert(back.length >= 1, 'a shot comes back');
    for (const s of back)
        assert(
            angleError(s.angle, Math.atan2(scene[S.SHIP_Y] - s.y, scene[S.SHIP_X] - s.x)) < 0.2,
            'and it is aimed at the pilot who fired',
        );
    // Held fire does not stack: shots within 260 ms of a return are absorbed.
    const count = bossShots(game.scene()).filter((s) => s.family === SHOT.fast).length;
    shoot(game, centre, 3, { from: 150 });
    assert(
        bossShots(game.scene()).filter((s) => s.family === SHOT.fast).length <= count + 2,
        'returned shots are rate limited',
    );
});

test('the Warden mirror reflects the laser as a warned beam, never an instant hit', async () => {
    const game = await phaseGame(5, 3);
    ticks(game, ENTRANCE_TICKS);
    // Catch the mirror as it forms so it is up for the whole 1.5 s the laser takes to charge.
    until(game, (state) => state.aux[5] > 0.25 && state.aux[5] < 0.75, 3000);
    until(game, (state) => state.aux[5] > 0.75, 100);
    const hp = bossState(game.scene()).health;
    set(game, 3, 100);
    set(game, 4, 135);
    for (let i = 0; i < 80; i++) {
        const scene = game.scene(),
            dx = bossState(scene).x - scene[S.SHIP_X],
            dy = bossState(scene).y - scene[S.SHIP_Y],
            length = Math.hypot(dx, dy);
        game.step({ y: 0, laser: true, aimX: dx / length, aimY: dy / length });
    }
    assert.equal(bossState(game.scene()).health, hp, 'the laser does nothing to the Warden');
    const beam = bossHazards(game.scene()).find((h) => h.kind === HAZARD.beam);
    assert(beam, 'the laser returns as a beam');
    assert(beam.warn >= 800, `with its warning (${beam.warn} ms)`);
});

test('the Warden cloaks: nothing to hit, nothing to touch, then it is back', async () => {
    const game = await phaseGame(5, 3);
    ticks(game, ENTRANCE_TICKS);
    until(game, (state) => state.aux[4] >= 1, 4000);
    assert.equal(body(game).length, 0, 'a cloaked Warden cannot be touched');
    const hp = bossState(game.scene()).health;
    const centre = { x: bossState(game.scene()).x, y: bossState(game.scene()).y };
    shoot(game, centre, 3, { from: 200 });
    assert.equal(bossState(game.scene()).health, hp, 'shots pass through');
    until(game, (state) => state.aux[4] === 0, 400);
    assert(body(game).length > 0, 'it solidifies again');
});

test('the Warden uses every earlier boss attack across the fight', async () => {
    const seen = new Set();
    // The attacks are drawn at random, so look across a few fights.
    for (const seed of [21, 22, 23, 24]) {
        const game = await phaseGame(5, 3, seed);
        for (let i = 0; i < 60 * 50 && bossState(game.scene()).active; i++) {
            game.step({});
            seen.add(bossState(game.scene()).attack);
        }
    }
    const families = [
        [
            ATTACK.lance,
            ATTACK.fan,
            ATTACK.volley,
            ATTACK.cross,
            ATTACK.prism,
            ATTACK.pick,
            'Sentinel/Ringwarden',
        ],
        [
            ATTACK.lob,
            ATTACK.ember,
            ATTACK.fanJets,
            ATTACK.fireNova,
            ATTACK.ringBurst,
            'Cinderforge',
        ],
        [ATTACK.cannon, ATTACK.missile, ATTACK.mines, ATTACK.broadside, 'Bastion'],
        [ATTACK.sine, ATTACK.tendril, ATTACK.spore, ATTACK.pulse, 'Tidecaller'],
    ];
    for (const family of families) {
        const name = family.pop();
        assert(
            family.some((id) => seen.has(id)),
            `${name} attacks appear in the last phases`,
        );
    }
});

test('the Tidecaller streams start from all over the bell and its three new attacks work', async () => {
    const game = await phaseGame(4, 3, 11);
    ticks(game, ENTRANCE_TICKS);
    const columnYs = [],
        sporeXs = [];
    let wall = null,
        rings = null;
    const seen = new Set();
    for (let i = 0; i < 90 * 50 && bossState(game.scene()).active; i++) {
        game.step({});
        const scene = game.scene(),
            state = bossState(scene);
        seen.add(state.attack);
        for (const s of bossShots(scene)) {
            if (s.family === SHOT.sine && s.age < 25) columnYs.push(s.y);
            if (s.family === SHOT.spore && s.y < 14 && s.age < 25) sporeXs.push(s.x);
        }
        if (state.attack === ATTACK.wall && state.attackMs > 800 && state.attackMs < 860 && !wall)
            wall = bossShots(scene)
                .filter((s) => s.family === SHOT.pellet && s.age < 200)
                .map((s) => s.y)
                .sort((a, b) => a - b);
        if (state.attack === ATTACK.whirl && state.attackMs > 1250 && !rings)
            rings = {
                ring: bossHazards(scene).filter((h) => h.kind === HAZARD.ring),
                ship: { x: scene[S.SHIP_X], y: scene[S.SHIP_Y] },
            };
    }
    assert(Math.max(...columnYs) - Math.min(...columnYs) > 60, 'streams use the whole bell');
    for (const id of [ATTACK.wall, ATTACK.rain, ATTACK.whirl]) assert(seen.has(id), `attack ${id}`);
    assert(wall && wall.length >= 8, 'a wall of pellets');
    const biggestGap = Math.max(...wall.slice(1).map((y, i) => y - wall[i]));
    assert(biggestGap >= 60, `with a gap to fly through (${biggestGap} px)`);
    assert(Math.max(...sporeXs) - Math.min(...sporeXs) > 80, 'spores fall in random columns');
    assert(rings && rings.ring.length >= 2, 'two whirlpools');
    for (const r of rings.ring)
        assert(
            Math.hypot(r.x - rings.ship.x, r.y - rings.ship.y) >= 100,
            'never opened on the pilot',
        );
});

test('the Cinderforge: a lava pool burns down into scorched ground that burns while you stand in it', async () => {
    // The Cinderling lobs the same pools and does nothing else, so a hit here is a pool or a burn.
    const game = await phaseGame(8, 1, 5);
    ticks(game, ENTRANCE_TICKS);
    const burns = () => bossHazards(game.scene()).filter((h) => h.kind === HAZARD.burn);
    const pools = () => bossHazards(game.scene()).filter((h) => h.kind === HAZARD.pool);
    until(game, () => pools().length > 0, 2500);
    const pool = pools()[0];
    set(game, 3, 460); // out of the way: lobs are aimed at the pilot but clamped to the field
    set(game, 4, 20);
    until(
        game,
        () => burns().length > 0,
        600,
        () => ({ x: 2048, y: 2048 }),
    );
    const scorch = burns()[0];
    assert(
        Math.abs(scorch.x - pool.x) < 1 && Math.abs(scorch.y - pool.y) < 1,
        'where the pool was',
    );
    assert.equal(scorch.warn, 0, 'it is already down: the pool was the warning');
    assert(scorch.live > 5000, 'and it lasts about six seconds');
    const before = bossState(game.scene()).hitsTaken;
    ticks(game, 20);
    assert.equal(bossState(game.scene()).hitsTaken, before, 'nothing burns while you are away');
    set(game, 3, scorch.x);
    set(game, 4, scorch.y);
    ticks(game, 30); // the first burn comes 500 ms after stepping in
    assert(bossState(game.scene()).hitsTaken > before, 'standing in it burns');
});

test('the Cinderforge: a shot-down lob cancels its pool but marks the ground, which then smoulders', async () => {
    const game = await phaseGame(2, 1, 5);
    ticks(game, ENTRANCE_TICKS);
    const hz = (kind) => bossHazards(game.scene()).filter((h) => h.kind === kind);
    until(game, () => bossShots(game.scene()).some((s) => s.family === SHOT.lob), 2500);
    const lob = bossShots(game.scene()).find((s) => s.family === SHOT.lob);
    shoot(game, lob, 2, { from: 40 });
    assert.equal(hz(HAZARD.pool).length, 0, 'the pool never lands');
    const mark = hz(HAZARD.burn);
    assert(mark.length >= 1 && mark[0].warn > 0, 'but the ground is marked first');
    until(game, () => hz(HAZARD.burn).length && hz(HAZARD.burn)[0].warn === 0, 100);
    assert(hz(HAZARD.burn)[0].c < 15, 'a small patch');
});

test('the Cinderforge fights with fire that stays: geysers, hammers, vents and a barrage; at most three scorches burn', async () => {
    const seen = new Set();
    let most = 0,
        geyserScorch = false;
    for (const [phase, seed] of [
        [1, 3],
        [2, 4],
        [2, 5],
        [3, 6],
        [3, 7],
    ]) {
        const game = await phaseGame(2, phase, seed);
        for (let i = 0; i < 50 * 50 && bossState(game.scene()).active; i++) {
            game.step({ x: 2048, y: 2048 });
            const scene = game.scene(),
                state = bossState(scene);
            seen.add(state.attack);
            const burning = bossHazards(scene).filter((h) => h.kind === HAZARD.burn);
            most = Math.max(most, burning.length);
            if (state.attack === ATTACK.geyser && burning.some((h) => h.y > 240))
                geyserScorch = true;
        }
    }
    for (const id of [ATTACK.geyser, ATTACK.hammer, ATTACK.vent, ATTACK.barrage, ATTACK.lob])
        assert(seen.has(id), `attack ${id}`);
    assert(most >= 1 && most <= 3, `${most} scorches at once`);
    assert(geyserScorch, 'a geyser leaves a scorch at its base');
});
