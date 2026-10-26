import { sanitizeSettings } from '../state/settings.mjs';

// The Settings key-binding capture: the screen starts a rebind (settingsUi.rebinding holds
// the action); this class takes the next key press, resolves conflicts and commits it.
export class KeyRebinder {
    constructor(app) {
        this.app = app;
    }
    get action() {
        return this.app.settingsUi.rebinding;
    }
    get active() {
        return !!this.action;
    }
    #refocus(action) {
        document.querySelector(`#keyBindings [data-action="${action}"]`).focus();
    }
    // Abandons the capture. `announce` is for the keyboard, which tells the player.
    cancel({ announce = false } = {}) {
        const { app } = this,
            action = this.action;
        app.settingsUi.rebinding = null;
        app.settingsScreen.render();
        this.#refocus(action);
        if (announce) app.settingsStatus.textContent = 'Key change canceled';
    }
    handle(event) {
        const { app } = this,
            { settings, settingsUi } = app;
        event.preventDefault();
        event.stopPropagation();
        if (event.code === 'Escape') {
            this.cancel({ announce: true });
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
            app.settingsStatus.textContent =
                'Choose a letter, number, modifier, Space or punctuation key.';
            return;
        }
        const action = settingsUi.rebinding;
        settings.keys = candidate.keys;
        settingsUi.rebinding = null;
        app.settingsScreen.render();
        app.settingsScreen.changed();
        this.#refocus(action);
    }
}
