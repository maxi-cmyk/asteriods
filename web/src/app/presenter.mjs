import { renderDiagnostics } from '../screens/diagnostics.mjs';
import { renderPractice } from '../screens/practice.mjs';
import { renderPlayChrome } from '../screens/play-chrome.mjs';
import { renderPlayHud } from '../screens/play.mjs';
import { renderResultsScreen } from '../screens/results.mjs';
import { renderRecordsScreen } from '../screens/records.mjs';
import { renderHomeScreen } from '../screens/home.mjs';
import { accuracyText } from '../state/records.mjs';
import { element, setText } from './dom.mjs';

const HUD_IDS = [
    'lives',
    'wave',
    'score',
    'multiplier',
    'chainFill',
    'laserStatus',
    'laserFill',
    'shieldStatus',
    'precisionStatus',
];

// Everything that turns the current scene and run state into pixels and DOM, once per frame.
export class Presenter {
    constructor(app) {
        this.app = app;
        this.hud = Object.fromEntries(HUD_IDS.map((id) => [id, element(id)]));
        this.lastState = '';
    }
    draw() {
        const { app } = this,
            { runtime, navigation, session } = app;
        const update = setText;
        const scene = runtime.scene();
        if (['play', 'pause'].includes(navigation.screen) && runtime.state !== 'results') {
            app.renderer.hulls = session.hulls();
            app.renderer.render(scene, session.players());
        }
        app.bossUnlocks.track(scene);
        app.bossUi.render(
            scene,
            navigation.screen === 'play' &&
                ['playing', 'countdown', 'death'].includes(runtime.state),
        );
        renderHomeScreen({
            demoEngine: app.demo,
            navigation,
            controllerLabel: element('controller'),
            menuDevice: app.input.device,
            profileStore: app.profileStore,
        });
        renderDiagnostics({
            inputDiagnostics: app.inputDiagnostics,
            diagnosticPad: app.diagnosticPad,
            runtime,
            controls: app.controls,
            update,
        });
        this.#audio(scene);
        renderPractice({
            scene,
            navigation,
            runtime,
            update,
            practiceButton: element('practice'),
            fitCanvas: app.layout.fit,
        });
        const result = runtime.result;
        const showResults = runtime.state === 'results';
        this.#liveStats(runtime, update);
        renderRecordsScreen({
            runtime,
            resetRecordsArmed: app.recordsActions.armed,
            resetProfile: app.recordsActions.profile,
            disarmRecordsReset: app.recordsActions.disarmRecordsReset,
            bossArt: app.renderer?.bossArt,
            update,
        });
        renderResultsScreen({
            results: element('runSummary'),
            showResults,
            canvas: app.canvas,
            lastState: this.lastState,
            result,
            scene,
            update,
        });
        renderPlayHud({ hud: this.hud, scene, update });
        const nextState = renderPlayChrome({
            runtime,
            navigation,
            showResults,
            canvas: app.canvas,
            fireButton: element('fire'),
            soundButton: element('sound'),
            pauseButton: element('pause'),
            hint: element('hint'),
            scene,
            controls: app.controls,
            menuInput: app.menu.input,
            stateLabel: element('state'),
            lastState: this.lastState,
            update,
            isSettingsOpen: () => app.isSettingsOpen(),
        });
        app.coopScreen.render();
        if (nextState !== this.lastState) {
            app.input.gameplayReady = false;
            if (runtime.coop && nextState === 'game-over') element('fire').focus();
        }
        this.lastState = nextState;
    }
    #audio(scene) {
        const { app } = this,
            { audio, navigation, runtime } = app;
        audio.suspend(app.loop.suspended || navigation.screen !== 'play');
        audio.observe(scene);
        audio.setMode(
            navigation.screen === 'home' && !app.demo?.active
                ? 'home'
                : navigation.screen === 'play' && ['playing', 'countdown'].includes(runtime.state)
                  ? 'flight'
                  : 'off',
            app.loop.suspended,
        );
    }
    #liveStats(runtime, update) {
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
    }
}
