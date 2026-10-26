// How many times each local profile has defeated each boss and mini-boss in real
// runs (practice never counts). Shown on Records by name.
import { KINDS } from './boss-scene.mjs';

export const BOSS_RECORDS_KEY = 'asteroids.web.boss-defeats-v1';
export const emptyBossRecords = () => JSON.stringify({ version: 1, profiles: [{}, {}] });

export class BossRecords {
  constructor(storage) {
    this.storage = storage;
    this.profiles = [{}, {}];
    try {
      const data = JSON.parse(storage?.getItem(BOSS_RECORDS_KEY) || 'null');
      if (data?.version === 1 && Array.isArray(data.profiles) && data.profiles.length === 2)
        data.profiles.forEach((profile, i) => {
          for (const [id, count] of Object.entries(profile || {}))
            if (KINDS.some(kind => kind.id === id) && Number.isSafeInteger(count) && count > 0) this.profiles[i][id] = count;
        });
    } catch { /* start empty */ }
  }
  record(profile, mask) {
    const bucket = this.profiles[profile === 1 ? 1 : 0];
    let changed = false;
    KINDS.forEach((kind, i) => { if (mask & (1 << i)) { bucket[kind.id] = (bucket[kind.id] || 0) + 1; changed = true; } });
    if (changed) try { this.storage?.setItem(BOSS_RECORDS_KEY, JSON.stringify({ version: 1, profiles: this.profiles })); } catch { /* kept for this visit */ }
    return changed;
  }
  reset() { this.profiles = [{}, {}]; }
  text(profile) {
    const bucket = this.profiles[profile === 1 ? 1 : 0];
    const list = KINDS.filter(kind => bucket[kind.id]).map(kind => `${kind.name} ×${bucket[kind.id]}`);
    return list.length ? `Defeated: ${list.join(' · ')}` : 'Defeated: no bosses yet';
  }
}
