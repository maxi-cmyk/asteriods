import test from 'node:test';
import assert from 'node:assert/strict';
import { adjustField } from '../menu-fields.mjs';
import { MenuInput } from '../navigation.mjs';
import { warpDistance, LaunchSequence } from '../presentation.mjs';

function field(kind, values = {}) {
    const events = [];
    return {
        disabled: false,
        matches: (selector) => selector === kind,
        dispatchEvent: (event) => events.push(event.type),
        events,
        ...values,
    };
}
test('controller field adjustment clamps ranges and emits the same draft input event', () => {
    const range = field('input[type="range"]', { min: '.25', max: '1', step: '.05', value: '.95' });
    assert(adjustField(range, 1));
    assert.equal(range.value, '1');
    adjustField(range, 1);
    assert.equal(range.value, '1');
    adjustField(range, -1);
    assert.equal(range.value, '0.95');
    assert.deepEqual(range.events, ['input', 'input', 'input']);
    range.disabled = true;
    assert.equal(adjustField(range, 1), false);
});
test('controller selectors update one option and emit change without opening a browser popup', () => {
    const select = field('select', { options: [1, 2], selectedIndex: 0 });
    adjustField(select, 1);
    assert.equal(select.selectedIndex, 1);
    adjustField(select, 1);
    assert.equal(select.selectedIndex, 1);
    adjustField(select, -1);
    assert.equal(select.selectedIndex, 0);
    assert.deepEqual(select.events, ['change', 'change', 'change']);
});
test('horizontal controller input requires neutral entry and has bounded repeat', () => {
    const input = new MenuInput();
    const pad = { axes: [1, 0, 0, 0], buttons: [] };
    assert.deepEqual(input.sample(pad, 0), {});
    pad.axes[0] = 0;
    input.sample(pad, 10);
    pad.axes[0] = 1;
    assert.equal(input.sample(pad, 20).horizontal, 1);
    assert.equal(input.sample(pad, 50).horizontal, undefined);
    assert.equal(input.sample(pad, 370).horizontal, 1);
    input.reset();
    assert.deepEqual(input.sample(pad, 1000), {});
});
test('warp travel never reverses during deceleration and frozen clock preserves launch progress', () => {
    let previous = 0;
    for (let ms = 0; ms <= 3200; ms += 20) {
        const distance = warpDistance(ms);
        assert(distance >= previous);
        previous = distance;
    }
    const launch = new LaunchSequence();
    let starts = 0;
    launch.begin(100, () => starts++);
    launch.tick(1000);
    for (let frame = 0; frame < 500; frame++) launch.tick(1000);
    assert.equal(starts, 0);
    assert.equal(launch.elapsed(1000), 900);
    launch.tick(launch.total + 100);
    launch.skip();
    assert.equal(starts, 1);
});

test('decoration preferences migrate with safe defaults and never change input bindings', async () => {
    const { defaults, sanitizeSettings } = await import('../settings.mjs');
    const before = defaults();
    const old = sanitizeSettings({ volume: 0.3 });
    assert.equal(old.backgroundMotion, 1);
    assert.equal(old.backgroundBrightness, 1);
    const next = sanitizeSettings({ ...before, backgroundMotion: -1, backgroundBrightness: 0 });
    assert.equal(next.backgroundMotion, 0);
    assert.equal(next.backgroundBrightness, 0.25);
    assert.deepEqual(next.keys, before.keys);
    assert.deepEqual(next.buttons, before.buttons);
});
