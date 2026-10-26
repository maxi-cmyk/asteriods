// Browser smoke walk for refactors. With a served build (node serve.mjs) open the app and run
//   JSON.stringify(await (await import('/dev/smoke.mjs')).runSmoke())
// in the page. It walks Home -> mode -> launch -> play -> pause -> settings -> back -> quit ->
// practice -> boss practice -> records/hangar/settings/help -> home and returns a log that a
// refactor of src/app must leave unchanged.
export async function runSmoke() {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = [];
    const note = (k, v) => log.push([k, v]);
    const el = (id) => document.getElementById(id);
    const click = (id) => el(id).click();
    const key = (type, code) =>
        (document.activeElement || document.body).dispatchEvent(
            new KeyboardEvent(type, { code, key: code, bubbles: true }),
        );
    const tap = async (code, ms = 60) => {
        key('keydown', code);
        await wait(ms);
        key('keyup', code);
        await wait(60);
    };
    const screen = () => document.body.dataset.screen;
    const until = async (test, ms = 8000) => {
        const end = performance.now() + ms;
        while (performance.now() < end && !test()) await wait(50);
        return test();
    };
    note('home', screen());
    click('play');
    await wait(300);
    note('mode', screen());
    click('soloPlay');
    await wait(300);
    note('launch shown', !el('launch').hidden);
    click('skipLaunch');
    await until(() => window.asteroids.state() === 'playing');
    note('play', [screen(), window.asteroids.state()]);
    const before = window.asteroids.snapshot()[1];
    key('keydown', 'KeyD');
    await wait(700);
    key('keyup', 'KeyD');
    await tap('Space');
    note('ship moved right', window.asteroids.snapshot()[1] > before + 5);
    await tap('Escape');
    note('pause', screen());
    click('pauseSettings');
    await wait(300);
    note('settings', screen());
    await tap('Escape');
    note('back to pause', screen());
    click('quitRun');
    await wait(300);
    const decision = el('navigationDecision');
    note('quit asks', decision.open);
    decision.querySelector('[data-decision="quit"]').click();
    await wait(400);
    note('home again', screen());
    click('practice');
    await until(() => window.asteroids.state() === 'playing');
    note('practice', [screen(), el('practice') && window.asteroids.state()]);
    await tap('Escape');
    el('bossPick').value = '0';
    el('bossTier').value = '0';
    el('bossPhase').value = '0';
    click('bossPracticeStart');
    await until(() => !el('bossBar')?.hidden, 6000);
    note('boss practice', [screen(), !el('bossBar')?.hidden]);
    await tap('Escape');
    click('endPractice');
    await wait(500);
    note('after end practice', screen());
    for (const target of ['records', 'hangar', 'settings', 'help']) {
        location.hash = '#' + target;
        await wait(400);
        note(target, screen());
    }
    location.hash = '#home';
    await wait(400);
    note('final', screen());
    return log;
}
