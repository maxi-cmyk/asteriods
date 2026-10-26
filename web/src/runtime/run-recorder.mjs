import { S, BOSS, BOSS_AT } from './scene-layout.mjs';

// Turns the end of a run into a result and writes it to the personal-best and boss-defeat
// records. Solo and co-op share the bookkeeping; only the numbers they read differ.
export class RunRecorder {
    constructor({ records, bossRecords, profile }) {
        this.records = records;
        this.bossRecords = bossRecords;
        this.profile = profile; // () => the active profile index
        this.run = null; // set while a run is live and unrecorded
        this.result = null; // the last finished run
    }
    get runProfile() {
        return this.run?.profile ?? this.result?.profile ?? (this.profile() === 1 ? 1 : 0);
    }
    beginSolo(practice = false) {
        this.run = {
            profile: this.profile() === 1 ? 1 : 0,
            rules: { mode: 'solo', friendlyFire: false, modifiers: [], practice },
        };
        this.result = null;
    }
    beginCoop(friendlyFire) {
        this.run = {
            rules: { mode: 'co-op', friendlyFire: !!friendlyFire, modifiers: [], practice: false },
        };
        this.result = null;
    }
    discardRun() {
        this.run = null;
    }
    discardResult() {
        this.result = null;
    }
    finishSolo(stats, scene) {
        const { run } = this;
        if (!run) return;
        this.result = {
            ...run,
            score: scene[S.SCORE],
            wave: stats.highestWave,
            peakCps: stats.peakCps,
            longestChain: stats.longestChain,
            shots: stats.spawned,
            hits: stats.hits,
            laserShots: stats.laserShots,
            laserKills: stats.laserKills,
            bossKills: scene[S.BOSS_KILLS],
            bossMask: scene[BOSS_AT + BOSS.DEFEATED_MASK],
            bossHits: scene[BOSS_AT + BOSS.HITS_TAKEN],
            elapsedMs: scene[S.GAME_MS],
            destroyed: scene[S.RUN_DESTROYED],
            bestMultiplier: scene[S.RUN_BEST_MULTIPLIER],
        };
        this.records.record(run.profile, run.rules, this.result);
        if (!run.rules.practice) this.bossRecords.record(run.profile, this.result.bossMask || 0);
        this.run = null;
    }
    // `players` are the decoded co-op scenes; `profiles` says whose records they are.
    finishCoop(profiles, players) {
        const { run } = this;
        if (!run) return false;
        const summaries = players.map((p, i) => ({
            profile: profiles[i],
            score: p.score,
            wave: p.stats.highestWave,
            peakCps: p.stats.peakCps,
            longestChain: p.stats.longestChain,
            shots: p.stats.spawned,
            hits: p.stats.hits,
            laserShots: p.stats.laserShots,
            laserKills: p.stats.laserKills,
            destroyed: p.scene[S.RUN_DESTROYED],
            bestMultiplier: p.scene[S.RUN_BEST_MULTIPLIER],
            bossParticipation: p.participation,
        }));
        const mask = players[0].scene[BOSS_AT + BOSS.DEFEATED_MASK];
        this.result = {
            rules: run.rules,
            profile: profiles[0],
            players: summaries,
            score: players[0].teamScore,
            wave: players[0].scene[S.WAVE],
            elapsedMs: players[0].scene[S.GAME_MS],
            bossKills: players[0].scene[S.BOSS_KILLS],
            bossMask: mask,
        };
        summaries.forEach((p) => this.records.record(p.profile, run.rules, p));
        summaries.forEach((p) => this.bossRecords.record(p.profile, mask));
        this.run = null;
        return true;
    }
}
