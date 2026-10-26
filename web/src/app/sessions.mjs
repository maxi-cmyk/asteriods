import { element } from './dom.mjs';

// What differs between a solo run and a local co-op run. The rest of the app asks
// `app.session` and never branches on `runtime.coop` itself.

export class SoloSession {
    constructor(app) {
        this.app = app;
    }
    keyboardControls() {
        return this.app.controls;
    }
    // The controller the menus and flight read, with the device labels kept in step.
    findPad() {
        const { app } = this,
            { input } = app;
        let pads = [];
        try {
            pads = [...(navigator.getGamepads?.() || [])];
        } catch {}
        const current = pads.find(
            (pad) =>
                pad?.index === input.activePadIndex && pad.connected && pad.mapping === 'standard',
        );
        const pad = current || pads.find((pad) => pad?.connected && pad.mapping === 'standard');
        // The controller we were using vanished mid-run: stop the world.
        if (input.activePadIndex !== null && !current && app.runtime) app.runtime.pause();
        input.activePadIndex = pad?.index ?? null;
        const label = pad
            ? `${pad.id} · connected`
            : pads.some(Boolean)
              ? 'Controller mapping unavailable · keyboard ready'
              : '';
        const compact = pad ? 'Controller connected' : 'Keyboard + mouse';
        element('controller').textContent = pad ? compact : label;
        element('runDevice').textContent = pad ? compact : 'Keyboard + mouse';
        if (app.navigation?.screen === 'help')
            app.helpScreen.render(!!pad && input.device === 'controller');
        return pad;
    }
    menuPad() {
        return this.findPad();
    }
    menuPauseButton() {
        return this.app.settings.buttons.pause;
    }
    claimMenu() {}
    observe(pad) {
        this.app.controls.observeController(pad);
    }
    // Pause menu housekeeping before each frame.
    pauseFrame() {}
    // One 20 ms tick of gameplay input. Returns false if the world must stop stepping.
    tick(now, pad) {
        const { app } = this,
            { input } = app;
        if (!input.gameplayReady && !input.held(pad)) {
            app.controls.clear();
            input.gameplayReady = true;
        }
        app.runtime.step(input.gameplayReady ? app.controls.sample(this.findPad(), now) : {});
        app.navigation.sync();
        return true;
    }
    aimScene() {
        return this.app.runtime.scene();
    }
    hulls() {
        const { app } = this;
        return [app.hangarStore.profiles[app.profileStore.activeProfile]];
    }
    players() {
        return null;
    }
    unlockProfiles() {
        return [this.app.profileStore.activeProfile];
    }
    canResume() {
        return true;
    }
    fireClick() {
        return false;
    }
    padDisconnected() {
        const { app } = this;
        this.findPad();
        app.controls.clear();
        app.menu.reset();
        app.input.gameplayReady = false;
        element('pauseSettingsHint').textContent =
            'Controller disconnected. Reconnect and release controls, or continue with keyboard.';
    }
    enterHome() {
        this.app.coopInput.live = false;
        element('resume').disabled = false;
    }
    enterSettings() {}
    leaveSettings() {}
}

export class CoopSession {
    constructor(app) {
        this.app = app;
        this.resumeReady = false; // everyone let go of their controls while paused
    }
    keyboardControls() {
        return this.app.coopInput.keyboard();
    }
    findPad() {
        const { app } = this;
        const owner = app.isSettingsOpen()
            ? Math.max(0, app.coopInput.profileIds.indexOf(app.profileStore.activeProfile))
            : app.coopInput.menuOwner;
        return app.coopInput.pad(owner, app.input.connectedPads());
    }
    menuPad() {
        const { app } = this;
        return app.coopInput.pad(app.coopInput.menuOwner, app.input.connectedPads());
    }
    menuPauseButton() {
        const { coopInput } = this.app;
        return coopInput.controls[coopInput.menuOwner].settings.buttons.pause;
    }
    // Whoever pressed the pause key owns the pause menu.
    claimMenu() {
        const { coopInput } = this.app;
        if (coopInput.keyboardSlot() >= 0) coopInput.menuOwner = coopInput.keyboardSlot();
    }
    observe() {
        this.app.coopInput.observe(this.app.input.connectedPads());
    }
    pauseFrame(now) {
        const { app } = this,
            { coopInput, input } = app;
        if (app.navigation.screen !== 'pause') return;
        const sampled = coopInput.sample(input.connectedPads(), now);
        app.runtime.releaseCoopLasers(sampled.players);
        if (
            coopInput.neutral(
                input.connectedPads(),
                input.physicalKeys.size,
                input.pointerButtons.size,
            )
        )
            this.resumeReady = true;
    }
    tick(now) {
        const { app } = this,
            { coopInput, input } = app;
        const pads = input.connectedPads();
        if (!coopInput.valid(pads)) {
            app.navigation.pause();
            return false;
        }
        if (
            !input.gameplayReady &&
            coopInput.neutral(pads, input.physicalKeys.size, input.pointerButtons.size)
        ) {
            coopInput.clear();
            input.gameplayReady = true;
        }
        app.runtime.step(input.gameplayReady ? coopInput.sample(pads, now) : { players: [{}, {}] });
        app.navigation.sync();
        return true;
    }
    aimScene() {
        const { app } = this;
        return app.runtime.coopPlayers()[Math.max(0, app.coopInput.keyboardSlot())].scene;
    }
    hulls() {
        const { app } = this;
        return [0, 1].map(
            (slot) => app.hangarStore.profiles[app.coopInput.profileIds?.[slot] ?? slot],
        );
    }
    players() {
        return this.app.runtime.coopPlayers();
    }
    unlockProfiles() {
        return this.app.coopInput.profileIds ?? [0, 1];
    }
    canResume() {
        const { app } = this,
            { coopInput, input } = app;
        const pads = input.connectedPads();
        const confirmKeys = new Set(['Enter', 'Space']);
        const ready =
            this.resumeReady &&
            coopInput.valid(pads) &&
            [...input.physicalKeys].every((key) => confirmKeys.has(key)) &&
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
    }
    // The Fire button doubles as Continue on the co-op end screens.
    fireClick() {
        const { app } = this,
            { runtime } = app;
        if (runtime.state === 'game-over') {
            runtime.abandon();
            app.coopScreen.reset();
            app.navigation.set('lobby');
            return true;
        }
        if (runtime.state === 'initials') {
            runtime.step({ firePressed: true });
            app.draw();
            return true;
        }
        return false;
    }
    padDisconnected(event) {
        const { app } = this;
        if (app.coopInput.lost(event.gamepad.index)) {
            app.navigation.pause();
            app.coopInput.clear();
            app.menu.reset();
            app.input.gameplayReady = false;
            app.draw();
        }
    }
    enterHome() {}
    enterSettings() {
        element('settingsProfileNote').textContent =
            'Profile 1 / 2 selects the matching co-op pilot’s controls and calibration. Audio and display are shared during this run.';
    }
    leaveSettings() {
        const { app } = this;
        app.coopInput.profiles = app.profileStore.profiles;
        app.coopInput.refresh();
    }
}
