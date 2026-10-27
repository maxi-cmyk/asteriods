// The tracks a player can choose to hear on the menus (Settings > Audio > Menu theme), plus
// the two behaviours that are not a track. Titles match soundtracks.json (a test checks), and
// the ids are what the music director asks the player for. Pure data, shared by the settings
// state, the settings screen and the director.
export const MENU_GROUPS = Object.freeze(['Menu themes', 'Planet themes', 'Boss themes']);
export const DEFAULT_MENU_THEME = 'cycle';
export const SILENT_MENUS = 'silent';

const menu = (id, title) => ({ id, title, group: MENU_GROUPS[0] });
const planet = (id, title) => ({ id, title, group: MENU_GROUPS[1] });
const boss = (id, title) => ({ id, title, group: MENU_GROUPS[2] });

export const MENU_THEMES = Object.freeze([
    menu('cycle', 'Play them all in turn'),
    menu('home', 'Ready or Not'),
    menu('gravity-well-escape', 'Gravity Well Escape'),
    menu('insert-another-coin', 'Insert Another Coin'),
    menu(SILENT_MENUS, 'Silent menus'),
    planet('frontier', 'Celestial frontier'),
    planet('violet', 'Violet orbit'),
    planet('ember', 'Ember orbit'),
    planet('ruins', 'Ruined moon'),
    planet('lunar', 'Lunar passage'),
    planet('rift', 'Outer rift'),
    boss('boss_sentinel', 'Sentinel'),
    boss('boss_ringwarden', 'Ringwarden'),
    boss('boss_cinderforge', 'Cinderforge'),
    boss('boss_bastion', 'Bastion'),
    boss('boss_tidecaller', 'Tidecaller'),
    boss('boss_warden', 'Horizon Warden'),
]);
export const isMenuTheme = (id) => MENU_THEMES.some((theme) => theme.id === id);
