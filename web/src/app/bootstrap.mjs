import { CoopInput } from '../input/coop-input.mjs';
import { Controls } from '../input/controls.mjs';
import { GameAudio } from '../audio/audio.mjs';
import { createUnlocks } from '../boss/unlocks.mjs';
import { loadHangar } from '../state/hangar.mjs';
import { loadProfiles, sanitizeSettings, SettingsDraft } from '../state/settings.mjs';
import { prefersReducedMotion } from './motion.mjs';

// The long-lived services: browser storage and everything built from it. Nothing here
// touches the DOM or the engine.
export function createServices() {
    let storage;
    try {
        storage = localStorage;
    } catch {}
    const profileStore = loadProfiles(storage);
    const settings = sanitizeSettings(profileStore.profiles[profileStore.activeProfile]);
    // A first visit from someone who asked their system for less motion starts with no shake.
    try {
        if (!storage?.getItem('asteroids.web.settings-v1') && prefersReducedMotion()) {
            settings.shake = 0;
            for (const profile of profileStore.profiles) profile.shake = 0;
        }
    } catch {}
    return {
        storage,
        profileStore,
        settings,
        unlocks: createUnlocks(storage),
        hangarStore: loadHangar(storage),
        controls: new Controls(settings),
        coopInput: new CoopInput(profileStore.profiles),
        audio: new GameAudio(settings),
        settingsDraft: new SettingsDraft(profileStore, settings),
    };
}
