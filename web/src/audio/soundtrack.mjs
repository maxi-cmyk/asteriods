// Which soundtrack plays when. Pure: it turns the screen and the scene into a request
// ({ key, tracks }); the MusicPlayer does the playing and the crossfades.
//
//   the menus     the player's menu theme (Settings > Audio): by default a playlist that cycles
//                 the in-house theme and the two supplied tracks; or any one track, or silence.
//                 It covers Home, Mode, Hangar, Lobby and the utility screens opened from them
//   a flight      the track of the region the wave is in (frontier, violet, ember, ruins, lunar, rift)
//   a boss fight  that region's boss theme, kept until the next wave begins
//
// A request with one track loops until its key changes (the player passed the stage, a boss
// arrived, the run ended). A request with several tracks plays them in turn, then starts again.
import { S, BOSS, boss } from '../runtime/scene-layout.mjs';
import { REGIONS, regionIndexForWave } from '../render/regions.mjs';
import { groupOf, isMini } from '../boss/sound/groups.mjs';
import { UTILITIES } from '../state/navigation.mjs';
import { DEFAULT_MENU_THEME, SILENT_MENUS, isMenuTheme } from './menu-themes.mjs';

export const HOME_PLAYLIST = Object.freeze(['home', 'gravity-well-escape', 'insert-another-coin']);
export const HOME = Object.freeze({ key: 'home', tracks: HOME_PLAYLIST });

const single = (id) => Object.freeze({ key: id, tracks: Object.freeze([id]) });
const PLANETS = Object.freeze(REGIONS.map((region) => single(region.id)));
export const planetRequest = (wave) => PLANETS[regionIndexForWave(wave)];
export const bossRequest = (kind) => single(`boss_${groupOf(kind)}`);

// What the menus play for a chosen theme: the playlist, one track on a loop, or nothing.
export function menuRequest(theme = DEFAULT_MENU_THEME) {
    if (theme === SILENT_MENUS) return null;
    return theme === DEFAULT_MENU_THEME || !isMenuTheme(theme) ? HOME : single(theme);
}
// Screens that are part of the menus; the utility screens count only when opened from a menu.
const MENU_SCREENS = ['home', 'mode', 'lobby'];

const FLYING = ['playing', 'countdown', 'death'];

export class MusicDirector {
    constructor() {
        this.bossWave = 0;
        this.bossKind = 0;
        this.current = null;
    }
    reset() {
        this.bossWave = 0;
        this.current = null;
    }
    // The region track, or the boss theme from the boss's arrival until the wave changes.
    flight(scene) {
        const wave = Math.max(1, Math.floor(scene[S.WAVE]) || 1);
        const kind = scene[boss(BOSS.KIND)];
        // Mini-bosses keep the region's own track: only the six region bosses get a theme.
        if (scene[S.BOSS_ACTIVE] && !isMini(kind)) {
            this.bossWave = wave;
            this.bossKind = kind;
        } else if (this.bossWave !== wave) this.bossWave = 0;
        return this.bossWave ? bossRequest(this.bossKind) : planetRequest(wave);
    }
    // `demoScene` is the Home demo's scene while it plays, else null. The pause menu (which
    // the game also enters when the window loses focus) keeps whatever was playing, and so do
    // the utility screens opened from it (Settings mid-run, say). `origin` is where a utility
    // screen was opened from: 'home', 'mode' or 'pause'.
    request({
        screen,
        runtimeState,
        scene,
        demoScene = null,
        menuTheme = DEFAULT_MENU_THEME,
        origin = 'home',
    }) {
        if (screen === 'pause') return this.current;
        if (screen === 'home' && demoScene) return (this.current = this.flight(demoScene));
        if (MENU_SCREENS.includes(screen) || (UTILITIES.includes(screen) && origin !== 'pause')) {
            this.reset();
            return (this.current = menuRequest(menuTheme));
        }
        if (screen === 'play' && FLYING.includes(runtimeState))
            return (this.current = this.flight(scene));
        this.reset();
        return null;
    }
}
