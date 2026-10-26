import { createBossUi } from '../boss/ui.mjs';
import { setupCalibration } from '../input/calibration.mjs';
import { createDemo } from '../demo/engine.mjs';
import { createRuntime } from '../runtime/runtime.mjs';
import { PixelRenderer, loadArt } from '../render/renderer.mjs';
import { createCoopScreen } from '../screens/coop.mjs';
import { createHangarScreen } from '../screens/hangar.mjs';
import { createHelpScreen } from '../screens/help.mjs';
import { createModeScreen } from '../screens/mode.mjs';
import { createRecordsActions } from '../screens/records-actions.mjs';
import { createSettingsScreen } from '../screens/settings.mjs';
import { Navigation, routeFromHash } from '../state/navigation.mjs';
import { createServices } from './bootstrap.mjs';
import { BossUnlockToast } from './boss-unlock-toast.mjs';
import { element } from './dom.mjs';
import { GameLoop } from './game-loop.mjs';
import { HomeBackdrop } from './home-backdrop.mjs';
import { InputHub } from './input-hub.mjs';
import { KeyboardRouter } from './keyboard-router.mjs';
import { KeyRebinder } from './key-rebinder.mjs';
import { Layout } from './layout.mjs';
import { LaunchController } from './launch-controller.mjs';
import { MenuNavigator } from './menu-navigator.mjs';
import { prefersReducedMotion } from './motion.mjs';
import { PresentationClock } from './presentation-clock.mjs';
import { Presenter } from './presenter.mjs';
import { ScreenRouter } from './screen-router.mjs';
import { SettingsController } from './settings-controller.mjs';
import { CoopSession, SoloSession } from './sessions.mjs';
import { installActions } from './ui-actions.mjs';

// The composition root: builds the services, controllers and screens, wires them to each
// other through `this`, and boots the engine. Controllers read what they need from `app`
// when they run, so the order they are created in does not matter.
export class App {
    constructor() {
        Object.assign(this, createServices());
        this.canvas = element('game');
        this.inputDiagnostics = element('inputDiagnostics');
        this.inputDiagnostics.hidden = !new URLSearchParams(location.search).has('input-fix');
        this.applyButton = element('applySettings');
        this.settingsStatus = element('settingsStatus');
        this.settingsUi = { category: 'controls', rebinding: null };

        // Set once the engine has loaded.
        this.runtime = null;
        this.navigation = null;
        this.demo = null;
        this.renderer = null;
        this.gameArt = null;
        this.diagnosticPad = null;

        this.soloSession = new SoloSession(this);
        this.coopSession = new CoopSession(this);
        this.clock = new PresentationClock();
        this.input = new InputHub(this);
        this.menu = new MenuNavigator(this);
        this.keyRebinder = new KeyRebinder(this);
        this.keyboard = new KeyboardRouter(this);
        this.router = new ScreenRouter(this);
        this.launch = new LaunchController(this);
        this.homeBackdrop = new HomeBackdrop(this);
        this.layout = new Layout(this);
        this.loop = new GameLoop(this);
        this.presenter = new Presenter(this);
        this.settingsController = new SettingsController(this);
        this.bossUnlocks = new BossUnlockToast(this);
        this.bossUi = createBossUi();

        this.calibration = setupCalibration({
            settings: this.settings,
            findController: () => this.input.findController(),
            persist: () => this.settingsScreen.changed(),
            render: () => this.settingsScreen.render(),
        });
        this.settingsScreen = createSettingsScreen({
            settings: this.settings,
            profileStore: this.profileStore,
            settingsDraft: this.settingsDraft,
            settingsUi: this.settingsUi,
            applyButton: this.applyButton,
            settingsStatus: this.settingsStatus,
            storage: this.storage,
            controls: this.controls,
            unlockAudio: () => this.unlockAudio(),
            calibration: this.calibration,
        });
        this.helpScreen = createHelpScreen(this.settings);
        const activeProfile = () => this.profileStore.activeProfile;
        this.hangarScreen = createHangarScreen({
            getArt: () => this.gameArt,
            store: this.hangarStore,
            storage: this.storage,
            unlocks: this.unlocks,
            activeProfile,
            reduced: prefersReducedMotion,
        });
        this.modeScreen = createModeScreen({
            getArt: () => this.gameArt,
            store: this.hangarStore,
            activeProfile,
            reduced: prefersReducedMotion,
        });
        this.coopScreen = createCoopScreen({
            input: this.coopInput,
            getPads: () => this.input.connectedPads(),
            getRuntime: () => this.runtime,
            getNavigation: () => this.navigation,
            launch: (go) => this.launch.begin(go),
            profiles: () => this.profileStore.profiles,
        });
        this.recordsActions = createRecordsActions({
            getRuntime: () => this.runtime,
            profileStore: this.profileStore,
            draw: () => this.draw(),
        });
    }

    // Solo or co-op rules for whatever run is current (solo before the engine loads).
    get session() {
        return this.runtime?.coop ? this.coopSession : this.soloSession;
    }
    isSettingsOpen() {
        return this.navigation?.screen === 'settings';
    }
    // True when the player is in a menu rather than flying: the menu pad and keys are live.
    menuActive() {
        return (
            this.navigation?.screen !== 'play' ||
            this.runtime?.state === 'results' ||
            (this.runtime?.coop && this.runtime.state === 'game-over') ||
            this.navigation.pending
        );
    }
    // Any key or tap while the demo plays ends it (and reports that it did).
    consumeDemo() {
        if (!this.demo?.active) return false;
        this.demo.stop();
        this.controls.clear();
        this.menu.reset();
        this.draw();
        element('watchDemo').focus();
        return true;
    }
    unlockAudio() {
        this.audio.unlock();
    }
    draw() {
        this.presenter.draw();
    }

    async start() {
        this.settingsController.install();
        this.input.install();
        this.keyboard.install();
        this.launch.install();
        this.router.installHistory();
        this.loop.installFocusHandling();
        this.layout.observe(element('coopHud'));
        installActions(this);
        try {
            await this.#loadEngine();
        } catch (error) {
            this.#showLoadFailure(error);
        }
    }
    async #loadEngine() {
        const response = await fetch('./game.wasm');
        if (!response.ok) throw new Error(`Game download failed (${response.status})`);
        const art = (this.gameArt = await loadArt()),
            bytes = await response.arrayBuffer();
        this.renderer = new PixelRenderer(this.canvas, art);
        this.demo = await createDemo(
            bytes,
            new PixelRenderer(element('homeDemo'), art, { calm: true }),
        );
        element('watchDemo').disabled = false;
        this.runtime = await createRuntime(bytes, {
            storage: this.storage,
            tone: (value) => this.audio.setTone(value),
            scoreKey: 'asteroids.web.hd.scores-v3',
            profile: () => this.profileStore.activeProfile,
        });
        this.settingsController.sync();
        this.navigation = new Navigation({
            runtime: this.runtime,
            dirty: () => this.settingsDraft.changed(),
            apply: this.settingsController.apply,
            discard: () => this.settingsDraft.discard(),
            changed: this.router.changed,
            canResume: () => this.session.canResume(),
        });
        element('fire').disabled = false;
        element('play').disabled = false;
        this.settingsController.persist();
        window.asteroids = Object.freeze({
            snapshot: () => this.runtime.snapshot(),
            state: () => this.runtime.state,
        });
        this.navigation.request(routeFromHash(location.hash));
        this.layout.fit();
        this.draw();
        this.loop.start();
    }
    #showLoadFailure(error) {
        element('state').textContent = 'UNAVAILABLE';
        element('homeHint').textContent = 'Could not load the game. Choose Reload to retry.';
        const retry = element('play');
        retry.disabled = false;
        retry.textContent = 'Reload';
        retry.addEventListener('click', () => location.reload(), { once: true });
        element('hint').textContent =
            'Could not load the game. Serve web/dist over HTTP and reload.';
        console.error(error);
    }
}
