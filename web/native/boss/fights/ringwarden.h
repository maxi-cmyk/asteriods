#pragma once
// Ringwarden and Shardling

// Slots of boss.aux.
enum { AUX_RING_SCALE = 0,        // radius scale of both rings (collapse shrinks it)
       AUX_RING_OUTER_SPIN = 1,   // angle of the outer ring
       AUX_RING_INNER_SPIN = 2,   // angle of the inner ring
       AUX_RING_CHARGING = 3 };   // 1 while the core glows for a burst or prism
enum { AUX_SHARD_SPIN = 2,        // angle of the three orbiting blades
       AUX_SHARD_KITE_X = 4 };    // x the mini drifts toward (0 = home)

// ================================================================ RINGWARDEN / SHARDLING
static const BossRow SEQ_RING[] = {{2, RA_BURST, RA_BURST},
                                   {4, RA_BURST, RA_PRISM, RA_PICK, RA_PRISM},
                                   {4, RA_COLLAPSE, RA_BURST, RA_PRISM, RA_PICK}};
static void bs_ring_pos(unsigned i, float& x, float& y) {
    bool outer = i < 16;
    unsigned count = outer ? 16 : 11, slot = outer ? i : i - 16;
    float spin = outer ? boss.aux[AUX_RING_OUTER_SPIN] : boss.aux[AUX_RING_INNER_SPIN];
    float radius = (outer ? 106.0f : 70.0f) * boss.aux[AUX_RING_SCALE];
    float a = slot * TWO_PI / count + spin;
    x = boss.x + cosf(a) * radius;
    y = boss.y + sinf(a) * radius;
}
static void bs_ring_update() {
    float t = bs_since(boss.born) / 1000.0f;
    boss.y = boss.home_y + 40 * sinf(TWO_PI * t / 8.0f);
    boss.aux[AUX_RING_OUTER_SPIN] += .0042f;
    boss.aux[AUX_RING_INNER_SPIN] -= .0075f;
    if (boss.atk != RA_COLLAPSE) boss.aux[AUX_RING_SCALE] = 1 + .02f * sinf(t * 2);
    boss.aux[AUX_RING_CHARGING] = boss.atk == RA_BURST || boss.atk == RA_PRISM ? 1.0f : 0.0f;
    for (unsigned i = 0; i < 27; i++) {
        BossPart& p = boss.parts[i];
        if (!p.exists && p.until && game_ms >= p.until) { p.exists = true; p.hp = 1; p.until = 0; }
        if (p.exists) bs_ring_pos(i, p.x, p.y);
    }
}
static void bs_ring_spawn_parts() {
    for (unsigned i = 0; i < 27; i++) {
        BossPart& p = boss.parts[i];
        p = {};
        p.exists = true; p.kind = PK_BLADE; p.slot = i; p.hp = p.hp_max = 1;
        p.r = i < 16 ? 14 : 12;
    }
    boss.aux[AUX_RING_SCALE] = 1;
    boss.aux[AUX_RING_INNER_SPIN] = .28f;
}
static void bs_ring_break(BossPart& p, unsigned long regrow) {
    p.exists = false;
    p.until = game_ms + regrow;
    bs_particles(p.x, p.y);
}
static bool bs_ring_run(int id, unsigned long t) {
    switch (id) {
    case RA_BURST: {
        if (bs_at(t, 0)) bs_hazard(HK_TELL, boss.x, boss.y, 0, 124, 0, 700, 0);
        if (bs_at(t, 700)) {
            unsigned n = bs_density(12), made = 0;
            for (unsigned k = 0; k < 16 && made < n; k += 2) {
                BossPart& p = boss.parts[k];
                if (!p.exists) continue;
                float a = bs_angle_to(boss.x, boss.y, p.x, p.y);
                bs_shot_at(SF_SHARD, p.x, p.y, a, 1.6f);
                bs_ring_break(p, 3000);
                made++;
            }
            for (unsigned k = 0; k < 11 && made < n; k += 3) {
                BossPart& p = boss.parts[16 + k];
                if (!p.exists) continue;
                bs_shot_at(SF_SHARD, p.x, p.y, bs_angle_to(boss.x, boss.y, p.x, p.y), 1.6f);
                bs_ring_break(p, 3000);
                made++;
            }
        }
        return t >= 1000;
    }
    case RA_PRISM:
        if (bs_at(t, 0)) {
            float mid = bs_angle_to(boss.x, boss.y, boss.target_x, boss.target_y);
            float dir = rock_random_bounded(2) ? 1.0f : -1.0f;
            float start = mid - dir * .785f, rate = dir * .018f;
            BossHazard *h = bs_hazard(HK_BEAM, boss.x, boss.y, start, 0, start, 900, 1745);
            if (h) { h->d = rate; h->e = start + dir * 1.5708f; }
        }
        return t >= 900 + 1745 + 100;
    case RA_PICK: {
        float mx = boss.x - 128, my = boss.y;
        float ang = bs_angle_to(mx, my, boss.target_x, boss.target_y);
        if (bs_at(t, 0)) bs_hazard(HK_AIM, mx, my, ang, 500, 0, 500, 0);
        for (int k = 0; k < 3; k++)
            if (bs_at(t, 500 + k * 150)) bs_shot_at(SF_FAST, mx, my, ang, 2.6f);
        return t >= 900;
    }
    case RA_COLLAPSE:
        if (bs_at(t, 0)) {
            float gap = bs_angle_to(boss.x, boss.y, boss.target_x, boss.target_y) + (boss.cycle % 2 ? 1.0f : -1.0f);
            BossHazard *h = bs_hazard(HK_RING, boss.x, boss.y, gap, 40, .61f, 1200, 4500);
            if (h) { h->d = 2.0f; h->e = 0; }
            bs_hazard(HK_TELL, boss.x, boss.y, 0, 120, 0, 1200, 0);
        }
        if (t < 1200) boss.aux[AUX_RING_SCALE] = 1 - .8f * (t / 1200.0f);
        if (bs_at(t, 1200)) {
            boss.aux[AUX_RING_SCALE] = 1;
            for (unsigned i = 0; i < 27; i++) {
                BossPart& p = boss.parts[i];
                if (p.exists) bs_ring_break(p, 2500);
            }
            display_shake(1);
        }
        return t >= 1300;
    }
    return true;
}
// ================================================================ SHARDLING
static void bs_shardling_update() {
    boss.aux[AUX_SHARD_SPIN] += .02f;
    float want = boss.aux[AUX_SHARD_KITE_X] > 0 ? boss.aux[AUX_SHARD_KITE_X] : boss.home_x;
    boss.x += bs_clamp(want - boss.x, -1.1f, 1.1f);
    boss.y += bs_clamp(bs_clamp(boss.target_y, 70, 205) - boss.y, -.8f, .8f);
}
static bool bs_shardling_run(int id, unsigned long t) {
    (void)id;
    float ang = bs_angle_to(boss.x, boss.y, boss.target_x, boss.target_y);
    float mx = boss.x + cosf(ang) * 62, my = boss.y + sinf(ang) * 62;
    if (bs_at(t, 0)) {
        bs_hazard(HK_AIM, mx, my, ang, 480, 0, 500, 0);
        boss.aux[AUX_SHARD_KITE_X] = 300; // kite in
    }
    for (int k = 0; k < 3; k++)
        if (bs_at(t, 500 + k * 150)) bs_shot_at(SF_FAST, mx, my, ang, 2.6f);
    if (bs_at(t, 1100)) boss.aux[AUX_SHARD_KITE_X] = boss.home_x;
    return t >= 1200;
}

static int bs_ring_pick() { return bs_seq_pick(SEQ_RING, 3); }
static void bs_ring_circles() {
    for (unsigned i = 0; i < 27; i++)
        if (boss.parts[i].exists)
            bs_circle(boss.parts[i].x, boss.parts[i].y, boss.parts[i].r, BC_PART, i, 3);
    bs_circle(boss.x, boss.y, 26, BC_CORE, 0, 3);
}
static unsigned bs_ring_body(float *out) {
    unsigned n = 0;
    bs_guard_body(out, n, boss.x, boss.y, 28);
    for (unsigned i = 0; i < 27 && n < 32; i++)
        if (boss.parts[i].exists)
            bs_guard_body(out, n, boss.parts[i].x, boss.parts[i].y, boss.parts[i].r - 2);
    return n;
}
// A blade hit: it breaks and regrows after six seconds.
static void bs_ring_hit(BossPart& p, unsigned, unsigned, bool) { bs_ring_break(p, 6000); }
static void bs_shardling_circles() {
    for (unsigned k = 0; k < 3; k++) {
        float a = boss.aux[AUX_SHARD_SPIN] + k * TWO_PI / 3;
        bs_circle(boss.x + cosf(a) * 46, boss.y + sinf(a) * 46, 11, BC_BLOCK, 0, 1);
    }
    bs_circle(boss.x, boss.y, 22, BC_CORE, 0, 3);
}
static unsigned bs_shardling_body(float *out) {
    unsigned n = 0;
    bs_guard_body(out, n, boss.x, boss.y, 24);
    for (unsigned k = 0; k < 3; k++) {
        float a = boss.aux[AUX_SHARD_SPIN] + k * TWO_PI / 3;
        bs_guard_body(out, n, boss.x + cosf(a) * 46, boss.y + sinf(a) * 46, 11);
    }
    return n;
}
static int bs_shardling_pick() { return MA_SHARDS; }
static const BossOps OPS_RINGWARDEN = {352, 135, 6, 3, {66, 33}, {1200, 1100, 1000},
    bs_ring_spawn_parts, bs_ring_update, bs_ring_pick, bs_ring_run, bs_ring_circles,
    bs_ring_body, nullptr, nullptr, bs_ring_hit};
static const BossOps OPS_SHARDLING = {370, 135, 8, 1, {0, 0}, {1000, 1000, 1000},
    nullptr, bs_shardling_update, bs_shardling_pick, bs_shardling_run, bs_shardling_circles,
    bs_shardling_body, nullptr, nullptr, nullptr};
