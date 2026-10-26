import { CoopInput } from './coop-input.mjs';
import { createCoopScreen } from './screens/coop.mjs';
import { renderDiagnostics } from './screens/diagnostics.mjs';
import { renderPractice } from './screens/practice.mjs';
import { createBossUi } from './bossui.mjs';
import { renderPlayChrome } from './screens/play-chrome.mjs';
import { element } from './dom.mjs';
import { createSettingsScreen } from './screens/settings.mjs';
import { createHelpScreen } from './screens/help.mjs';
import { createHangarScreen } from './screens/hangar.mjs';
import { createModeScreen } from './screens/mode.mjs';
import { loadHangar, hullById } from './hangar.mjs';
import { createUnlocks } from './unlocks.mjs';
import { createRecordsActions } from './screens/records-actions.mjs';
import { renderPlayHud } from './screens/play.mjs';
import { renderResultsScreen } from './screens/results.mjs';
import { renderRecordsScreen } from './screens/records.mjs';
import { renderHomeScreen } from './screens/home.mjs';
import { adjustField } from './menu-fields.mjs';
import { createDemo } from './demo/engine.mjs';
import { Navigation, MenuInput, routeFromHash, fitPlayfield } from './navigation.mjs';
import { accuracyText } from './records.mjs';
import { drawHome, drawWarp, LaunchSequence } from './presentation.mjs';
import { createRuntime } from './runtime.mjs';
import { Controls } from './controls.mjs';
import {
    defaults,
    loadProfiles,
    saveProfiles,
    sanitizeSettings,
    SettingsDraft,
} from './settings.mjs';
import { setupCalibration } from './calibration.mjs';
import { GameAudio } from './audio.mjs';
import { PixelRenderer, loadArt, WIDTH, HEIGHT } from './renderer.mjs';

const canvas = element('game');
let renderer;
const bossUi = createBossUi();
const controllerLabel = element('controller');
const stateLabel = element('state');
const hint = element('hint');
const fireButton = element('fire');
const inputDiagnostics = element('inputDiagnostics');
inputDiagnostics.hidden = !new URLSearchParams(location.search).has('input-fix');
let diagnosticPad = null;
const pauseButton = element('pause');
const soundButton = element('sound');
let storage;
try {
    storage = localStorage;
} catch {}
const profileStore = loadProfiles(storage);
const unlocks = createUnlocks(storage);
let lastBossMask = 0,
    toastTimer = 0;
const hangarStore = loadHangar(storage);
let gameArt = null;
const settings = sanitizeSettings(profileStore.profiles[profileStore.activeProfile]);
try {
    if (
        !storage?.getItem('asteroids.web.settings-v1') &&
        matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
        settings.shake = 0;
        for (const profile of profileStore.profiles) profile.shake = 0;
    }
} catch {}
const controls = new Controls(settings);
const coopInput = new CoopInput(profileStore.profiles);
function connectedPads() {
    try {
        return Array.from(navigator.getGamepads?.() || []);
    } catch {
        return [];
    }
}
function keyboardControls() {
    return runtime?.coop ? coopInput.keyboard() : controls;
}
const coopScreen = createCoopScreen({
    input: coopInput,
    getPads: connectedPads,
    getRuntime: () => runtime,
    getNavigation: () => navigation,
    launch: beginLaunch,
    profiles: () => profileStore.profiles,
});
const settingsDraft = new SettingsDraft(profileStore, settings);
const applyButton = element('applySettings');
const audio = new GameAudio(settings);
const settingsStatus = element('settingsStatus');
const practiceButton = element('practice');
let runtime,
    navigation,
    demoEngine,
    activePadIndex = null;
const settingsUi = { category: 'controls', rebinding: null };
let menuEditing = false,
    menuDevice = 'keyboard';
const menuInput = new MenuInput();
const physicalKeys = new Set(),
    pointerButtons = new Set();
let coopResumeReady = false;
let gameplayReady = false,
    routeFromHistory = false,
    lastMenuPad = null;
const focusOrigins = new Map();
function isSettingsOpen() {
    return navigation?.screen === 'settings';
}
let suspended = false,
    previousTime = null,
    accumulator = 0;
let lastState = '',
    pointerPosition = null;
const hud = Object.fromEntries(
    [
        'lives',
        'wave',
        'score',
        'multiplier',
        'chainFill',
        'laserStatus',
        'laserFill',
        'shieldStatus',
        'precisionStatus',
    ].map((id) => [id, element(id)]),
);
function setTone(value) {
    audio.setTone(value);
}
function unlockAudio() {
    audio.unlock();
}
function persistSettings() {
    profileStore.profiles[profileStore.activeProfile] = sanitizeSettings(settings);
    settingsStatus.textContent = saveProfiles(storage, profileStore)
        ? 'Saved locally'
        : 'Storage unavailable; settings apply for this visit';
    syncSettingsEffects();
}
function syncSettingsEffects() {
    audio.apply();
    if (renderer) {
        renderer.shake = settings.shake;
        renderer.backgrounds.motion = settings.backgroundMotion;
        renderer.backgrounds.brightness = settings.backgroundBrightness;
    }
    runtime?.bossAssist({ longWarnings: settings.bossLongWarnings, calm: settings.bossCalm });
    soundButton.textContent = settings.soundEnabled ? 'Sound on' : 'Sound off';
    soundButton.setAttribute('aria-pressed', String(settings.soundEnabled));
    element('music').textContent = settings.musicEnabled ? 'Music on' : 'Music off';
    element('music').setAttribute('aria-pressed', String(settings.musicEnabled));
}
const calibration = setupCalibration({
    settings,
    findController,
    persist: markSettingsChanged,
    render: renderSettings,
});
const settingsScreen = createSettingsScreen({
    settings,
    profileStore,
    settingsDraft,
    settingsUi,
    applyButton,
    settingsStatus,
    storage,
    controls,
    unlockAudio,
    calibration,
});
const helpScreen = createHelpScreen(settings);
const hangarScreen = createHangarScreen({
    getArt: () => gameArt,
    store: hangarStore,
    storage,
    unlocks,
    activeProfile: () => profileStore.activeProfile,
    reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
});
const modeScreen = createModeScreen({
    getArt: () => gameArt,
    store: hangarStore,
    activeProfile: () => profileStore.activeProfile,
    reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
});
function renderSettings() {
    settingsScreen.render();
}
function markSettingsChanged() {
    settingsScreen.changed();
}
function selectCategory(category) {
    settingsScreen.select(category);
}
function openSettings(event) {
    navigate('settings', event.currentTarget);
}
element('settingsOpen').addEventListener('click', openSettings);
element('pauseSettings').addEventListener('click', openSettings);
function applyDraft() {
    const saved = settingsDraft.apply(storage);
    controls.clear();
    calibration.reset();
    syncSettingsEffects();
    applyButton.disabled = true;
    settingsStatus.textContent = saved
        ? 'Applied and saved locally'
        : 'Applied for this visit; storage unavailable';
}
applyButton.addEventListener('click', applyDraft);
element('resetSettings').addEventListener('click', () => {
    Object.assign(settings, defaults());
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) settings.shake = 0;
    settingsUi.rebinding = null;
    controls.clear();
    calibration.reset();
    renderSettings();
    markSettingsChanged();
});
practiceButton.addEventListener('click', () => {
    if (consumeDemo()) return;
    navigation.start(true);
});
// Practice tools run from the Pause menu and drop you straight back into the flight.
for (const [id, action] of [
    ['resetTargets', () => runtime.resetTargets()],
    ['practiceDoubleFire', () => runtime.doubleFire()],
    ['practiceMultishot', () => runtime.multishot()],
]) {
    element(id).addEventListener('click', () => {
        action();
        navigation.resume();
    });
}
element('bossPracticeStart').addEventListener('click', () => {
    controls.clear();
    runtime.bossPractice(
        Number(element('bossPick').value),
        Number(element('bossTier').value),
        Number(element('bossPhase').value),
    );
    navigation.resume();
});
element('endPractice').addEventListener('click', () => {
    controls.clear();
    pointerPosition = null;
    runtime.menu();
    navigation.set('play');
    draw();
    fitCanvas();
});
element('continueResults').addEventListener('click', () => {
    coopInput.clear();
    runtime.continueResults();
    controls.clear();
    gameplayReady = false;
    menuInput.reset();
    pointerPosition = null;
    if (runtime.state === 'menu') navigation.request('home');
    draw();
});
const recordsActions = createRecordsActions({
    getRuntime: () => runtime,
    profileStore,
    draw,
});
function findController() {
    if (runtime?.coop) {
        const owner = isSettingsOpen()
            ? Math.max(0, coopInput.profileIds.indexOf(profileStore.activeProfile))
            : coopInput.menuOwner;
        return coopInput.pad(owner, connectedPads());
    }
    let pads = [];
    try {
        pads = [...(navigator.getGamepads?.() || [])];
    } catch {}
    const current = pads.find(
        (pad) => pad?.index === activePadIndex && pad.connected && pad.mapping === 'standard',
    );
    const pad = current || pads.find((pad) => pad?.connected && pad.mapping === 'standard');
    if (activePadIndex !== null && !current && runtime) runtime.pause();
    activePadIndex = pad?.index ?? null;
    const label = pad
        ? `${pad.id} · connected`
        : pads.some(Boolean)
          ? 'Controller mapping unavailable · keyboard ready'
          : '';
    const compact = pad ? 'Controller connected' : 'Keyboard + mouse';
    controllerLabel.textContent = pad ? compact : label;
    element('runDevice').textContent = pad ? compact : 'Keyboard + mouse';
    if (navigation?.screen === 'help') helpScreen.render(!!pad && menuDevice === 'controller');
    return pad;
}
// A first defeat of a mini-boss in a real run earns its Hangar hull.
function trackBossUnlocks(scene) {
    const mask = scene[610] | 0;
    if (!mask) {
        lastBossMask = 0;
        return;
    }
    const fresh = mask & ~lastBossMask;
    lastBossMask = mask;
    if (!fresh || scene[609]) return;
    const profiles = runtime.coop ? (coopInput.profileIds ?? [0, 1]) : [profileStore.activeProfile];
    for (const hull of unlocks.hullsFor(fresh))
        if (profiles.map((profile) => unlocks.grant(profile, hull)).some(Boolean)) {
            const toast = element('unlockToast');
            toast.textContent = `${hullById(hull).name} hull unlocked · see Hangar`;
            toast.hidden = false;
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => (toast.hidden = true), 4200);
        }
}
function draw() {
    const update = (element, text) => {
        if (element.textContent !== text) element.textContent = text;
    };
    const scene = runtime.scene();
    if (['play', 'pause'].includes(navigation.screen) && runtime.state !== 'results') {
        renderer.hulls = runtime.coop
            ? [0, 1].map((slot) => hangarStore.profiles[coopInput.profileIds?.[slot] ?? slot])
            : [hangarStore.profiles[profileStore.activeProfile]];
        renderer.render(scene, runtime.coop ? runtime.coopPlayers() : null);
    }
    trackBossUnlocks(scene);
    bossUi.render(
        scene,
        navigation.screen === 'play' && ['playing', 'countdown', 'death'].includes(runtime.state),
    );
    renderHomeScreen({
        demoEngine,
        navigation,
        controllerLabel,
        menuDevice,
        profileStore,
    });
    renderDiagnostics({
        inputDiagnostics,
        diagnosticPad,
        runtime,
        controls,
        update,
    });
    audio.suspend(suspended || navigation.screen !== 'play');
    audio.observe(scene);
    audio.setMode(
        navigation.screen === 'home' && !demoEngine?.active
            ? 'home'
            : navigation.screen === 'play' && ['playing', 'countdown'].includes(runtime.state)
              ? 'flight'
              : 'off',
        suspended,
    );
    renderPractice({
        scene,
        navigation,
        runtime,
        update,
        practiceButton,
        fitCanvas,
    });
    const results = element('runSummary');
    const result = runtime.result;
    const showResults = runtime.state === 'results';
    const stats = runtime.stats();
    update(
        element('doubleFireStatus'),
        stats.doubleFireMs ? `${(stats.doubleFireMs / 1000).toFixed(1)}s` : 'INACTIVE',
    );
    element('doubleFireStatus')
        .closest('.ability')
        ?.setAttribute('data-state', stats.doubleFireMs ? 'active' : 'empty');
    update(element('liveCps'), String(stats.cps));
    update(element('liveAccuracy'), accuracyText(stats.hits, stats.spawned));
    update(element('liveChain'), String(stats.longestChain));
    renderRecordsScreen({
        runtime,
        resetRecordsArmed: recordsActions.armed,
        resetProfile: recordsActions.profile,
        disarmRecordsReset: recordsActions.disarmRecordsReset,
        bossArt: renderer?.bossArt,
        update,
    });
    renderResultsScreen({
        results,
        showResults,
        canvas,
        lastState,
        result,
        scene,
        update,
    });
    renderPlayHud({ hud, scene, update });
    const nextState = renderPlayChrome({
        runtime,
        navigation,
        showResults,
        canvas,
        fireButton,
        soundButton,
        pauseButton,
        hint,
        scene,
        controls,
        menuInput,
        stateLabel,
        lastState,
        update,
        isSettingsOpen,
    });
    coopScreen.render();
    if (nextState !== lastState) {
        gameplayReady = false;
        if (runtime.coop && nextState === 'game-over') fireButton.focus();
    }
    lastState = nextState;
}
// Preserve brief controller releases between the fixed simulation ticks.
// No gameplay or DOM work occurs in this input-only polling callback.
setInterval(() => {
    if (
        !runtime ||
        suspended ||
        navigation.screen !== 'play' ||
        runtime.state === 'results' ||
        !gameplayReady
    )
        return;
    let pads = [];
    try {
        pads = navigator.getGamepads?.() || [];
    } catch {}
    const pad =
        Array.from(pads).find((p) => p?.index === activePadIndex && p.connected) ||
        Array.from(pads).find((p) => p?.connected && p.mapping === 'standard');
    if (runtime.coop) coopInput.observe(connectedPads());
    else controls.observeController(pad);
}, 4);
const homeFx = element('homeFx').getContext('2d'),
    launchCanvas = element('launchCanvas').getContext('2d');
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const launch = new LaunchSequence({ reduced: reducedQuery.matches });
let presentationTime = 0,
    presentationLast = null,
    lastHomeFrame = -1;
reducedQuery.addEventListener('change', (event) => {
    launch.reduced = event.matches;
    lastHomeFrame = -1;
});
// The launch is presentation only: the run starts, and its clock runs, when it ends.
function beginLaunch(go) {
    const overlay = element('launch');
    controls.clear();
    menuInput.reset();
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.querySelector('.app-shell').inert = true;
    element('skipLaunch').focus();
    unlockAudio();
    audio.setMode('off');
    audio.startWarp();
    launch.begin(presentationTime, (started) => {
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        document.querySelector('.app-shell').inert = false;
        controls.clear();
        menuInput.reset();
        gameplayReady = false;
        pointerPosition = null;
        audio.stopWarp();
        if (started) go();
        else {
            coopInput.live = false;
            if (navigation.screen === 'lobby') element('coopStart').focus();
            else element('play').focus();
        }
    });
}
element('skipLaunch').addEventListener('click', () => launch.skip());
window.addEventListener(
    'keydown',
    (event) => {
        if (!launch.active) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        physicalKeys.add(event.code);
        if (event.repeat) return;
        if (event.code === 'Escape') launch.cancel();
        else if (['Enter', 'Space'].includes(event.code)) launch.skip();
        else if (event.code === 'Tab') element('skipLaunch').focus();
    },
    true,
);
function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = presentationLast === null ? 0 : Math.min(100, now - presentationLast);
    presentationLast = now;
    if (!suspended) presentationTime += elapsed;
    if (launch.active) {
        if (coopInput.live && !coopInput.valid(connectedPads())) {
            launch.cancel();
            coopScreen.reset();
        }
        if (!suspended) {
            if (launch.reduced) {
                launchCanvas.fillStyle = '#03060f';
                launchCanvas.fillRect(0, 0, 480, 270);
            } else drawWarp(launchCanvas, launch.elapsed(presentationTime));
            const padInput = menuInput.sample(findController(), now, settings.buttons.pause);
            if (padInput.back) launch.cancel();
            else if (padInput.confirm || padInput.pause) launch.skip();
            launch.tick(presentationTime);
        }
        previousTime = now;
        return;
    }
    if (navigation?.screen === 'home' && !demoEngine?.active && !suspended) {
        const frame = reducedQuery.matches
            ? -2
            : Math.floor((presentationTime * settings.backgroundMotion) / 50);
        if (frame !== lastHomeFrame) {
            drawHome(homeFx, presentationTime * settings.backgroundMotion, {
                reduced: reducedQuery.matches,
                art: gameArt,
                hull: hangarStore.profiles[profileStore.activeProfile],
            });
            lastHomeFrame = frame;
        }
    }
    if (navigation?.screen === 'hangar') hangarScreen.draw(presentationTime);
    else if (navigation?.screen === 'mode') modeScreen.draw(presentationTime);
    if (runtime?.coop && navigation.screen === 'pause') {
        const sampled = coopInput.sample(connectedPads(), now);
        runtime.releaseCoopLasers(sampled.players);
    }
    if (
        runtime?.coop &&
        navigation.screen === 'pause' &&
        coopInput.neutral(connectedPads(), physicalKeys.size, pointerButtons.size)
    )
        coopResumeReady = true;
    const pad = runtime?.coop
        ? coopInput.pad(coopInput.menuOwner, connectedPads())
        : findController();
    diagnosticPad = pad;
    if (gameplayReady && navigation.screen === 'play' && runtime.state !== 'results' && !suspended)
        if (runtime.coop) coopInput.observe(connectedPads());
        else controls.observeController(pad);
    const padId = pad?.index ?? null;
    if (padId !== lastMenuPad) {
        menuInput.reset();
        lastMenuPad = padId;
        gameplayReady = false;
        if (pad)
            element('pauseSettingsHint').textContent =
                'Release controls before selecting Resume · Cross: select · Circle: back';
    }
    if (
        !suspended &&
        (navigation?.screen !== 'play' ||
            runtime?.state === 'results' ||
            (runtime?.coop && runtime.state === 'game-over') ||
            navigation.pending)
    )
        if (navigation.screen === 'lobby' && !navigation.pending)
            coopScreen.handlePads(connectedPads(), now);
        else handleMenuPad(pad, now);
    // Cross confirms the focused menu action; gameplay bindings stay separate.
    if (isSettingsOpen() && settingsUi.category === 'calibration') calibration.update(now);
    if (!runtime || suspended) {
        previousTime = now;
        return;
    }
    advanceSimulation(now, pad);
    draw();
}
function advanceSimulation(now, pad) {
    const delta = previousTime === null ? 0 : now - previousTime;
    previousTime = now;
    // Advance in exact 20 ms ticks. Long stalls freeze rather than skip physics.
    accumulator += delta > 100 ? 0 : delta;
    while (accumulator >= 20) {
        if ((!navigation.shouldStep && !demoEngine?.active) || element('navigationDecision').open) {
            accumulator = 0;
            break;
        }
        if (pointerPosition) {
            const rect = canvas.getBoundingClientRect(),
                scene = runtime.coop
                    ? runtime.coopPlayers()[Math.max(0, coopInput.keyboardSlot())].scene
                    : runtime.scene();
            keyboardControls()?.aimAt(
                ((pointerPosition[0] - rect.left) * WIDTH) / rect.width - scene[4],
                ((pointerPosition[1] - rect.top) * HEIGHT) / rect.height - scene[5],
            );
        }
        if (navigation.screen === 'home') demoEngine?.step();
        else if (runtime.state === 'results') runtime.step();
        else {
            if (runtime.coop) {
                const pads = connectedPads();
                if (!coopInput.valid(pads)) {
                    navigation.pause();
                    accumulator = 0;
                    break;
                }
                if (
                    !gameplayReady &&
                    coopInput.neutral(pads, physicalKeys.size, pointerButtons.size)
                ) {
                    coopInput.clear();
                    gameplayReady = true;
                }
                runtime.step(gameplayReady ? coopInput.sample(pads, now) : { players: [{}, {}] });
                navigation.sync();
                accumulator -= 20;
                continue;
            }
            const held =
                physicalKeys.size ||
                pointerButtons.size ||
                (pad?.buttons || []).some((b) => b?.pressed || b?.value > 0.2) ||
                (pad?.axes || []).some((v) => Math.abs(v) > 0.55);
            if (!gameplayReady && !held) {
                controls.clear();
                gameplayReady = true;
            }
            runtime.step(gameplayReady ? controls.sample(findController(), now) : {});
            navigation.sync();
        }
        accumulator -= 20;
    }
}
window.addEventListener('keydown', (event) => {
    menuDevice = 'keyboard';
    physicalKeys.add(event.code);
    if (
        event.repeat &&
        ['Enter', 'Space'].includes(event.code) &&
        (navigation.screen !== 'play' || runtime.state === 'results')
    ) {
        event.preventDefault();
        return;
    }
    if (element('navigationDecision').open) {
        if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.code)) {
            event.preventDefault();
            moveMenuFocus(['ArrowLeft', 'ArrowUp'].includes(event.code) ? -1 : 1);
        }
        return;
    }
    if (isSettingsOpen()) {
        if (!settingsUi.rebinding && event.code === 'Escape') {
            event.preventDefault();
            if (menuEditing) {
                menuEditing = false;
                return;
            }
            navigation.back();
            return;
        }
        if (!settingsUi.rebinding && ['ArrowUp', 'ArrowDown'].includes(event.code)) {
            event.preventDefault();
            const direction = event.code === 'ArrowUp' ? -1 : 1;
            if (menuEditing && event.target.matches('select')) adjustField(event.target, direction);
            else {
                menuEditing = false;
                moveMenuFocus(direction);
            }
            return;
        }
        if (
            !settingsUi.rebinding &&
            event.code === 'Enter' &&
            event.target.matches('select,input[type=range]')
        ) {
            event.preventDefault();
            menuEditing = !menuEditing;
            return;
        }
        if (
            !settingsUi.rebinding &&
            ['ArrowLeft', 'ArrowRight'].includes(event.code) &&
            event.target.matches('select')
        ) {
            event.preventDefault();
            adjustField(event.target, event.code === 'ArrowLeft' ? -1 : 1);
            return;
        }
        if (
            !settingsUi.rebinding &&
            ['ArrowLeft', 'ArrowRight'].includes(event.code) &&
            event.target.matches('[data-category]')
        ) {
            event.preventDefault();
            const buttons = [...document.querySelectorAll('[data-category]')],
                index = buttons.indexOf(event.target);
            buttons[
                (index + (event.code === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length
            ].click();
            return;
        }
        if (settingsUi.rebinding) {
            event.preventDefault();
            event.stopPropagation();
            if (event.code === 'Escape') {
                const action = settingsUi.rebinding;
                settingsUi.rebinding = null;
                renderSettings();
                document.querySelector(`#keyBindings [data-action="${action}"]`).focus();
                settingsStatus.textContent = 'Key change canceled';
                return;
            }
            const candidate = {
                ...settings,
                keys: { ...settings.keys, [settingsUi.rebinding]: event.code },
            };
            const conflict = Object.keys(settings.keys).find(
                (key) => key !== settingsUi.rebinding && settings.keys[key] === event.code,
            );
            if (conflict) candidate.keys[conflict] = settings.keys[settingsUi.rebinding];
            if (sanitizeSettings(candidate).keys[settingsUi.rebinding] !== event.code) {
                settingsStatus.textContent =
                    'Choose a letter, number, modifier, Space or punctuation key.';
                return;
            }
            const action = settingsUi.rebinding;
            settings.keys = candidate.keys;
            settingsUi.rebinding = null;
            renderSettings();
            markSettingsChanged();
            document.querySelector(`#keyBindings [data-action="${action}"]`).focus();
        }
        return;
    }
    if (
        navigation?.screen !== 'play' ||
        runtime?.state === 'results' ||
        (runtime?.coop && runtime.state === 'game-over') ||
        navigation.pending
    ) {
        if (event.repeat && ['Enter', 'Space'].includes(event.code)) {
            event.preventDefault();
            return;
        }
        if (consumeDemo()) {
            event.preventDefault();
            return;
        }
        if (event.code === 'Escape') {
            event.preventDefault();
            if (menuEditing) {
                menuEditing = false;
                return;
            }
            navigation.back();
            return;
        }
        if (['ArrowUp', 'ArrowDown'].includes(event.code)) {
            event.preventDefault();
            const direction = event.code === 'ArrowUp' ? -1 : 1;
            if (menuEditing && event.target.matches('select')) adjustField(event.target, direction);
            else {
                menuEditing = false;
                moveMenuFocus(direction);
            }
            return;
        }
        if (
            ['ArrowLeft', 'ArrowRight'].includes(event.code) &&
            event.target.matches('select,input[type=range]')
        ) {
            event.preventDefault();
            adjustField(event.target, event.code === 'ArrowLeft' ? -1 : 1);
            return;
        }
        if (event.code === 'Enter' && event.target.matches('select,input[type=range]')) {
            event.preventDefault();
            menuEditing = !menuEditing;
            return;
        }
        if (event.code === 'Enter' && !event.target.closest('button,a,input,select')) {
            event.preventDefault();
            const scope = menuScope();
            scope.querySelector('button:not([hidden]):not(:disabled)')?.click();
        }
        return;
    }
    if (
        navigation.live &&
        ['Escape', keyboardControls()?.settings.keys.pause ?? settings.keys.pause].includes(
            event.code,
        )
    ) {
        event.preventDefault();
        if (!event.repeat) {
            if (runtime.coop && coopInput.keyboardSlot() >= 0)
                coopInput.menuOwner = coopInput.keyboardSlot();
            navigation.pause();
        }
        return;
    }
    const keySettings = keyboardControls()?.settings ?? settings;
    const accepted = [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Enter',
        'Escape',
        ...Object.values(keySettings.keys),
    ];
    if (!accepted.includes(event.code) || event.target.closest('button, input, select, textarea'))
        return;
    event.preventDefault();
    unlockAudio();
    keyboardControls()?.keyDown(event.code, event.repeat);
});
canvas.addEventListener('pointermove', (event) => {
    if (navigation.screen === 'play' && event.pointerType === 'mouse') {
        pointerPosition = [event.clientX, event.clientY];
        keyboardControls()?.activateMouseAim();
    }
});
canvas.addEventListener('pointerdown', (event) => {
    if (
        navigation.screen !== 'play' ||
        event.pointerType !== 'mouse' ||
        ![0, 2].includes(event.button)
    )
        return;
    event.preventDefault();
    canvas.focus();
    keyboardControls()?.activateMouseAim();
    pointerPosition = [event.clientX, event.clientY];
    keyboardControls()?.pointerDown(event.button, performance.now());
    canvas.setPointerCapture(event.pointerId);
});
window.addEventListener('pointerup', (event) => keyboardControls()?.pointerUp(event.button));
canvas.addEventListener('pointercancel', () => {
    controls.clear();
    pointerPosition = null;
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('keyup', (event) => {
    physicalKeys.delete(event.code);
    keyboardControls()?.keyUp(event.code);
});
window.addEventListener('pointerdown', (event) => {
    menuDevice = 'mouse';
    pointerButtons.add(event.button);
});
window.addEventListener('pointerup', (event) => pointerButtons.delete(event.button));
window.addEventListener('pointerdown', unlockAudio);
function suspend() {
    coopScreen.resetMenu();
    coopInput.clear();
    presentationLast = null;
    controls.clear();
    physicalKeys.clear();
    pointerButtons.clear();
    navigation?.pause();
    suspended = true;
    accumulator = 0;
    pointerPosition = null;
    audio.suspend(true);
    if (runtime) draw();
}
window.addEventListener('blur', suspend);
window.addEventListener('focus', () => {
    suspended = false;
    previousTime = null;
    presentationLast = null;
    audio.suspend(isSettingsOpen());
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend();
    else {
        suspended = false;
        previousTime = null;
        presentationLast = null;
        audio.suspend(isSettingsOpen());
    }
});
window.addEventListener('gamepaddisconnected', (event) => {
    if (runtime?.coop) {
        if (coopInput.lost(event.gamepad.index)) {
            navigation.pause();
            coopInput.clear();
            menuInput.reset();
            gameplayReady = false;
            draw();
        }
        return;
    }
    findController();
    controls.clear();
    menuInput.reset();
    gameplayReady = false;
    element('pauseSettingsHint').textContent =
        'Controller disconnected. Reconnect and release controls, or continue with keyboard.';
});
fireButton.addEventListener('click', () => {
    if (runtime?.coop && runtime.state === 'game-over') {
        runtime.abandon();
        coopScreen.reset();
        navigation.set('lobby');
        return;
    }
    if (runtime?.coop && runtime.state === 'initials') {
        runtime.step({ firePressed: true });
        draw();
        return;
    }
    if (runtime?.state === 'results') {
        runtime.continueResults();
        controls.discardFirePresses();
        draw();
        return;
    }
    controls.pulseUntil = performance.now() + 70;
    canvas.focus();
});
pauseButton.addEventListener('click', () => {
    if (navigation.screen === 'pause') navigation.resume();
    else navigation.pause();
    draw();
});
element('music').addEventListener('click', () => {
    unlockAudio();
    settings.musicEnabled = !settings.musicEnabled;
    persistSettings();
});
soundButton.addEventListener('click', () => {
    unlockAudio();
    settings.soundEnabled = !settings.soundEnabled;
    persistSettings();
    soundButton.focus();
});
element('fullscreen').addEventListener('click', async () => {
    try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.querySelector('.app-shell').requestFullscreen();
        element('fullscreen').focus();
        fitCanvas();
    } catch {
        hint.textContent = 'Fullscreen unavailable in this browser';
        element('shellStatus').textContent = 'Fullscreen unavailable in this browser';
    }
});
function fitCanvas() {
    if (!navigation || !['play', 'pause'].includes(navigation.screen)) return;
    const field = document.querySelector('.screen'),
        panel = document.querySelector('.console');
    const style = getComputedStyle(panel),
        num = (name) => parseFloat(style[name]) || 0;
    const chrome = [...panel.children].filter(
        (el) =>
            el !== field &&
            !el.hidden &&
            getComputedStyle(el).display !== 'none' &&
            getComputedStyle(el).position !== 'absolute',
    );
    const height = chrome.reduce((n, el) => {
        const s = getComputedStyle(el);
        return (
            n +
            el.getBoundingClientRect().height +
            (parseFloat(s.marginTop) || 0) +
            (parseFloat(s.marginBottom) || 0)
        );
    }, 0);
    const size = fitPlayfield(
        panel.clientWidth - num('paddingLeft') - num('paddingRight'),
        panel.clientHeight -
            num('paddingTop') -
            num('paddingBottom') -
            height -
            num('gap') * chrome.length,
    );
    field.style.width = `${size.width}px`;
    field.style.height = `${size.height}px`;
    // Share the letterbox height so the HUD can move into tall bars.
    const bar = Math.max(0, (panel.clientHeight - size.height) / 2);
    document.body.style.setProperty('--bar', `${bar}px`);
    document.body.dataset.bars = String(bar >= 78);
}
window.addEventListener('resize', fitCanvas);
document.addEventListener('fullscreenchange', fitCanvas);
function consumeDemo() {
    if (demoEngine?.active) {
        demoEngine.stop();
        controls.clear();
        menuInput.reset();
        draw();
        element('watchDemo').focus();
        return true;
    }
    return false;
}
function navigate(target, invoker = document.activeElement) {
    if (!navigation) return;
    if (consumeDemo()) return;
    focusOrigins.set(navigation.screen, invoker);
    navigation.request(target);
}
function menuScope() {
    const decision = element('navigationDecision');
    if (decision.open) return decision;
    if (demoEngine?.active) return element('demoControls');
    if (runtime?.state === 'results' && navigation.screen === 'play') return element('runSummary');
    if (navigation.screen === 'pause') return element('pauseMenu');
    if (runtime?.coop && runtime.state === 'game-over') return document.querySelector('.toolbar');
    return document.querySelector(`[data-view="${navigation.screen}"]`);
}
function moveMenuFocus(direction) {
    const nodes = [...menuScope().querySelectorAll('button,a,input,select')].filter(
        (el) => !el.disabled && !el.hidden && !el.closest('[inert]') && el.getClientRects().length,
    );
    if (!nodes.length) return;
    const current = nodes.indexOf(document.activeElement);
    nodes[(current + direction + nodes.length) % nodes.length].focus();
}
// Moves focus toward the nearest control in a direction, so a grid (the Hangar
// bay, a pair of mode cards) works with the d-pad as it looks, not as the DOM
// is ordered. Falls back to wrapping through the list when nothing lies that way.
function scrollerOf(el) {
    for (let node = el.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);
        if (/(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1)
            return node;
    }
    return document.scrollingElement;
}
function onScreen(el) {
    const box = el.getBoundingClientRect(),
        scroller = scrollerOf(el);
    const clip =
        scroller === document.scrollingElement
            ? { top: 0, bottom: innerHeight }
            : scroller.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    return middle >= Math.max(0, clip.top) && middle <= Math.min(innerHeight, clip.bottom);
}
function moveMenuFocusToward(dx, dy) {
    const nodes = [...menuScope().querySelectorAll('button,a,input,select')].filter(
        (el) => !el.disabled && !el.hidden && !el.closest('[inert]') && el.getClientRects().length,
    );
    const current = nodes.indexOf(document.activeElement);
    if (current < 0) {
        nodes[0]?.focus();
        return;
    }
    // From the Settings rail, Right enters the panel at its first control.
    if (dx > 0 && nodes[current].closest('.settings-tabs')) {
        const first = nodes.find((el) => el.closest('[data-settings-panel]'));
        if (first) {
            first.focus();
            return;
        }
    }
    const from = nodes[current].getBoundingClientRect(),
        home = scrollerOf(nodes[current]);
    const fx = from.left + from.width / 2,
        fy = from.top + from.height / 2;
    const options = [];
    for (const [index, node] of nodes.entries()) {
        if (index === current) continue;
        const box = node.getBoundingClientRect();
        const along = (box.left + box.width / 2 - fx) * dx + (box.top + box.height / 2 - fy) * dy;
        if (along <= 2) continue;
        const across = Math.abs(
            (box.left + box.width / 2 - fx) * dy + (box.top + box.height / 2 - fy) * dx,
        );
        options.push({
            node,
            rank: along + across * 2.5,
            same: scrollerOf(node) === home,
            shown: onScreen(node),
        });
    }
    const nearest = (list) => list.sort((a, b) => a.rank - b.rank)[0]?.node;
    // Sideways: the nearest visible control, wherever it lives. Up and down: walk
    // the current scrolling area in order (revealing hidden rows) before leaving it.
    const target = dx
        ? nearest(options.filter((o) => o.shown)) || nearest(options)
        : nearest(options.filter((o) => o.same)) ||
          nearest(options.filter((o) => o.shown)) ||
          nearest(options);
    if (target) target.focus();
    else moveMenuFocus(dx + dy > 0 ? 1 : -1);
}
// L1 / R1 step through the active tab strip (Settings categories, Hangar pilots).
function stepMenuTab(direction) {
    const tabs = [
        ...menuScope().querySelectorAll('.settings-tabs button, .hangar-pilots button'),
    ].filter((el) => !el.disabled && !el.closest('[inert]') && el.getClientRects().length);
    if (tabs.length < 2) return false;
    const active = tabs.findIndex((el) => el.getAttribute('aria-pressed') === 'true');
    const target = tabs[(Math.max(0, active) + direction + tabs.length) % tabs.length];
    target.click();
    return true;
}
function handleMenuPad(pad, now) {
    if (!navigation) return;
    const menuPause = runtime?.coop
        ? coopInput.controls[coopInput.menuOwner].settings.buttons.pause
        : settings.buttons.pause;
    const input = menuInput.sample(pad, now, menuPause);
    if (
        !input.direction &&
        !input.horizontal &&
        !input.confirm &&
        !input.back &&
        !input.pause &&
        !input.tab
    )
        return;
    menuDevice = 'controller';
    if (consumeDemo()) return;
    if (input.pause && navigation.screen === 'pause' && !navigation.pending) {
        navigation.resume();
        return;
    }
    const field = document.activeElement;
    if (input.tab && !navigation.pending) stepMenuTab(input.tab);
    if (input.horizontal && !adjustField(field, input.horizontal))
        moveMenuFocusToward(input.horizontal, 0);
    if (input.direction) {
        if (menuEditing && field.matches('select')) adjustField(field, input.direction);
        else {
            menuEditing = false;
            moveMenuFocusToward(0, input.direction);
        }
    }
    if (input.back) {
        if (settingsUi.rebinding) {
            const action = settingsUi.rebinding;
            settingsUi.rebinding = null;
            renderSettings();
            document.querySelector(`#keyBindings [data-action="${action}"]`).focus();
        } else if (menuEditing) menuEditing = false;
        else if (navigation.pending) navigation.resolve('stay');
        else navigation.back();
    }
    if (input.confirm) {
        const focused = document.activeElement;
        if (menuScope().contains(focused) && focused.matches('input[type=checkbox],button,a'))
            focused.click();
        else if (focused.matches('select,input[type=range]')) {
            menuEditing = !menuEditing;
            settingsStatus.textContent = menuEditing
                ? 'Left/right adjusts values; up/down changes select options. Circle ends editing.'
                : 'Cross selects; Circle goes back.';
        } else menuScope().querySelector('button:not([hidden]):not(:disabled)')?.click();
    }
}
function screenChanged(screen, previous) {
    coopScreen.resetMenu();
    coopInput.clear();
    coopResumeReady = false;
    if (screen === 'home' && !runtime?.coop) {
        coopInput.live = false;
        element('resume').disabled = false;
    }
    if (screen !== 'home') demoEngine?.stop();
    if (previous === 'records' && screen !== 'records') recordsActions.cancelBrowserReset();
    menuEditing = false;
    controls.clear();
    gameplayReady = false;
    pointerPosition = null;
    accumulator = 0;
    previousTime = null;
    menuInput.reset();
    if (previous === 'settings' && screen !== 'settings') {
        settingsDraft.discard();
        if (runtime?.coop) {
            coopInput.profiles = profileStore.profiles;
            coopInput.refresh();
        }
        syncSettingsEffects();
        settingsUi.rebinding = null;
        calibration.reset();
    }
    if (screen === 'settings' && previous !== 'settings') {
        selectCategory('controls');
        settingsDraft.begin();
        applyButton.disabled = true;
        settingsStatus.textContent = '';
        if (runtime?.coop)
            element('settingsProfileNote').textContent =
                'Profile 1 / 2 selects the matching co-op pilot’s controls and calibration. Audio and display are shared during this run.';
        calibration.reset();
        renderSettings();
    }
    const view = screen === 'pause' ? 'play' : screen;
    for (const el of document.querySelectorAll('[data-view]')) {
        el.hidden = el.dataset.view !== view;
        el.inert = el.hidden;
    }
    document.body.dataset.screen = screen;
    const titles = {
        home: 'Asteroids',
        play: 'Solo flight',
        pause: 'Paused',
        records: 'Records',
        settings: 'Settings',
        help: 'How to Play',
        developer: 'Developer tools',
        mode: 'Choose flight',
        hangar: 'Hangar',
        lobby: 'Local co-op',
    };
    element('screenTitle').textContent = titles[screen];
    element('screenBack').hidden = ['home', 'play', 'pause'].includes(screen);
    document.title = screen === 'home' ? 'Asteroids' : `${titles[screen]} · Asteroids`;
    element('helpPractice').hidden = navigation.origin === 'pause';
    element('helpPaused').hidden = navigation.origin !== 'pause';
    if (runtime) {
        draw();
        fitCanvas();
    }
    if (screen === 'hangar') hangarScreen.open();
    if (screen === 'mode') modeScreen.render();
    const decision = element('navigationDecision');
    if (navigation.pending) {
        const draft = navigation.pending.kind === 'draft',
            postRun = ['results', 'initials'].includes(runtime.state);
        element('decisionTitle').textContent = draft
            ? 'Unapplied settings'
            : postRun
              ? 'Leave score review?'
              : 'Quit this run?';
        element('decisionMessage').textContent = draft
            ? 'Apply your changes, discard them, or stay here.'
            : postRun
              ? 'Any initials you have not saved will be lost. Your personal bests are kept.'
              : 'Your current run will end. Stay paused to keep playing.';
        for (const button of decision.querySelectorAll('[data-decision]'))
            button.hidden = draft
                ? button.dataset.decision === 'quit'
                : ['apply', 'discard'].includes(button.dataset.decision);
        decision.querySelector('[data-decision="quit"]').textContent = postRun
            ? 'Leave to Home'
            : 'Quit run';
        if (!decision.open) decision.showModal();
        decision.querySelector('[data-decision="stay"]').focus();
    } else {
        if (decision.open) decision.close();
        const restore = focusOrigins.get(screen);
        if (restore?.isConnected && !restore.closest('[hidden]')) restore.focus();
        else if (screen === 'home') element('play').focus();
        else if (screen === 'pause') element('resume').focus();
        else if (screen === 'play') canvas.focus();
        else document.querySelector(`[data-view="${view}"] h1`)?.focus();
    }
    const hash = `#${['play', 'pause'].includes(screen) ? 'play' : screen}`;
    if (location.hash !== hash) {
        if (routeFromHistory || navigation.pending) history.replaceState(null, '', hash);
        else history.pushState(null, '', hash);
    }
}
element('watchDemo').addEventListener('click', () => {
    if (consumeDemo()) return;
    demoEngine?.start();
    menuInput.reset();
    accumulator = 0;
    previousTime = null;
    draw();
    element('stopDemo').focus();
});
element('stopDemo').addEventListener('click', () => consumeDemo());
element('retryRecords').addEventListener('click', () => {
    runtime.records.save();
    draw();
});
element('play').addEventListener('click', () => {
    if (!navigation || launch.active || consumeDemo()) return;
    navigation.request('mode');
});
element('soloPlay').addEventListener('click', () => {
    coopInput.live = false;
    beginLaunch(() => navigation.start());
});
element('localPlay').addEventListener('click', () => {
    coopScreen.reset();
    navigation.request('lobby');
});
element('resume').addEventListener('click', () => navigation.resume());
element('quitRun').addEventListener('click', () => navigation.request('home'));
element('gameHome').addEventListener('click', () => navigation.request('home'));
element('screenBack').addEventListener('click', () => navigation.back());
element('helpPractice').addEventListener('click', () => navigation.start(true));
for (const button of document.querySelectorAll('[data-go]'))
    button.addEventListener('click', () => navigate(button.dataset.go, button));
for (const button of document.querySelectorAll('[data-decision]'))
    button.addEventListener('click', () => navigation.resolve(button.dataset.decision));
element('navigationDecision').addEventListener('cancel', (event) => {
    event.preventDefault();
    navigation.resolve('stay');
});
window.addEventListener('hashchange', () => {
    if (launch.active) launch.cancel();
    if (!navigation) return;
    routeFromHistory = true;
    navigation.request(
        location.hash === '#play' && navigation.live ? 'pause' : routeFromHash(location.hash),
    );
    routeFromHistory = false;
});
window.addEventListener('beforeunload', (event) => {
    if (navigation?.live) {
        event.preventDefault();
        event.returnValue = '';
    }
});
new ResizeObserver(() => fitCanvas()).observe(document.querySelector('.console'));
new ResizeObserver(() => fitCanvas()).observe(element('coopHud'));
try {
    const response = await fetch('./game.wasm');
    if (!response.ok) throw new Error(`Game download failed (${response.status})`);
    const art = (gameArt = await loadArt()),
        bytes = await response.arrayBuffer();
    renderer = new PixelRenderer(canvas, art);
    demoEngine = await createDemo(
        bytes,
        new PixelRenderer(element('homeDemo'), art, { calm: true }),
    );
    element('watchDemo').disabled = false;
    runtime = await createRuntime(bytes, {
        storage,
        tone: setTone,
        scoreKey: 'asteroids.web.hd.scores-v3',
        profile: () => profileStore.activeProfile,
    });
    syncSettingsEffects();
    navigation = new Navigation({
        runtime,
        dirty: () => settingsDraft.changed(),
        apply: applyDraft,
        discard: () => settingsDraft.discard(),
        changed: screenChanged,
        canResume: () => {
            if (!runtime.coop) return true;
            const pads = connectedPads();
            const confirmKeys = new Set(['Enter', 'Space']);
            const ready =
                coopResumeReady &&
                coopInput.valid(pads) &&
                [...physicalKeys].every((key) => confirmKeys.has(key)) &&
                coopInput.devices.every((device, i) => {
                    if (device === 'keyboard') return true;
                    const pad = coopInput.pad(i, pads);
                    const allowed =
                        i === coopInput.menuOwner
                            ? [0, coopInput.controls[i].settings.buttons.pause]
                            : [];
                    return (
                        !(pad.axes || []).some((v) => Math.abs(v) > 0.55) &&
                        !(pad.buttons || []).some(
                            (b, index) => (b.pressed || b.value > 0.2) && !allowed.includes(index),
                        )
                    );
                });
            if (!ready)
                element('pauseSettingsHint').textContent =
                    'Assign both inputs and release sticks, triggers and keys before Resume.';
            return ready;
        },
    });
    fireButton.disabled = false;
    element('play').disabled = false;
    persistSettings();
    window.asteroids = Object.freeze({
        snapshot: () => runtime.snapshot(),
        state: () => runtime.state,
    });
    navigation.request(routeFromHash(location.hash));
    fitCanvas();
    draw();
    requestAnimationFrame(frame);
} catch (error) {
    stateLabel.textContent = 'UNAVAILABLE';
    element('homeHint').textContent = 'Could not load the game. Choose Reload to retry.';
    const retry = element('play');
    retry.disabled = false;
    retry.textContent = 'Reload';
    retry.addEventListener('click', () => location.reload(), { once: true });
    hint.textContent = 'Could not load the game. Serve web/dist over HTTP and reload.';
    console.error(error);
}
