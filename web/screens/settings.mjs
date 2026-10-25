import { element } from '../dom.mjs';
import {
    KEY_ACTIONS,
    PAD_ACTIONS,
    PAD_BUTTONS,
    sanitizeSettings,
    keyLabel,
} from '../settings.mjs';

export function createSettingsScreen({
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
}) {
    function changed() {
        const dirty = settingsDraft.changed();
        applyButton.disabled = !dirty;
        settingsStatus.textContent = dirty
            ? 'Unapplied changes'
            : '';
    }
    function render() {
        element('inputProfile').value = profileStore.activeProfile;
        element('audioEnabled').checked = settings.soundEnabled;
        element('musicEnabled').checked = settings.musicEnabled;
        if (!storage)
            settingsStatus.textContent =
                'Storage unavailable; settings apply for this visit';
        for (const name of [
            'volume',
            'deadzone',
            'aimDeadzone',
            'aimSensitivity',
            'mouseAimSensitivity',
            'movementSensitivity',
            'shake',
            'backgroundMotion',
            'backgroundBrightness',
        ]) {
            element(name).value = settings[name];
            element(`${name}Value`).textContent = name.endsWith('Sensitivity')
                ? `${settings[name].toFixed(2)}×`
                : `${Math.round(settings[name] * 100)}%`;
        }
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
                render();
                keys.querySelector(`[data-action="${action}"]`).focus();
                settingsStatus.textContent = `Press a new key for ${title}; Esc cancels`;
            });
            button.dataset.action = action;
            if (settingsUi.rebinding === action)
                button.textContent = 'Press a key…';
            label.append(button);
            keys.append(label);
        }
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
                controls.clear();
                render();
                changed();
                document
                    .querySelector(`#padBindings [data-action="${action}"]`)
                    .focus();
            });
            label.append(select);
            pads.append(label);
        }
    }
    function select(category) {
        settingsUi.category = category;
        for (const button of document.querySelectorAll('[data-category]'))
            button.setAttribute(
                'aria-pressed',
                String(button.dataset.category === category),
            );
        for (const panel of document.querySelectorAll(
            '[data-settings-panel]',
        )) {
            panel.hidden = panel.dataset.settingsPanel !== category;
            panel.inert = panel.hidden;
        }
        settingsUi.rebinding = null;
        render();
    }
    for (const button of document.querySelectorAll('[data-category]'))
        button.addEventListener('click', () => {
            select(button.dataset.category);
            button.focus();
        });
    element('musicEnabled').addEventListener('change', (event) => {
        settings.musicEnabled = event.target.checked;
        changed();
    });
    element('audioEnabled').addEventListener('change', (event) => {
        settings.soundEnabled = event.target.checked;
        changed();
    });
    for (const name of [
        'volume',
        'deadzone',
        'aimDeadzone',
        'aimSensitivity',
        'mouseAimSensitivity',
        'movementSensitivity',
        'shake',
        'backgroundMotion',
        'backgroundBrightness',
    ]) {
        element(name).addEventListener('input', (event) => {
            settings[name] = Number(event.target.value);
            element(`${name}Value`).textContent = name.endsWith('Sensitivity')
                ? `${settings[name].toFixed(2)}×`
                : `${Math.round(settings[name] * 100)}%`;
            if (name === 'volume') {
                settings.soundEnabled = true;
                unlockAudio();
            }
            changed();
        });
    }
    element('inputProfile').addEventListener('change', (event) => {
        profileStore.profiles[profileStore.activeProfile] =
            sanitizeSettings(settings);
        profileStore.activeProfile = Number(event.target.value);
        Object.assign(
            settings,
            sanitizeSettings(profileStore.profiles[profileStore.activeProfile]),
        );
        settingsUi.rebinding = null;
        controls.clear();
        calibration.reset();
        render();
        changed();
    });

    return { render, select, changed };
}
