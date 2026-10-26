import test from 'node:test';
import assert from 'node:assert/strict';
import { CoopInput } from '../coop-input.mjs';
import { defaults } from '../settings.mjs';
const pad = (index) => ({
    index,
    id: 'Identical controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
test('distinct devices/profiles, held ready guards, disconnect and explicit reclaim', () => {
    const input = new CoopInput([defaults(), defaults()]),
        pads = [pad(0), pad(1)];
    input.assign(1, '0', pads);
    assert(input.valid(pads));
    input.profileIds[1] = 0;
    assert(!input.valid(pads));
    input.profileIds[1] = 1;
    pads[0].buttons[0].pressed = true;
    input.lobbyTick(pads);
    assert(!input.ready[1]);
    pads[0].buttons[0].pressed = false;
    input.lobbyTick(pads);
    pads[0].buttons[0].pressed = true;
    input.lobbyTick(pads);
    assert(input.ready[1]);
    input.join(0, pads);
    pads[0].buttons[0].pressed = false;
    input.begin(pads);
    assert(input.live);
    assert(!input.lost(1));
    assert(input.lost(0));
    assert(!input.valid(pads));
    pads[0].index = 3;
    assert(!input.valid(pads));
    input.assign(1, '3', pads);
    assert(input.valid(pads));
    assert(!input.ready.some(Boolean));
});
test('identical controller names still route independent axes and fresh taps', () => {
    const input = new CoopInput([defaults(), defaults()]),
        pads = [pad(0), pad(1)];
    input.assign(0, '0', pads);
    input.assign(1, '1', pads);
    input.join(0, pads);
    input.join(1, pads);
    input.begin(pads);
    pads[0].axes[0] = 1;
    pads[1].axes[0] = -1;
    input.observe(pads);
    pads[1].buttons[7].pressed = true;
    pads[1].buttons[7].value = 1;
    input.observe(pads);
    pads[1].buttons[7].pressed = false;
    pads[1].buttons[7].value = 0;
    input.observe(pads);
    let sample = input.sample(pads, 0);
    assert(sample.players[0].x > 2048);
    assert(sample.players[1].x < 2048);
    assert(!sample.players[0].firePressed);
    assert(sample.players[1].firePressed);
    sample = input.sample(pads, 20);
    assert(!sample.players[1].firePressed);
    assert.equal(input.keyboard(), null);
    input.assign(1, '0', pads);
    assert(!input.valid(pads));
});
