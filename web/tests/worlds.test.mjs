import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REGIONS } from '../regions.mjs';

const meta = JSON.parse(readFileSync(new URL('../assets/worlds.json', import.meta.url)));
const png = readFileSync(new URL('../assets/worlds.png', import.meta.url));
const width = png.readUInt32BE(16), height = png.readUInt32BE(20);

test('every world strip fits inside worlds.png and has whole frames', () => {
  for (const [name, w] of Object.entries(meta)) {
    assert.ok(w.frames >= 1 && Number.isInteger(w.frames), name);
    assert.ok(w.x >= 0 && w.y >= 0 && w.x + w.w * w.frames <= width && w.y + w.h <= height, `${name} out of bounds`);
  }
});

test('every sprite a region background draws exists in the sheet', () => {
  const source = readFileSync(new URL('../backgrounds.mjs', import.meta.url), 'utf8');
  const used = [...source.matchAll(/drawWorld\(ctx, worlds, '([a-z-]+)'/g)].map(m => m[1]);
  assert.ok(used.length >= REGIONS.length);
  for (const name of new Set(used)) assert.ok(meta[name], `missing world ${name}`);
});
