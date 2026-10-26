import { COOP_SCORE_KEYS } from './coop-records.mjs';
import { BOSS_RECORDS_KEY, emptyBossRecords } from '../boss/records.mjs';
export const RECORDS_KEY = 'asteroids.web.personal-bests-v1';
export const MIN_ACCURACY_SHOTS = 50;
const metrics = ['score', 'wave', 'peakCps', 'longestChain'];
const validNumber = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 1e9;
export function rulesKey({
    mode = 'solo',
    friendlyFire = false,
    modifiers = [],
    practice = false,
} = {}) {
    if (
        !['solo', 'co-op', 'versus'].includes(mode) ||
        typeof friendlyFire !== 'boolean' ||
        !Array.isArray(modifiers) ||
        modifiers.some((value) => typeof value !== 'string' || !/^[a-z0-9-]{1,40}$/.test(value))
    ) {
        throw new TypeError('Invalid run rules');
    }
    return JSON.stringify([mode, friendlyFire, [...new Set(modifiers)].sort(), !!practice]);
}
function validRecord(record) {
    return (
        record &&
        metrics.every((metric) => validNumber(record[metric])) &&
        (record.accuracy === null ||
            (record.accuracy &&
                validNumber(record.accuracy.shots) &&
                record.accuracy.shots >= MIN_ACCURACY_SHOTS &&
                validNumber(record.accuracy.hits) &&
                record.accuracy.hits <= record.accuracy.shots))
    );
}
export class PersonalBests {
    constructor(storage) {
        this.storage = storage;
        this.profiles = [{}, {}];
        this.status = storage
            ? 'Personal bests saved in this browser.'
            : 'Storage unavailable; personal bests last for this visit.';
        try {
            const raw = storage?.getItem(RECORDS_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.version !== 1 || !Array.isArray(data.profiles) || data.profiles.length !== 2)
                throw new Error('Invalid records');
            for (const [index, profile] of data.profiles.entries()) {
                if (!profile || typeof profile !== 'object' || Array.isArray(profile))
                    throw new Error('Invalid profile');
                for (const [key, record] of Object.entries(profile)) {
                    const [mode, friendlyFire, modifiers, practice] = JSON.parse(key);
                    if (
                        rulesKey({ mode, friendlyFire, modifiers, practice }) !== key ||
                        !validRecord(record)
                    )
                        continue;
                    this.profiles[index][key] = record;
                }
            }
        } catch {
            this.status =
                'Saved personal bests could not be read; new records last for this visit until a save succeeds.';
        }
    }
    get(profile, rules) {
        return this.profiles[profile === 1 ? 1 : 0][rulesKey(rules)] ?? null;
    }
    save() {
        try {
            if (!this.storage) throw new Error('No storage');
            this.storage.setItem(
                RECORDS_KEY,
                JSON.stringify({ version: 1, profiles: this.profiles }),
            );
            this.status = 'Personal bests saved in this browser.';
            return true;
        } catch {
            this.status =
                'Could not save personal bests; records last for this visit. Allow browser storage to keep them.';
            return false;
        }
    }
    record(profile, rules, run) {
        if (
            !metrics.every((metric) => validNumber(run[metric])) ||
            !validNumber(run.shots) ||
            !validNumber(run.hits) ||
            run.hits > run.shots
        )
            throw new TypeError('Invalid run statistics');
        const index = profile === 1 ? 1 : 0,
            key = rulesKey(rules);
        const old = this.get(index, rules);
        const next = { accuracy: old?.accuracy ?? null };
        for (const metric of metrics) next[metric] = Math.max(old?.[metric] ?? 0, run[metric]);
        if (
            run.shots >= MIN_ACCURACY_SHOTS &&
            (!next.accuracy || run.hits / run.shots > next.accuracy.hits / next.accuracy.shots)
        ) {
            next.accuracy = { hits: run.hits, shots: run.shots };
        }
        this.profiles[index][key] = next;
        this.save();
        return next;
    }
    reset(profile) {
        this.profiles[profile === 1 ? 1 : 0] = {};
        return this.save();
    }
}
export function accuracyText(hits, shots) {
    return shots ? `${((100 * hits) / shots).toFixed(1)}% (${hits}/${shots})` : '—';
}

// Reset only this game's records; controls and unrelated origin data survive.
export function clearBrowserRecords(storage, scoreKey) {
    const emptyScores = Array(42).fill(0);
    emptyScores[0] = 1;
    const emptyBests = JSON.stringify({ version: 1, profiles: [{}, {}] });
    const changes = [
        [scoreKey, JSON.stringify(emptyScores)],
        [RECORDS_KEY, emptyBests],
        [BOSS_RECORDS_KEY, emptyBossRecords()],
        ...COOP_SCORE_KEYS.map((key) => [key, JSON.stringify({ version: 1, entries: [] })]),
    ];
    const previous = [];
    try {
        if (!storage) throw new Error('Storage unavailable');
        for (const [key] of changes) previous.push([key, storage.getItem(key)]);
        for (const [key, value] of changes) storage.setItem(key, value);
        return { ok: true, message: 'Leaderboard and both profiles cleared in this browser.' };
    } catch {
        let restored = true;
        for (const [key, value] of previous) {
            try {
                if (value === null || value === undefined) storage.removeItem(key);
                else storage.setItem(key, value);
            } catch {
                restored = false;
            }
        }
        return {
            ok: false,
            message: restored
                ? 'Could not clear records. Browser storage is unavailable; try again.'
                : 'Record reset could not finish. Reload to check stored records before retrying.',
        };
    }
}
