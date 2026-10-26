import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, regionIndexForWave, RegionTimeline, envelope, CUE_MS } from '../regions.mjs';
import { LaunchSequence, warpSpeed, WARP_ACTION_MS, drawHome } from '../presentation.mjs';

const run = (timeline, wave, time, extra = {}) =>
    timeline.observe({ wave, time, run: true, ...extra });

test('regions cover five waves each, with the last continuing past wave 30', () => {
    const edges = [
        [1, 0],
        [5, 0],
        [6, 1],
        [10, 1],
        [11, 2],
        [15, 2],
        [16, 3],
        [20, 3],
        [21, 4],
        [25, 4],
        [26, 5],
        [30, 5],
        [31, 5],
        [400, 5],
    ];
    for (const [wave, index] of edges)
        assert.equal(regionIndexForWave(wave), index, `wave ${wave}`);
    assert.equal(regionIndexForWave(0), 0);
    assert.equal(regionIndexForWave(NaN), 0);
    for (const [i, region] of REGIONS.entries()) assert.equal(region.first, i * 5 + 1);
});

test('each boundary starts exactly one transition, with the planned gesture or the shared fade', () => {
    const gestures = [
        'orbital-pass',
        'atmospheric-sweep',
        'skyline-emergence',
        'cloud-clearance',
        'ring-convergence',
    ];
    const lines = new RegionTimeline();
    run(lines, 1, 0);
    let time = 0;
    for (let boundary = 0; boundary < 5; boundary++) {
        const first = boundary * 5 + 5;
        run(lines, first, (time += 1000));
        assert.equal(lines.transition, null, `no transition inside wave ${first}`);
        run(lines, first + 1, (time += 1000));
        assert.equal(lines.transition.gesture, gestures[boundary]);
        assert.equal(lines.transition.to, boundary + 1);
        for (let again = 0; again < 5; again++) run(lines, first + 1, (time += 10));
        assert.equal(lines.transition.start, time - 50);
        time += 2000;
        assert.equal(lines.progress(time), null);
    }
    run(lines, 31, (time += 1000));
    assert.equal(lines.transition, null);
    assert.equal(lines.index, 5);
});

test('transitions settle in 450–700 ms and stay frozen while the clock is frozen', () => {
    const lines = new RegionTimeline();
    run(lines, 5, 100);
    run(lines, 6, 1000);
    assert.deepEqual([lines.transition.ms >= 450, lines.transition.ms <= 700], [true, true]);
    const paused = lines.progress(1200);
    assert.equal(lines.progress(1200).t, paused.t);
    assert.equal(lines.transition.start, 1000);
    assert.equal(lines.progress(1000 + lines.transition.ms), null);
});

test('starting at a later wave, jumping, or retrying never replays travel', () => {
    const lines = new RegionTimeline();
    run(lines, 28, 0);
    assert.equal(lines.index, 5);
    assert.equal(lines.transition, null);
    run(lines, 1, 50);
    assert.equal([lines.index, lines.transition].join(), '0,');
    run(lines, 12, 100);
    assert.equal([lines.index, lines.transition].join(), '2,');
    run(lines, 13, 200);
    assert.equal(lines.index, 2);
    lines.observe({ wave: 20, time: 300, run: false });
    assert.equal([lines.index, lines.seen].join(), '0,false');
});

test('a new region reached mid-transition settles on the destination instead of queueing', () => {
    const lines = new RegionTimeline();
    run(lines, 5, 0);
    run(lines, 6, 100);
    run(lines, 11, 200);
    assert.equal(lines.index, 2);
    assert.equal(lines.transition, null);
});

test('practice keeps the opening region and never transitions', () => {
    const lines = new RegionTimeline();
    for (const wave of [1, 6, 11, 26]) run(lines, wave, wave * 100, { practice: true });
    assert.equal(lines.index, 0);
    assert.equal(lines.transition, null);
    assert.equal(lines.cue(0), null);
});

test('reduced motion uses a short crossfade for every boundary', () => {
    const lines = new RegionTimeline({ reduced: true });
    run(lines, 5, 0);
    run(lines, 6, 10);
    assert.deepEqual([lines.transition.gesture, lines.transition.ms], ['fade', 200]);
});

test('the region cue appears on entry and fades without delaying anything', () => {
    const lines = new RegionTimeline();
    run(lines, 1, 0);
    assert.equal(lines.cue(0).name, 'Celestial frontier');
    assert.equal(lines.cue(CUE_MS - 500).alpha, 1);
    assert.ok(lines.cue(CUE_MS - 100).alpha < 1);
    assert.equal(lines.cue(CUE_MS), null);
});

test('the transition envelope is monotonic, settled at both ends, with no black frame', () => {
    assert.equal(envelope(0), 0);
    assert.equal(envelope(0.1), 0);
    assert.equal(envelope(1), 1);
    let last = 0;
    for (let t = 0; t <= 1; t += 0.01) {
        const e = envelope(t);
        assert.ok(e >= last - 1e-9);
        last = e;
    }
});

test('launch sequence finishes exactly once whether it ends, is skipped, or is cancelled', () => {
    const log = [];
    const launch = new LaunchSequence();
    launch.begin(0, (started) => log.push(started));
    launch.tick(1000);
    assert.deepEqual(log, []);
    launch.skip();
    launch.skip();
    launch.tick(5000);
    launch.cancel();
    assert.deepEqual(log, [true]);
    launch.begin(0, (started) => log.push(started));
    launch.tick(launch.total);
    assert.deepEqual(log, [true, true]);
    launch.begin(0, (started) => log.push(started));
    launch.cancel();
    assert.deepEqual(log, [true, true, false]);
    const reduced = new LaunchSequence({ reduced: true });
    assert.ok(reduced.total < 400);
});

test('warp accelerates, then settles to rest by the end of the action', () => {
    assert.equal(warpSpeed(0), 0);
    assert.ok(warpSpeed(WARP_ACTION_MS * 0.5) > 0.5);
    assert.equal(warpSpeed(WARP_ACTION_MS), 0);
});

test('Home overlay twinkles and drifts, and draws nothing under reduced motion', () => {
    const calls = [];
    const ctx = {
        clearRect() {
            calls.push('clear');
        },
        fillRect() {
            calls.push('rect');
        },
        set fillStyle(v) {},
    };
    drawHome(ctx, 1000, { reduced: true });
    assert.deepEqual(calls, ['clear']);
    calls.length = 0;
    drawHome(ctx, 1000);
    assert.ok(calls.filter((c) => c === 'rect').length > 100);
    // It is a pure function of the clock: the same time draws the same frame.
    const again = [];
    drawHome(
        {
            ...ctx,
            fillRect() {
                again.push('rect');
            },
        },
        1000,
    );
    assert.equal(again.length, calls.filter((c) => c === 'rect').length);
});
