#pragma once
// Sentinel and Picket

// Slots of boss.aux (floats the scene exports to the UI).
enum { AUX_SENTINEL_OPEN = 0,   // 0 closed .. 1 open: only an open gate can be shot
       AUX_SENTINEL_BUSY = 1 }; // 1 while an attack runs

// ================================================================ SENTINEL / PICKET
static const BossRow SEQ_SENTINEL[] = {{2, SA_LANCE, SA_FAN}, {4, SA_LANCE, SA_FAN, SA_VOLLEY, SA_CROSS}};
static const BossRow SEQ_PICKET[] = {{1, SA_LANCE}};

static void bs_gate_update() {
    float want = boss.atk ? 0.0f : 1.0f;
    boss.aux[AUX_SENTINEL_OPEN] += bs_clamp(want - boss.aux[AUX_SENTINEL_OPEN], -.08f, .08f);
    boss.aux[AUX_SENTINEL_BUSY] = boss.atk ? 1.0f : 0.0f;
    if (boss.kind == BK_PICKET && boss.phase) boss.y = boss.home_y + 36 * sinf(TWO_PI * bs_since(boss.born) / 7000.0f);
}
static bool bs_sentinel_run(int id, unsigned long t) {
    float mx = boss.x - (boss.kind == BK_PICKET ? 52 : 82), my = boss.y;
    float lane_x = boss.x - (boss.kind == BK_PICKET ? 10 : 30);
    switch (id) {
    case SA_LANCE:
        if (bs_at(t, 0)) bs_hazard(HK_LANE, lane_x, boss.target_y, BOSS_PI, lane_x, 9, 900, 320);
        return t >= 1240;
    case SA_FAN: {
        float ang = bs_angle_to(mx, my, boss.target_x, boss.target_y);
        if (bs_at(t, 0)) bs_hazard(HK_ARC, mx, my, ang, .28f, 190, 700, 0);
        if (bs_at(t, 700))
            for (int i = 0; i < 3; i++) bs_shot_at(SF_NEEDLE, mx, my, ang + (i - 1) * .28f, 2.2f);
        return t >= 800;
    }
    case SA_VOLLEY: {
        unsigned n = bs_density(5);
        if (bs_at(t, 0))
            bs_hazard(HK_AIM, mx, my, bs_angle_to(mx, my, boss.target_x, boss.target_y), 400, 0, 600, 0);
        for (unsigned k = 0; k < n; k++)
            if (bs_at(t, 600 + k * 120)) {
                float px = boss.target_x, py = boss.target_y;
                bs_nearest(mx, my, px, py);
                bs_shot_at(SF_NEEDLE, mx, my, bs_angle_to(mx, my, px, py), 1.8f);
            }
        return t >= 600 + n * 120 + 100;
    }
    case SA_CROSS:
        if (bs_at(t, 0)) {
            float vx = bs_clamp(boss.target_x > 160 ? boss.target_x - 90 : boss.target_x + 90, 40, 250);
            float hy = bs_clamp(boss.target_y > 135 ? boss.target_y - 80 : boss.target_y + 80, 40, 230);
            bs_hazard(HK_LANE, lane_x, hy, BOSS_PI, lane_x, 9, 900, 320);
            bs_hazard(HK_LANE, vx, 0, BOSS_PI / 2, 270, 9, 900, 320);
        }
        return t >= 1240;
    }
    return true;
}

static int bs_sentinel_pick() { return bs_seq_pick(SEQ_SENTINEL, 2); }
static int bs_picket_pick() { return bs_seq_pick(SEQ_PICKET, 1); }
static bool bs_open_gate() { return boss.aux[AUX_SENTINEL_OPEN] > .5f; }
static void bs_sentinel_circles() {
    if (bs_open_gate()) bs_circle(boss.x, boss.y, 33, BC_CORE, 0, 3);
    else bs_circle(boss.x, boss.y, 72, BC_BLOCK, 0, 1);
}
static void bs_picket_circles() {
    if (bs_open_gate()) bs_circle(boss.x, boss.y, 18, BC_CORE, 0, 3);
    else bs_circle(boss.x, boss.y, 40, BC_BLOCK, 0, 1);
}
static unsigned bs_sentinel_body(float *out) {
    unsigned n = 0;
    bs_guard_body(out, n, boss.x, boss.y, 72);
    return n;
}
static unsigned bs_picket_body(float *out) {
    unsigned n = 0;
    bs_guard_body(out, n, boss.x, boss.y, 40);
    return n;
}
//                                   home        k  phases cut        rest ms
static const BossOps OPS_SENTINEL = {366, 135, 3, 2, {60, 0}, {950, 800, 800},
    nullptr, bs_gate_update, bs_sentinel_pick, bs_sentinel_run, bs_sentinel_circles,
    bs_sentinel_body, nullptr, nullptr, nullptr};
static const BossOps OPS_PICKET = {380, 135, 5, 1, {0, 0}, {1100, 1100, 1100},
    nullptr, bs_gate_update, bs_picket_pick, bs_sentinel_run, bs_picket_circles,
    bs_picket_body, nullptr, nullptr, nullptr};
