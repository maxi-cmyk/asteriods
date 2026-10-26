import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { S, BLOCKS, BOSS, SCENE_FLOATS, sceneHeader } from '../scene-layout.mjs';

test('layout fields never overlap and stay inside the scene', () => {
    const used = new Map();
    const claim = (name, at, count = 1) => {
        for (let i = at; i < at + count; i++) {
            assert(i < SCENE_FLOATS, `${name} is past the end`);
            assert(!used.has(i), `${name} overlaps ${used.get(i)} at ${i}`);
            used.set(i, name);
        }
    };
    for (const [name, at] of Object.entries(S)) claim(name, at);
    for (const [name, b] of Object.entries(BLOCKS)) {
        if (name === 'COOP_STATS' || name === 'INITIALS') claim(name, b.at, b.stride * b.count);
        else claim(name, b.at, b.stride * b.count);
    }
    claim('BOSS header', BOSS.at, BOSS.AUX + BOSS.AUX_COUNT);
    for (const name of ['PARTS', 'SHOTS', 'HAZARDS'])
        claim(`BOSS ${name}`, BOSS.at + BOSS[name].at, BOSS[name].stride * BOSS[name].count);
});

test('the generated engine header carries every field', () => {
    const header = sceneHeader();
    for (const name of Object.keys(S)) assert(header.includes(`SCENE_${name} =`), name);
    for (const name of Object.keys(BLOCKS)) assert(header.includes(`SCENE_${name}_AT`), name);
});

test('no module outside the layout reads the scene by a bare number', async () => {
    const files = [];
    for (const dir of ['.', 'screens', 'demo', 'tests']) {
        const base = new URL(`../${dir}/`, import.meta.url);
        for (const name of await readdir(base))
            if (name.endsWith('.mjs') && name !== 'scene-layout.mjs')
                files.push([`${dir}/${name}`, new URL(name, base)]);
    }
    const bare = /\b(?:scene|playerScene|scene\(\))\[\d+\]/;
    for (const [name, url] of files) {
        const text = await readFile(url, 'utf8');
        assert(!bare.test(text), `${name} reads the scene by a bare number`);
    }
});
