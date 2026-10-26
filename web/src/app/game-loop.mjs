import { element } from './dom.mjs';

const TICK_MS = 20;

// The one requestAnimationFrame loop: it feeds the engine exact 20 ms ticks (a long stall
// freezes physics rather than skipping it), runs menu input between runs and asks the
// presenter to draw.
export class GameLoop {
    constructor(app) {
        this.app = app;
        this.suspended = false; // the window lost focus or went hidden
        this.previousTime = null;
        this.accumulator = 0;
    }
    // A screen change must not carry a stale tick backlog into the next screen.
    resetTiming() {
        this.accumulator = 0;
        this.previousTime = null;
    }
    start() {
        requestAnimationFrame(this.frame);
    }
    installFocusHandling() {
        const { app } = this;
        const resume = () => {
            this.suspended = false;
            this.previousTime = null;
            app.clock.resync();
            app.audio.suspend(app.isSettingsOpen());
        };
        window.addEventListener('blur', () => this.suspend());
        window.addEventListener('focus', resume);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.suspend();
            else resume();
        });
    }
    suspend() {
        const { app } = this;
        app.coopScreen.resetMenu();
        app.coopInput.clear();
        app.clock.resync();
        app.controls.clear();
        app.input.release();
        app.navigation?.pause();
        this.suspended = true;
        this.accumulator = 0;
        app.audio.suspend(true);
        if (app.runtime) app.draw();
    }
    frame = (now) => {
        requestAnimationFrame(this.frame);
        const { app } = this,
            { input, navigation, runtime, session } = app;
        app.clock.tick(now, this.suspended);
        if (app.launch.active) {
            app.launch.frame(now);
            this.previousTime = now;
            return;
        }
        app.homeBackdrop.frame();
        if (navigation?.screen === 'hangar') app.hangarScreen.draw(app.clock.time);
        else if (navigation?.screen === 'mode') app.modeScreen.draw(app.clock.time);
        session.pauseFrame(now);
        const pad = session.menuPad();
        app.diagnosticPad = pad;
        if (
            input.gameplayReady &&
            navigation.screen === 'play' &&
            runtime.state !== 'results' &&
            !this.suspended
        )
            session.observe(pad);
        const padId = pad?.index ?? null;
        if (padId !== app.menu.lastPad) {
            app.menu.reset();
            app.menu.lastPad = padId;
            input.gameplayReady = false;
            if (pad)
                element('pauseSettingsHint').textContent =
                    'Release controls before selecting Resume · Cross: select · Circle: back';
        }
        if (!this.suspended && app.menuActive()) {
            if (navigation.screen === 'lobby' && !navigation.pending)
                app.coopScreen.handlePads(input.connectedPads(), now);
            else app.menu.handlePad(pad, now);
        }
        // Cross confirms the focused menu action; gameplay bindings stay separate.
        if (app.isSettingsOpen() && app.settingsUi.category === 'calibration')
            app.calibration.update(now);
        if (this.suspended) {
            this.previousTime = now;
            return;
        }
        this.advance(now, pad);
        app.draw();
    };
    // Advances the simulation in exact 20 ms ticks.
    advance(now, pad) {
        const { app } = this,
            { navigation, runtime, session } = app;
        const delta = this.previousTime === null ? 0 : now - this.previousTime;
        this.previousTime = now;
        this.accumulator += delta > 100 ? 0 : delta;
        while (this.accumulator >= TICK_MS) {
            if (
                (!navigation.shouldStep && !app.demo?.active) ||
                element('navigationDecision').open
            ) {
                this.accumulator = 0;
                break;
            }
            app.input.applyMouseAim();
            if (navigation.screen === 'home') app.demo?.step();
            else if (runtime.state === 'results') runtime.step();
            else if (!session.tick(now, pad)) {
                this.accumulator = 0;
                break;
            }
            this.accumulator -= TICK_MS;
        }
    }
}
