import { element } from '../app/dom.mjs';
import { MENU_GROUPS, MENU_THEMES } from '../audio/menu-themes.mjs';
import {
    KEY_ACTIONS,
    PAD_ACTIONS,
    PAD_BUTTONS,
    sanitizeSettings,
    keyLabel,
} from '../state/settings.mjs';

// The numeric settings with a range input and a readout, in screen order.
const SLIDERS = [
    'volume',
    'deadzone',
    'aimDeadzone',
    'aimSensitivity',
    'mouseAimSensitivity',
    'movementSensitivity',
    'shake',
    'backgroundMotion',
    'backgroundBrightness',
];
const readout = (name, value) =>
    name.endsWith('Sensitivity') ? `${value.toFixed(2)}×` : `${Math.round(value * 100)}%`;

// The Settings screen: category tabs, sliders, toggles and the key and button bindings. It
// edits the live `settings` object as a draft (`settingsDraft` decides what counts as changed).
class SettingsScreen {
    constructor(options) {
        Object.assign(this, options);
        this.#wire();
    }
    // Marks the draft changed (or clean) and updates the Apply button.
    changed() {
        const dirty = this.settingsDraft.changed();
        this.applyButton.disabled = !dirty;
        this.settingsStatus.textContent = dirty ? 'Unapplied changes' : '';
    }
    render() {
        const { settings, profileStore } = this;
        element('inputProfile').value = profileStore.activeProfile;
        element('audioEnabled').checked = settings.soundEnabled;
        element('musicEnabled').checked = settings.musicEnabled;
        element('menuTheme').value = settings.menuTheme;
        element('bossLongWarnings').checked = settings.bossLongWarnings;
        element('bossCalm').checked = settings.bossCalm;
        if (!this.storage)
            this.settingsStatus.textContent = 'Storage unavailable; settings apply for this visit';
        for (const name of SLIDERS) {
            element(name).value = settings[name];
            element(`${name}Value`).textContent = readout(name, settings[name]);
        }
        this.#renderKeyBindings();
        this.#renderPadBindings();
    }
    select(category) {
        const { settingsUi } = this;
        settingsUi.category = category;
        for (const button of document.querySelectorAll('[data-category]'))
            button.setAttribute('aria-pressed', String(button.dataset.category === category));
        for (const panel of document.querySelectorAll('[data-settings-panel]')) {
            panel.hidden = panel.dataset.settingsPanel !== category;
            panel.inert = panel.hidden;
        }
        settingsUi.rebinding = null;
        this.render();
    }
    // One button per key action; clicking starts a rebind that KeyRebinder completes.
    #renderKeyBindings() {
        const { settings, settingsUi } = this;
        const keys = element('keyBindings');
        keys.replaceChildren();
        for (const [action, [title]] of Object.entries(KEY_ACTIONS)) {
            const label = document.createElement('label');
            label.append(title);
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = keyLabel(settings.keys[action]);
            button.setAttribute(
                'aria-label',
                `${title}: ${keyLabel(settings.keys[action])}. Change key`,
            );
            button.addEventListener('click', () => {
                settingsUi.rebinding = action;
                this.render();
                keys.querySelector(`[data-action="${action}"]`).focus();
                this.settingsStatus.textContent = `Press a new key for ${title}; Esc cancels`;
            });
            button.dataset.action = action;
            if (settingsUi.rebinding === action) button.textContent = 'Press a key…';
            label.append(button);
            keys.append(label);
        }
    }
    // One select per controller action; choosing a taken button swaps the two.
    #renderPadBindings() {
        const { settings } = this;
        const pads = element('padBindings');
        pads.replaceChildren();
        for (const [action, [title]] of Object.entries(PAD_ACTIONS)) {
            const label = document.createElement('label');
            label.append(title);
            const select = document.createElement('select');
            select.setAttribute('aria-label', `${title} controller button`);
            select.dataset.action = action;
            for (const [index, name] of PAD_BUTTONS.entries()) {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = name;
                select.append(option);
            }
            select.value = settings.buttons[action];
            select.addEventListener('change', () => {
                const previous = settings.buttons[action],
                    next = Number(select.value);
                const conflict = Object.keys(settings.buttons).find(
                    (key) => key !== action && settings.buttons[key] === next,
                );
                if (conflict) settings.buttons[conflict] = previous;
                settings.buttons[action] = next;
                this.controls.clear();
                this.render();
                this.changed();
                document.querySelector(`#padBindings [data-action="${action}"]`).focus();
            });
            label.append(select);
            pads.append(label);
        }
    }
    #wire() {
        const { settings, profileStore, settingsUi } = this;
        for (const button of document.querySelectorAll('[data-category]'))
            button.addEventListener('click', () => {
                this.select(button.dataset.category);
                button.focus();
            });
        element('audioEnabled').addEventListener('change', (event) => {
            settings.soundEnabled = event.target.checked;
            this.changed();
        });
        element('musicEnabled').addEventListener('change', (event) => {
            settings.musicEnabled = event.target.checked;
            this.changed();
        });
        // One option per theme, grouped. Choosing one previews it at once (the music follows the
        // live settings) until Apply keeps it or closing Settings puts the old one back.
        const themes = element('menuTheme');
        for (const name of MENU_GROUPS) {
            const group = document.createElement('optgroup');
            group.label = name;
            for (const theme of MENU_THEMES.filter((theme) => theme.group === name)) {
                const option = document.createElement('option');
                option.value = theme.id;
                option.textContent = theme.title;
                group.append(option);
            }
            themes.append(group);
        }
        themes.addEventListener('change', (event) => {
            settings.menuTheme = event.target.value;
            this.unlockAudio();
            this.changed();
        });
        for (const name of ['bossLongWarnings', 'bossCalm'])
            element(name).addEventListener('change', (event) => {
                settings[name] = event.target.checked;
                this.changed();
            });
        for (const name of SLIDERS)
            element(name).addEventListener('input', (event) => {
                settings[name] = Number(event.target.value);
                element(`${name}Value`).textContent = readout(name, settings[name]);
                if (name === 'volume') {
                    settings.soundEnabled = true;
                    this.unlockAudio();
                }
                this.changed();
            });
        element('inputProfile').addEventListener('change', (event) => {
            profileStore.profiles[profileStore.activeProfile] = sanitizeSettings(settings);
            profileStore.activeProfile = Number(event.target.value);
            Object.assign(
                settings,
                sanitizeSettings(profileStore.profiles[profileStore.activeProfile]),
            );
            settingsUi.rebinding = null;
            this.controls.clear();
            this.calibration.reset();
            this.render();
            this.changed();
        });
    }
}

// `options`: settings, profileStore, settingsDraft, settingsUi, applyButton, settingsStatus,
// storage, controls, unlockAudio, calibration.
export const createSettingsScreen = (options) => new SettingsScreen(options);
