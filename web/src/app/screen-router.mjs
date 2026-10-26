import { routeFromHash } from '../state/navigation.mjs';
import { element } from './dom.mjs';

const TITLES = {
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

// Reacts to the Navigation state machine: shows the right view, resets what the last screen
// left behind, runs the per-screen enter/leave work, and keeps focus and the URL hash honest.
export class ScreenRouter {
    constructor(app) {
        this.app = app;
        this.focusOrigins = new Map(); // screen -> the control that opened the next one
        this.fromHistory = false; // the change came from the browser's back/forward
    }
    // Moves to another screen, remembering where focus was so Back can restore it.
    navigate(target, invoker = document.activeElement) {
        const { app } = this;
        if (!app.navigation) return;
        if (app.consumeDemo()) return;
        this.focusOrigins.set(app.navigation.screen, invoker);
        app.navigation.request(target);
    }
    installHistory() {
        const { app } = this;
        window.addEventListener('hashchange', () => {
            if (app.launch.active) app.launch.cancel();
            if (!app.navigation) return;
            this.fromHistory = true;
            app.navigation.request(
                location.hash === '#play' && app.navigation.live
                    ? 'pause'
                    : routeFromHash(location.hash),
            );
            this.fromHistory = false;
        });
        window.addEventListener('beforeunload', (event) => {
            if (app.navigation?.live) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
    }
    // Navigation's `changed` callback.
    changed = (screen, previous) => {
        const { app } = this,
            { navigation } = app;
        this.#resetInput(screen, previous);
        if (previous === 'settings' && screen !== 'settings') this.#leaveSettings();
        if (screen === 'settings' && previous !== 'settings') this.#enterSettings();
        this.#showView(screen);
        if (app.runtime) {
            app.draw();
            app.layout.fit();
        }
        if (screen === 'hangar') app.hangarScreen.open();
        if (screen === 'mode') app.modeScreen.render();
        if (navigation.pending) this.#showDecision();
        else this.#restoreFocus(screen);
        this.#syncHash(screen);
    };
    #resetInput(screen, previous) {
        const { app } = this;
        app.coopScreen.resetMenu();
        app.coopInput.clear();
        app.coopSession.resumeReady = false;
        if (screen === 'home' && !app.runtime?.coop) app.session.enterHome();
        if (screen !== 'home') app.demo?.stop();
        if (previous === 'records' && screen !== 'records') app.recordsActions.cancelBrowserReset();
        app.menu.editing = false;
        app.controls.clear();
        app.input.gameplayReady = false;
        app.input.pointerPosition = null;
        app.loop.resetTiming();
        app.menu.reset();
    }
    #leaveSettings() {
        const { app } = this;
        app.settingsDraft.discard();
        app.session.leaveSettings();
        app.settingsController.sync();
        app.settingsUi.rebinding = null;
        app.calibration.reset();
    }
    #enterSettings() {
        const { app } = this;
        app.settingsScreen.select('controls');
        app.settingsDraft.begin();
        app.applyButton.disabled = true;
        app.settingsStatus.textContent = '';
        app.session.enterSettings();
        app.calibration.reset();
        app.settingsScreen.render();
    }
    #showView(screen) {
        const { navigation } = this.app;
        const view = screen === 'pause' ? 'play' : screen;
        for (const el of document.querySelectorAll('[data-view]')) {
            el.hidden = el.dataset.view !== view;
            el.inert = el.hidden;
        }
        document.body.dataset.screen = screen;
        element('screenTitle').textContent = TITLES[screen];
        element('screenBack').hidden = ['home', 'play', 'pause'].includes(screen);
        document.title = screen === 'home' ? 'Asteroids' : `${TITLES[screen]} · Asteroids`;
        element('helpPractice').hidden = navigation.origin === 'pause';
        element('helpPaused').hidden = navigation.origin !== 'pause';
    }
    // The "Quit this run?" / "Unapplied settings" dialog.
    #showDecision() {
        const { app } = this,
            { navigation, runtime } = app;
        const decision = element('navigationDecision');
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
    }
    #restoreFocus(screen) {
        const decision = element('navigationDecision');
        if (decision.open) decision.close();
        const restore = this.focusOrigins.get(screen);
        const view = screen === 'pause' ? 'play' : screen;
        if (restore?.isConnected && !restore.closest('[hidden]')) restore.focus();
        else if (screen === 'home') element('play').focus();
        else if (screen === 'pause') element('resume').focus();
        else if (screen === 'play') this.app.canvas.focus();
        else document.querySelector(`[data-view="${view}"] h1`)?.focus();
    }
    #syncHash(screen) {
        const hash = `#${['play', 'pause'].includes(screen) ? 'play' : screen}`;
        if (location.hash === hash) return;
        if (this.fromHistory || this.app.navigation.pending) history.replaceState(null, '', hash);
        else history.pushState(null, '', hash);
    }
}
