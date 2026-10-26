#pragma once
// The framework's view of the current fight's BossOps row.

static void bs_pickups();

static void bs_kind_begin() {
    const BossOps& o = bs_ops();
    boss.home_x = o.home_x;
    boss.home_y = o.home_y;
    boss.aux[4] = 0;
    if (o.begin) o.begin();
}
static void bs_kind_update() { bs_ops().update(); }
static int bs_kind_pick() { return bs_ops().pick(); }
static bool bs_kind_run(int id, unsigned long t) { return bs_ops().run(id, t); }
static unsigned long bs_kind_rest() {
    unsigned idx = (boss.phase < 3 ? boss.phase : 3) - 1;
    return bs_ops().rest[idx];
}
static void bs_kind_circles() { bs_ops().circles(); }
static unsigned bs_kind_body(float *out) { return bs_ops().body(out); } // x, y, r triples
static void bs_kind_phase(unsigned phase) {
    if (bs_ops().phase) bs_ops().phase(phase);
    if (phase >= 2) bs_pickups();
}
// A player shot or the laser touched a sub-target.
static void bs_kind_hit(const BossCircle& c, unsigned owner, unsigned damage, bool laser) {
    BossPart& p = boss.parts[c.index];
    if (!p.exists) return;
    if (bs_ops().hit) bs_ops().hit(p, owner, damage, laser);
}
// Damage after the kind's armour (shell, bubbles, hull plating) has had its say.
static unsigned bs_kind_soak(unsigned damage, bool laser) {
    return bs_ops().soak ? bs_ops().soak(damage, laser) : damage;
}

// Phase boundaries. Tier 2+ adds a final frenzy phase at 15% health.
static unsigned bs_phases() { return bs_ops().phases; }
static bool bs_frenzy() { return boss.phase > bs_phases(); }
static unsigned bs_phase_for(unsigned health) {
    unsigned phase = 1;
    for (uint8_t c : bs_ops().cut)
        if (c && health * 100 <= c * boss.maximum) phase++;
    if (boss.tier >= 2 && !boss.mini && health * 100 <= 15 * boss.maximum) phase = bs_phases() + 1;
    return phase;
}
// Health at which a phase begins (for practice starting mid-fight).
static unsigned bs_phase_health(unsigned phase) {
    unsigned pct = 100;
    if (phase > bs_phases()) pct = 15;
    else if (phase >= 2) pct = bs_ops().cut[phase - 2];
    unsigned health = boss.maximum * pct / 100;
    return health ? health : 1;
}
