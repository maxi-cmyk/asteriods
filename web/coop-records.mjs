export const COOP_SCORE_KEYS = ['asteroids.web.coop.scores-v1.ff-off', 'asteroids.web.coop.scores-v1.ff-on'];
export class CoopLeaderboard {
    constructor(storage, friendlyFire) {
        this.storage = storage;
        this.key = COOP_SCORE_KEYS[+friendlyFire];
        this.entries = [];
        this.status = 'Team scores saved in this browser.';
        this.saved = new Set();
        try {
            const raw = storage?.getItem(this.key);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 5 ||
                data.entries.some(e => !/^[A-Z]{3}$/.test(e.initials) || !Number.isInteger(e.score) || e.score < 1 || e.score > 1999998) ||
                data.entries.some((e, i) => i && e.score > data.entries[i-1].score)) throw Error();
            this.entries = data.entries;
        } catch { this.status = 'Team scores could not be read. New results remain available this visit.'; }
    }
    qualifies(score) { return score > 0 && (this.entries.length < 5 || score > this.entries.at(-1).score); }
    save(id, initials, score) {
        if (this.saved.has(id)) return true;
        if (!/^[A-Z]{3}$/.test(initials) || !Number.isInteger(score) || score < 1 || score > 1999998) return false;
        const next = [...this.entries, {initials, score}].sort((a,b) => b.score-a.score).slice(0,5);
        try {
            if (!this.storage) throw Error();
            this.storage.setItem(this.key, JSON.stringify({version:1, entries:next}));
            this.entries = next;
            this.saved.add(id);
            this.status = 'Team score saved.';
            return true;
        } catch {
            this.status = 'Could not save team initials. Allow browser storage and retry.';
            return false;
        }
    }
}
