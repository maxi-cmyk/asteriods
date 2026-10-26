import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRuntime } from '../runtime.mjs';
import { RECORDS_KEY, clearBrowserRecords } from '../records.mjs';

const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
const scoreKey = 'asteroids.web.hd.scores-v3';
function storageFixture() {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
    };
}
async function savedGame(storage) {
    const game = await createRuntime(bytes, { storage, scoreKey });
    game.start();
    game.api.web_scenario(3);
    for (let i = 0; i < 26; i++) game.step();
    game.continueResults();
    game.step();
    game.step({ firePressed: true });
    assert.equal(game.state, 'game-over');
    assert.equal(game.scene()[31], 1);
    game.records.record(
        1,
        { practice: true },
        {
            score: 20,
            wave: 1,
            peakCps: 1,
            longestChain: 1,
            shots: 1,
            hits: 1,
        },
    );
    return game;
}

test('browser reset clears live WASM and both profiles after reload, preserving settings and other keys', async () => {
    const storage = storageFixture();
    storage.setItem('asteroids.web.settings-v1', 'my controls');
    storage.setItem('unrelated', 'keep');
    storage.setItem('asteroids.web.scores-v3', 'legacy scores');
    const game = await savedGame(storage);
    assert(game.clearRecords());
    assert.equal(game.scene()[31], 0);
    assert.equal(game.records.get(0, {}), null);
    assert.equal(game.records.get(1, { practice: true }), null);
    const reload = await createRuntime(bytes, { storage, scoreKey });
    assert.equal(reload.scene()[31], 0);
    assert.deepEqual(reload.records.profiles, [{}, {}]);
    assert.equal(storage.getItem('asteroids.web.settings-v1'), 'my controls');
    assert.equal(storage.getItem('unrelated'), 'keep');
    assert.equal(storage.getItem('asteroids.web.scores-v3'), 'legacy scores');
});

test('partial reset failure restores stored leaderboard and leaves live records unchanged', async () => {
    const storage = storageFixture();
    const game = await savedGame(storage);
    const scores = storage.getItem(scoreKey);
    const bests = storage.getItem(RECORDS_KEY);
    const save = storage.setItem;
    let fail = true;
    storage.setItem = (key, value) => {
        if (key === RECORDS_KEY && fail) {
            fail = false;
            throw new Error('Quota');
        }
        save(key, value);
    };
    assert.equal(game.clearRecords(), false);
    assert.equal(storage.getItem(scoreKey), scores);
    assert.equal(storage.getItem(RECORDS_KEY), bests);
    assert.equal(game.scene()[31], 1);
    assert(game.records.get(0, {}));
    assert.match(game.scoreStatus, /Could not clear/);
    assert(game.clearRecords());
    assert.equal(game.scene()[31], 0);
});

test('denied storage fails visibly without pretending records were cleared', () => {
    assert.equal(clearBrowserRecords(undefined, scoreKey).ok, false);
    const result = clearBrowserRecords(
        {
            getItem() {
                throw Error('Denied');
            },
        },
        scoreKey,
    );
    assert.equal(result.ok, false);
    assert.match(result.message, /Could not clear/);
});
