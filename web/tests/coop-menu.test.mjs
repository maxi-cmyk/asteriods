import test from 'node:test';
import assert from 'node:assert/strict';
import { CoopInput } from '../src/input/coop-input.mjs';
import { CoopMenu, READY_HOLD_MS } from '../src/input/coop-menu.mjs';
import { defaults } from '../src/state/settings.mjs';

const pad = (index) => ({
    index,
    id: `Pad ${index}`,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
function lobby(devices = ['keyboard', '0']) {
    const input = new CoopInput([defaults(), defaults()]),
        pads = [pad(0), pad(1)];
    devices.forEach((d, i) => input.assign(i, d, pads));
    let focused = null,
        now = 0,
        starts = 0,
        backs = 0;
    const nodes = new Map();
    const refresh = () => {
        for (let i = 0; i < 2; i++)
            for (const prefix of ['coopDevice', 'coopProfile'])
                nodes.get(prefix + i).disabled = input.ready[i];
        for (let i = 0; i < 2; i++)
            nodes.get('coopReady' + i).disabled = !input.ready[i] && !input.valid(pads);
        nodes.get('coopFriendly').disabled = input.ready.some(Boolean);
        input.canStart(pads);
        nodes.get('coopStart').disabled = !input.valid(pads) || !input.ready.every(Boolean);
    };
    for (const id of [
        'coopDevice0',
        'coopProfile0',
        'coopReady0',
        'coopDevice1',
        'coopProfile1',
        'coopReady1',
        'coopFriendly',
        'coopStart',
    ]) {
        const select = /Device|Profile/.test(id),
            slot = Number(id.at(-1));
        const options = id.includes('Device') ? ['', 'keyboard', '0', '1'] : ['0', '1'];
        const node = {
            id,
            disabled: false,
            options,
            selectedIndex: options.indexOf(id.includes('Device') ? devices[slot] : String(slot)),
            matches: (s) => s === 'select' && select,
            focus() {
                focused = this;
            },
            dispatchEvent() {
                if (id.includes('Device')) input.assign(slot, options[this.selectedIndex], pads);
                else input.setProfile(slot, Number(options[this.selectedIndex]));
                refresh();
            },
            click() {
                if (this.disabled) return;
                if (id.includes('Ready')) input.join(slot, pads);
                if (id === 'coopStart') starts++;
                refresh();
            },
        };
        nodes.set(id, node);
    }
    const menu = new CoopMenu(
        input,
        (id) => nodes.get(id),
        () => backs++,
        () => focused,
    );
    const tick = (ms = 20) => {
        refresh();
        menu.sample(pads, (now += ms));
        refresh();
    };
    const tap = (button, index = 0) => {
        pads[index].buttons[button] = { pressed: true, value: 1 };
        tick();
        pads[index].buttons[button] = { pressed: false, value: 0 };
        tick();
    };
    tick();
    return {
        input,
        pads,
        nodes,
        tick,
        tap,
        menu,
        get focused() {
            return focused;
        },
        get starts() {
            return starts;
        },
        get backs() {
            return backs;
        },
    };
}

test('controller navigates to Ready and confirms without editing mouse/keyboard selections', () => {
    const h = lobby();
    h.nodes.get('coopDevice0').focus();
    h.tap(15); // Accidental right stick / D-pad input moves this pad's cursor only.
    assert.equal(h.focused.id, 'coopDevice1');
    assert.deepEqual(h.input.devices, ['keyboard', '0']);
    h.tap(13);
    assert.equal(h.focused.id, 'coopProfile1');
    h.tap(15);
    assert.equal(h.focused.id, 'coopReady1');
    assert.deepEqual(h.input.profileIds, [0, 1]);
    h.tap(0);
    assert.deepEqual(h.input.ready, [false, true]);
    assert(h.nodes.get('coopDevice1').disabled);
    assert(h.nodes.get('coopProfile1').disabled);
    h.tap(0);
    assert.equal(h.input.ready[1], false);
    assert(!h.nodes.get('coopDevice1').disabled);
});

test('select editing requires confirm and Back leaves editing before leaving lobby', () => {
    const h = lobby();
    h.tap(13);
    h.tap(13);
    assert.equal(h.focused.id, 'coopProfile1');
    h.tap(0);
    h.tap(12);
    assert.equal(h.input.profileIds[1], 0);
    h.tap(1);
    assert.equal(h.backs, 0);
    h.tap(13);
    assert.equal(h.focused.id, 'coopFriendly'); // Ready is disabled for duplicate profiles.
    h.tap(1);
    assert.equal(h.backs, 1);
});

test('two controllers keep independent cursors and Ready does not fire from a held confirm', () => {
    const h = lobby(['0', '1']);
    h.tap(0);
    assert.equal(h.focused.id, 'coopReady0');
    h.tap(0);
    assert(h.input.ready[0]);
    h.tap(13, 1);
    assert.equal(h.focused.id, 'coopDevice1');
    h.tap(13, 1);
    h.tap(13, 1);
    assert.equal(h.focused.id, 'coopReady1');
    h.pads[1].buttons[0] = { pressed: true, value: 1 };
    h.tick();
    h.tick();
    h.tick();
    assert.deepEqual(h.input.ready, [true, true]);
    h.pads[1].buttons[0] = { pressed: false, value: 0 };
    h.tick();
    h.tap(13, 1);
    assert.equal(h.focused.id, 'coopStart');
    h.tap(0, 1);
    assert.equal(h.starts, 1);
});

test('ready selections and readiness survive the other player editing', () => {
    const h = lobby(['0', '1']);
    h.input.join(0, h.pads);
    assert.equal(h.input.assign(0, 'keyboard', h.pads), false);
    assert.equal(h.input.setProfile(0, 1), false);
    assert.equal(h.input.assign(1, '0', h.pads), false);
    assert.equal(h.input.setProfile(1, 0), false);
    assert.equal(h.input.assign(1, 'keyboard', h.pads), true);
    assert.equal(h.input.setProfile(1, 1), true);
    assert.deepEqual(h.input.devices, ['0', 'keyboard']);
    assert.deepEqual(h.input.ready, [true, false]);
    h.input.join(0, h.pads);
    assert.equal(h.input.assign(0, '1', h.pads), true);
});

test('pause reassignment remains available after starting with both players ready', () => {
    const h = lobby();
    h.input.join(0, h.pads);
    h.input.join(1, h.pads);
    h.input.begin(h.pads);
    assert.equal(h.input.assign(1, '1', h.pads), true);
    assert(h.input.valid(h.pads));
});

test('mouse focus ends controller field editing and disconnect still permits canceling Ready', () => {
    const h = lobby();
    h.tap(13);
    h.tap(13);
    h.tap(0);
    h.nodes.get('coopProfile0').focus();
    h.tap(12);
    assert.deepEqual(h.input.profileIds, [0, 1]);
    h.input.join(0, h.pads);
    h.pads[0].connected = false;
    h.tick();
    assert(!h.nodes.get('coopReady0').disabled);
    h.nodes.get('coopReady0').click();
    assert(!h.input.ready[0]);
});

test('Circle readies the assigned pilot at 1.5 seconds from any field, once per hold', () => {
    const h = lobby();
    h.tap(13);
    h.tap(13);
    h.tap(0); // Editing profile.
    h.pads[0].buttons[1] = { pressed: true, value: 1 };
    h.tick();
    h.tick(READY_HOLD_MS - 1);
    assert(!h.input.ready[1]);
    assert.equal(h.backs, 0);
    assert(h.menu.readyProgress[1] > 0.99);
    h.tick(1);
    assert.deepEqual(h.input.ready, [false, true]);
    assert.equal(h.focused.id, 'coopReady1');
    h.tick(3000);
    assert(h.input.ready[1]);
    h.pads[0].buttons[1] = { pressed: false, value: 0 };
    h.tick();
    assert.equal(h.backs, 0);
    assert.deepEqual(h.menu.readyProgress, [0, 0]);
});

test('releasing Circle early resets the timer and performs Back on release', () => {
    const h = lobby();
    h.pads[0].buttons[1].pressed = true;
    h.tick();
    h.tick(700);
    assert.equal(h.backs, 0);
    assert(!h.input.ready[1]);
    h.pads[0].buttons[1].pressed = false;
    h.tick();
    assert.equal(h.backs, 1);
    h.pads[0].buttons[1].pressed = true;
    h.tick();
    h.tick(800);
    assert(!h.input.ready[1]);
    assert(h.menu.readyProgress[1] < 0.54);
});

test('Circle holds are independent and cannot ready an invalid or unassigned pilot', () => {
    const h = lobby(['0', '1']);
    h.pads[0].buttons[1].pressed = true;
    h.tick();
    h.tick(750);
    h.pads[1].buttons[1].pressed = true;
    h.tick();
    h.tick(750);
    assert.deepEqual(h.input.ready, [true, false]);
    h.tick(750);
    assert.deepEqual(h.input.ready, [true, true]);
    const invalid = lobby();
    invalid.input.setProfile(1, 0);
    invalid.pads[0].buttons[1].pressed = true;
    invalid.tick();
    invalid.tick(1500);
    assert.deepEqual(invalid.input.ready, [false, false]);
    invalid.pads[0].buttons[1].pressed = false;
    invalid.tick();
    assert.equal(invalid.backs, 0);
    const unassigned = lobby();
    unassigned.pads[1].buttons[1].pressed = true;
    unassigned.tick();
    unassigned.tick(1500);
    assert.deepEqual(unassigned.input.ready, [false, false]);
});

test('disconnect and menu reset discard holds and require a fresh press after neutral', () => {
    for (const disconnect of [false, true]) {
        const h = lobby();
        h.pads[0].buttons[1].pressed = true;
        h.tick();
        h.tick(1000);
        if (disconnect) {
            h.pads[0].connected = false;
            h.tick();
            h.pads[0].connected = true;
        } else h.menu.reset();
        h.tick(2000);
        assert(!h.input.ready[1]);
        h.pads[0].buttons[1].pressed = false;
        h.tick();
        h.pads[0].buttons[1].pressed = true;
        h.tick();
        h.tick(1500);
        assert(h.input.ready[1]);
        assert.equal(h.backs, 0);
    }
});
