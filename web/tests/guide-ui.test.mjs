import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assembleHtml } from '../tools/assemble-html.mjs';

const css = await readFile(new URL('../styles/theme/guide.css', import.meta.url), 'utf8');
const atlas = JSON.parse(
    await readFile(new URL('../assets/sprites.json', import.meta.url), 'utf8'),
);
const html = assembleHtml();

test('How to Play pickup icons point at the right cells of the sprite atlas', () => {
    for (const [pickup, sprite] of [
        ['multishot', 'multishot'],
        ['shield', 'shield'],
        ['health', 'health'],
    ]) {
        const rule = new RegExp(
            `\\.pickup-icon\\[data-pickup='${pickup}'\\]\\s*\\{\\s*--ax:\\s*(\\d+);\\s*--ay:\\s*(\\d+);`,
        ).exec(css);
        assert.ok(rule, `${pickup} icon rule`);
        assert.deepEqual([Number(rule[1]), Number(rule[2])], [atlas[sprite].x, atlas[sprite].y]);
        assert.ok(
            html.includes(`data-pickup="${pickup}"`),
            `${pickup} is listed on the help screen`,
        );
    }
});

test('the lobby keeps every control the co-op menu navigates', () => {
    for (const id of [
        'coopDevice0',
        'coopProfile0',
        'coopReady0',
        'coopDevice1',
        'coopProfile1',
        'coopReady1',
        'coopFriendly',
        'coopLobbyStatus',
        'coopStart',
    ])
        assert.ok(html.includes(`id="${id}"`), id);
});
