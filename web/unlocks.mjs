// Hangar unlocks. The stock Vanguard is always free; each other hull is earned by
// defeating the matching mini-boss in a real run (practice never unlocks). Unlocks
// are per local profile, stored apart from the Hangar's equipped choice. Players
// who already had a Hangar, records or leaderboard keep every hull: a save made
// before mini-bosses existed must not lose anything.
import { KINDS } from './boss-scene.mjs';
import { DEFAULT_HULL, HANGAR_KEY, isHull } from './hangar.mjs';
import { RECORDS_KEY } from './records.mjs';

export const UNLOCKS_KEY = 'asteroids.web.unlocks-v1';
const LEGACY_KEYS = [HANGAR_KEY, RECORDS_KEY, 'asteroids.web.scores-v3'];
// hull id -> the mini-boss that unlocks it, and the wave it first appears on.
export const REQUIREMENTS = Object.freeze(Object.fromEntries(
  KINDS.map((kind, index) => [kind.hull, { boss: kind.name, kind: index, wave: 3 + 5 * (index - 6) }]).filter(([hull]) => hull),
));
export const requirementText = hull => {
  const need = REQUIREMENTS[hull];
  return need ? `Defeat ${need.boss} on wave ${need.wave}` : '';
};

export function createUnlocks(storage) {
  let state = { version: 1, all: false, profiles: [[], []] };
  let loaded = false;
  try {
    const raw = storage?.getItem(UNLOCKS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.version === 1 && Array.isArray(data.profiles) && data.profiles.length === 2) {
        state = { version: 1, all: data.all === true, profiles: data.profiles.map(list => [...new Set((Array.isArray(list) ? list : []).filter(id => isHull(id) && id !== DEFAULT_HULL))]) };
        loaded = true;
      }
    }
  } catch { /* fall through to a fresh state */ }
  if (!loaded) {
    // No unlock record yet: a returning player keeps everything.
    try { state.all = LEGACY_KEYS.some(key => storage?.getItem(key)); } catch { state.all = false; }
  }
  const save = () => {
    try { storage.setItem(UNLOCKS_KEY, JSON.stringify(state)); return true; } catch { return false; }
  };
  if (!loaded) save();
  return {
    isUnlocked: (profile, hull) => hull === DEFAULT_HULL || !REQUIREMENTS[hull] || state.all || state.profiles[profile === 1 ? 1 : 0].includes(hull),
    // Returns true the first time a hull is earned.
    grant(profile, hull) {
      const index = profile === 1 ? 1 : 0;
      if (!REQUIREMENTS[hull] || state.all || state.profiles[index].includes(hull)) return false;
      state.profiles[index].push(hull);
      save();
      return true;
    },
    // Hulls earned by a set of defeated mini-bosses (bitmask of boss kinds).
    hullsFor: mask => KINDS.filter((kind, i) => kind.hull && (mask & (1 << i))).map(kind => kind.hull),
    get all() { return state.all; },
  };
}
