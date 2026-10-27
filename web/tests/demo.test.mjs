import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRuntime } from '../src/runtime/runtime.mjs';

test('HD demo launches explicitly and exits on movement without saving', async () => {
    let seed = 7,
        writes = 0;
    const g = await createRuntime(await readFile(new URL('../dist/test.wasm', import.meta.url)), {
        random: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0),
        storage: { getItem: () => null, setItem: () => writes++ },
    });
    for (let i = 0; i < 500; i++) g.step();
    assert.equal(g.state, 'menu');
    g.api.web_demo();
    assert.equal(g.state, 'demo');
    const before = g.snapshot()[4];
    for (let i = 0; i < 500; i++) g.step();
    assert(g.snapshot()[4] > before);
    assert.equal(writes, 0);
    g.step({ y: 0 });
    assert.equal(g.state, 'menu');
    for (let i = 0; i < 20; i++) g.step({ y: 0 });
    assert.equal(g.state, 'menu');
});

test('isolated manual demo never advances or writes the player runtime and freezes after Stop', async () => {
    const { createDemo } = await import('../src/demo/engine.mjs');
    const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
    let writes = 0;
    const player = await createRuntime(bytes, {
        storage: { getItem: () => null, setItem: () => writes++ },
    });
    player.start(true);
    player.step({ firePressed: true });
    player.pause();
    const snapshot = player.snapshot(),
        scene = [...player.scene()],
        stats = player.stats();
    const demo = await createDemo(bytes);
    assert.equal(demo.active, false);
    const idle = demo.snapshot();
    for (let i = 0; i < 1500; i++) demo.step();
    assert.deepEqual(demo.snapshot(), idle);
    demo.start();
    assert.equal(demo.active, true);
    for (let i = 0; i < 15000; i++) demo.step();
    assert.deepEqual(player.snapshot(), snapshot);
    assert.deepEqual([...player.scene()], scene);
    assert.deepEqual(player.stats(), stats);
    assert.equal(writes, 0);
    demo.stop();
    const stopped = demo.snapshot();
    for (let i = 0; i < 1000; i++) demo.step();
    assert.deepEqual(demo.snapshot(), stopped);
    demo.start();
    assert.equal(demo.active, true);
    demo.stop();
});

test('the Home demo plays the whole game: bosses, deaths and all, until it is stopped', async () => {
    const { createDemo } = await import('../src/demo/engine.mjs');
    const { S } = await import('../src/runtime/scene-layout.mjs');
    const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
    const demo = await createDemo(bytes);
    demo.start();
    let bossSeen = false,
        maxWave = 0,
        lastLives = 3,
        livesLost = 0;
    for (let i = 0; i < 20000; i++) {
        demo.step();
        const scene = demo.scene();
        // Never the menu, score entry or game over: the run goes on whatever happens.
        assert(![0, 5, 6].includes(scene[S.STATE]), `the demo left play at tick ${i}`);
        bossSeen ||= !!scene[S.BOSS_ACTIVE];
        maxWave = Math.max(maxWave, scene[S.WAVE]);
        if (scene[S.LIVES] < lastLives) livesLost++;
        lastLives = scene[S.LIVES];
    }
    assert(bossSeen, 'a boss appears');
    assert(maxWave >= 8, `reached wave ${maxWave}`);
    assert(livesLost > 0, 'the pilot loses lives like anyone, and keeps flying');
    demo.stop();
});
