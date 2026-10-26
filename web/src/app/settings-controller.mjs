import { defaults, saveProfiles, sanitizeSettings } from '../state/settings.mjs';
import { element } from './dom.mjs';
import { prefersReducedMotion } from './motion.mjs';

// Keeps the saved settings, the live engine/audio/renderer and the header toggles in step.
export class SettingsController {
    constructor(app) {
        this.app = app;
    }
    persist = () => {
        const { app } = this;
        app.profileStore.profiles[app.profileStore.activeProfile] = sanitizeSettings(app.settings);
        app.settingsStatus.textContent = saveProfiles(app.storage, app.profileStore)
            ? 'Saved locally'
            : 'Storage unavailable; settings apply for this visit';
        this.sync();
    };
    // Pushes the current settings into everything that has its own copy.
    sync = () => {
        const { app } = this,
            { settings } = app;
        app.audio.apply();
        if (app.renderer) {
            app.renderer.shake = settings.shake;
            app.renderer.backgrounds.motion = settings.backgroundMotion;
            app.renderer.backgrounds.brightness = settings.backgroundBrightness;
        }
        app.runtime?.bossAssist({
            longWarnings: settings.bossLongWarnings,
            calm: settings.bossCalm,
        });
        const sound = element('sound'),
            music = element('music');
        sound.textContent = settings.soundEnabled ? 'Sound on' : 'Sound off';
        sound.setAttribute('aria-pressed', String(settings.soundEnabled));
        music.textContent = settings.musicEnabled ? 'Music on' : 'Music off';
        music.setAttribute('aria-pressed', String(settings.musicEnabled));
    };
    // Apply button: commits the draft, then reports whether storage took it.
    apply = () => {
        const { app } = this;
        const saved = app.settingsDraft.apply(app.storage);
        app.controls.clear();
        app.calibration.reset();
        this.sync();
        app.applyButton.disabled = true;
        app.settingsStatus.textContent = saved
            ? 'Applied and saved locally'
            : 'Applied for this visit; storage unavailable';
    };
    reset() {
        const { app } = this;
        Object.assign(app.settings, defaults());
        if (prefersReducedMotion()) app.settings.shake = 0;
        app.settingsUi.rebinding = null;
        app.controls.clear();
        app.calibration.reset();
        app.settingsScreen.render();
        app.settingsScreen.changed();
    }
    install() {
        const { app } = this;
        const open = (event) => app.router.navigate('settings', event.currentTarget);
        element('settingsOpen').addEventListener('click', open);
        element('pauseSettings').addEventListener('click', open);
        app.applyButton.addEventListener('click', this.apply);
        element('resetSettings').addEventListener('click', () => this.reset());
        element('music').addEventListener('click', () => {
            app.unlockAudio();
            app.settings.musicEnabled = !app.settings.musicEnabled;
            this.persist();
        });
        element('sound').addEventListener('click', () => {
            app.unlockAudio();
            app.settings.soundEnabled = !app.settings.soundEnabled;
            this.persist();
            element('sound').focus();
        });
    }
}
