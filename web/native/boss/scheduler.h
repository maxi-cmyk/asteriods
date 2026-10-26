#pragma once
// The attack scheduler: sequence rows, rests and the attack state machine.

// ---------------------------------------------------------------- scheduler
// Attack rows: {count, ids...} per phase. Tier 1 adds the next phase's closing
// attack to each row, so it appears one phase early.
typedef uint8_t BossRow[8];
static int bs_seq_pick(const BossRow *rows, unsigned count) {
    unsigned idx = (boss.phase < count ? boss.phase : count) - 1;
    const uint8_t *row = rows[idx];
    unsigned total = row[0];
    int extra = 0;
    if (boss.tier >= 1) {
        const uint8_t *next = rows[idx + 1 < count ? idx + 1 : idx];
        extra = next[0] ? next[next[0]] : 0;
        if (extra) total++;
    }
    if (!total) return 0;
    unsigned k = (boss.seq ? boss.seq - 1 : 0) % total;
    return k < row[0] ? row[1 + k] : extra;
}
static unsigned long bs_rest_scaled(unsigned long base) {
    float scale = boss.tier >= 1 ? .85f : 1.0f;
    if (boss.tier >= 2 && bs_frenzy()) scale = .7f;
    return (unsigned long)(base * scale);
}
static void bs_pickups() {
    if (boss.mini || pickup.active) return;
    uint8_t want = boss.phase >= 3 ? 2 : boss.phase >= 2 ? 1 : 0;
    for (uint8_t bit = 0; bit < want; bit++) {
        if (boss.drops & (1u << bit)) continue;
        pickup = {float(SCREEN_W - 24), bs_rand(70, 200), bit == 0 ? PICKUP_SHIELD : PICKUP_MULTISHOT, true};
        boss.drops |= 1u << bit;
        return;
    }
}
static void bs_scheduler() {
    if (!boss.atk) {
        if (game_ms < boss.rest_until) return;
        int id = bs_kind_pick();
        if (!id) { boss.rest_until = game_ms + 500; return; }
        boss.atk = id;
        boss.atk_t0 = game_ms;
        boss.seq++;
        boss.seq_total++;
        boss.cycle++;
        bs_acquire();
    }
    if (bs_kind_run(boss.atk, game_ms - boss.atk_t0)) {
        boss.atk = 0;
        boss.rest_until = game_ms + bs_rest_scaled(bs_kind_rest());
    }
}
