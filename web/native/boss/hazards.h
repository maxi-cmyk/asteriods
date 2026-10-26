#pragma once
// Hazards: lethal geometry, the corridor fairness metric, and the per-tick update.

// ---------------------------------------------------------------- hazards
static bool bs_hazard_hits(const BossHazard& h, float px, float py, float r) {
    float dx = px - h.x, dy = py - h.y;
    switch (h.kind) {
    case HK_LANE:
    case HK_BEAM:
    case HK_ARM: {
        float ca = cosf(h.a), sa = sinf(h.a);
        float along = dx * ca + dy * sa, across = -dx * sa + dy * ca;
        float len = h.kind == HK_BEAM ? 520.0f : h.b;
        float half = h.kind == HK_LANE ? h.c : h.kind == HK_BEAM ? 5.0f : 5.0f + r * .3f;
        return along >= 0 && along <= len && fabsf(across) < half + r;
    }
    case HK_POOL:
        return dx * dx + dy * dy < (h.c + r) * (h.c + r);
    case HK_RING: {
        float dist = sqrtf(dx * dx + dy * dy);
        if (fabsf(dist - h.b) >= 4 + r * .6f) return false;
        float delta = bs_wrap(bs_atan2(dy, dx) - h.a);
        return fabsf(delta) >= h.c; // inside the gap is safe
    }
    }
    return false;
}
// Widest channel between warned or live hazards: a free vertical run in some
// column or a free horizontal run in some row (a vertical lane leaves rows open).
static unsigned bs_corridor() {
    static const float lines[] = {40, 100, 160, 220};
    static const float rows[] = {45, 90, 135, 180, 225};
    unsigned widest = 0;
    for (int pass = 0; pass < 2; pass++) {
        for (unsigned k = 0; k < (pass ? 5u : 4u); k++) {
            unsigned best = 0, run = 0;
            float fixed = pass ? rows[k] : lines[k];
            for (int v = 16; v <= (pass ? 464 : 248); v += 2) {
                bool blocked = false;
                float px = pass ? v : fixed, py = pass ? fixed : v;
                for (const BossHazard& h : boss.hz) {
                    if (!h.active || !bs_lethal_kind(h.kind) || h.warn_left > 1000) continue;
                    if (bs_hazard_hits(h, px, py, SHIP_RADIUS)) { blocked = true; break; }
                }
                run = blocked ? 0 : run + 2;
                if (run > best) best = run;
            }
            if (best + 2 * SHIP_RADIUS > widest) widest = best + 2 * SHIP_RADIUS;
        }
    }
    return widest;
}
static void bs_hazards_update() {
    for (unsigned i = 0; i < BOSS_HAZARDS; i++) {
        BossHazard& h = boss.hz[i];
        if (!h.active) continue;
        if (h.warn_left) {
            h.warn_left = h.warn_left > FRAME_TIME_MS ? h.warn_left - FRAME_TIME_MS : 0;
            if (!h.warn_left && bs_lethal_kind(h.kind) && h.warn_total < bs_warn_min(h.kind))
                boss.violations++;
            if (!h.live_left && !h.warn_left) h.active = false;
            continue;
        }
        if (h.live_left <= FRAME_TIME_MS) { h.active = false; continue; }
        h.live_left -= FRAME_TIME_MS;
        if (h.kind == HK_BEAM || h.kind == HK_ARM) h.a += h.d;
        if (h.kind == HK_RING) {
            h.b += h.d;     // radius moves by d; the gap spins by e
            h.a += h.e;
            if (h.d < 0 && h.b < 32) { h.b = 32; h.d = 0; }
        }
        if (h.kind == HK_PULL && !boss_assist_calm) {
            for (unsigned p = 0; p < boss_hull_n; p++) {
                if (!bs_alive(p)) continue;
                Ship& s = *boss_hulls[p];
                float dx = h.x - s.position_x, dy = h.y - s.position_y;
                float len = bs_max(1.0f, sqrtf(dx * dx + dy * dy));
                s.position_x = bs_clamp(s.position_x + dx / len * h.b, SHIP_MIN_X, SHIP_MAX_X);
                s.position_y = bs_clamp(s.position_y + dy / len * h.b, SHIP_MIN_Y, SHIP_MAX_Y);
            }
        }
        if (!bs_lethal_kind(h.kind)) continue;
        for (unsigned p = 0; p < boss_hull_n; p++)
            if (bs_alive(p) && bs_hazard_hits(h, boss_hulls[p]->position_x,
                                              boss_hulls[p]->position_y, SHIP_RADIUS))
                bs_hit_pilot(p);
    }
}
