import { drawWarp, LaunchSequence } from '../render/presentation.mjs';
import { element } from './dom.mjs';
import { reducedQuery } from './motion.mjs';

// The warp-jump overlay between choosing a flight and the run starting. It is presentation
// only: the run starts, and its clock runs, when the sequence ends.
export class LaunchController {
    constructor(app) {
        this.app = app;
        this.sequence = new LaunchSequence({ reduced: reducedQuery.matches });
        this.ctx = element('launchCanvas').getContext('2d');
        reducedQuery.addEventListener('change', (event) => {
            this.sequence.reduced = event.matches;
            app.homeBackdrop.invalidate();
        });
    }
    get active() {
        return this.sequence.active;
    }
    cancel() {
        this.sequence.cancel();
    }
    install() {
        element('skipLaunch').addEventListener('click', () => this.sequence.skip());
        window.addEventListener(
            'keydown',
            (event) => {
                if (!this.sequence.active) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                this.app.input.physicalKeys.add(event.code);
                if (event.repeat) return;
                if (event.code === 'Escape') this.sequence.cancel();
                else if (['Enter', 'Space'].includes(event.code)) this.sequence.skip();
                else if (event.code === 'Tab') element('skipLaunch').focus();
            },
            true,
        );
    }
    // `go` starts the run if the player did not cancel.
    begin(go) {
        const { app } = this;
        const overlay = element('launch');
        app.controls.clear();
        app.menu.reset();
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        document.querySelector('.app-shell').inert = true;
        element('skipLaunch').focus();
        app.unlockAudio();
        app.audio.setMusic(null);
        app.audio.startWarp();
        this.sequence.begin(app.clock.time, (started) => {
            overlay.hidden = true;
            overlay.setAttribute('aria-hidden', 'true');
            document.querySelector('.app-shell').inert = false;
            app.controls.clear();
            app.menu.reset();
            app.input.gameplayReady = false;
            app.input.pointerPosition = null;
            app.audio.stopWarp();
            if (started) go();
            else {
                app.coopInput.live = false;
                if (app.navigation.screen === 'lobby') element('coopStart').focus();
                else element('play').focus();
            }
        });
    }
    // One frame of the overlay: the warp, and the controller's skip/cancel buttons.
    frame(now) {
        const { app } = this,
            { sequence } = this;
        if (app.coopInput.live && !app.coopInput.valid(app.input.connectedPads())) {
            sequence.cancel();
            app.coopScreen.reset();
        }
        if (app.loop.suspended) return;
        if (sequence.reduced) {
            this.ctx.fillStyle = '#03060f';
            this.ctx.fillRect(0, 0, 480, 270);
        } else drawWarp(this.ctx, sequence.elapsed(app.clock.time));
        const padInput = app.menu.input.sample(
            app.input.findController(),
            now,
            app.settings.buttons.pause,
        );
        if (padInput.back) sequence.cancel();
        else if (padInput.confirm || padInput.pause) sequence.skip();
        sequence.tick(app.clock.time);
    }
}
