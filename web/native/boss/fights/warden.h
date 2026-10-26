#pragma once
// Horizon Warden and Lens Imp

// ================================================================ HORIZON WARDEN / LENS IMP
static const BossRow SEQ_WARDEN[] = {{0}, {2, WA_SPIRAL, WA_CURVE},
                                     {5, WA_ACCRETE, WA_SPIRAL, WA_CURVE, WA_PULL, WA_ACCRETE}};
static const BossRow SEQ_LENS[] = {{2, MA_CURVE1, MA_BLINK}};
static const float WARDEN_ORBIT[4][3] = {{138, 78, .5f}, {152, 96, 2.2f}, {124, 70, 4.1f}, {106, 60, 3.2f}};
static void bs_warden_begin() {
    for (unsigned i = 0; i < 4; i++) {
        BossPart& p = boss.parts[i];
        p = {};
        p.exists = true; p.kind = PK_STAR; p.slot = i; p.hp = p.hp_max = 5; p.r = 8;
        p.fire_at = game_ms + BOSS_ENTRANCE_MS + 1500 + i * 1000;
    }
    boss.stamp[1] = game_ms + BOSS_ENTRANCE_MS + 4000;
}
static void bs_star_pos(unsigned i, float& x, float& y) {
    float ia = WARDEN_ORBIT[i][0], ib = WARDEN_ORBIT[i][1], rot = WARDEN_ORBIT[i][2];
    float t = boss.aux[0] * (100.0f / ia) + rot * 2;
    float ex = ia * cosf(t), ey = ib * sinf(t);
    x = boss.x + ex * cosf(rot) - ey * sinf(rot);
    y = boss.y + ex * sinf(rot) + ey * cosf(rot);
}
static unsigned bs_stars() {
    unsigned n = 0;
    for (unsigned i = 0; i < 4; i++) n += boss.parts[i].exists;
    return n;
}
static void bs_warden_update() {
    boss.aux[0] += FRAME_TIME_MS / 1000.0f;
    for (unsigned i = 0; i < 4; i++) bs_star_pos(i, boss.parts[i].x, boss.parts[i].y);
    if (!boss.phase) return;
    // The core opens for 2 s every 8 s, announced by the halo (aux[1]).
    if (game_ms >= boss.stamp[1] + 2000) boss.stamp[1] = game_ms + 6000;
    boss.aux[1] = game_ms >= boss.stamp[1] && game_ms < boss.stamp[1] + 2000 ? 1.0f : 0.0f;
    boss.aux[2] = boss.atk ? 1.0f : 0.0f;
    unsigned long interval = 4000;
    for (unsigned i = 0; i < 4; i++) {
        BossPart& p = boss.parts[i];
        if (!p.exists) continue;
        if (!p.state && game_ms + 500 >= p.fire_at) {
            float px = boss.target_x, py = boss.target_y;
            if (!bs_nearest(p.x, p.y, px, py)) continue;
            p.ang = bs_angle_to(p.x, p.y, px, py);
            bs_hazard(HK_AIM, p.x, p.y, p.ang, 520, 0, 500, 0);
            p.state = 1;
        } else if (p.state && game_ms >= p.fire_at) {
            bs_shot_at(SF_NEEDLE, p.x, p.y, p.ang, 2.2f);
            p.state = 0;
            p.fire_at += interval;
        }
    }
}
static bool bs_warden_run(int id, unsigned long t) {
    float cx = boss.x, cy = boss.y;
    switch (id) {
    case WA_SPIRAL:
        if (bs_at(t, 0)) bs_hazard(HK_TELL, cx, cy, 0, 126, 0, 700, 0);
        for (unsigned k = 0; k < 15; k++)
            if (bs_at(t, 700 + k * 160))
                for (unsigned j = 0; j < 3; j++) {
                    float a = k * .30f + j * TWO_PI / 3;
                    if (cosf(a) > .5f) continue;
                    bs_shot_at(SF_PELLET, cx + cosf(a) * 124, cy + sinf(a) * 124, a, 1.7f);
                }
        return t >= 700 + 15 * 160 + 100;
    case WA_CURVE: case MA_CURVE1: {
        bool mini = id == MA_CURVE1;
        float th = bs_angle_to(cx, cy, boss.target_x, boss.target_y);
        float ox = cx + cosf(th) * (mini ? 56 : 124), oy = cy + sinf(th) * (mini ? 56 : 124);
        float speed = 2.0f, dist = bs_dist(ox, oy, boss.target_x, boss.target_y);
        float turn = boss_assist_calm ? 0.0f : (boss.target_y < cy ? .012f : -.012f);
        float theta0 = th - turn * (dist / speed) / 2;
        unsigned n = mini ? 1 : bs_density(5);
        if (bs_at(t, 0)) bs_hazard(HK_AIM, ox, oy, theta0, 480, 0, 500, 0);
        for (unsigned k = 0; k < n; k++)
            if (bs_at(t, 500 + k * 300)) {
                BossShot *s = bs_shot_at(SF_CURVE, ox, oy, theta0, speed);
                if (s) s->turn = turn;
            }
        return t >= 500 + n * 300 + 200;
    }
    case WA_ACCRETE:
        if (bs_at(t, 0)) {
            unsigned pass = (unsigned)boss.aux[3]++;
            float radius = 96;
            for (unsigned i = 0; i < pass && radius > 48; i++) radius *= .94f;
            radius = bs_max(radius, 48);
            for (unsigned p = 0; p < boss_hull_n; p++) {
                if (!bs_alive(p)) continue;
                unsigned long live = (unsigned long)((radius - 32) / .9f * FRAME_TIME_MS) + 400;
                BossHazard *h = bs_hazard(HK_RING, boss_hulls[p]->position_x, boss_hulls[p]->position_y,
                                          bs_rand(-3.0f, 3.0f), radius, .52f, 900, live);
                if (h) { h->d = -.9f; h->e = .011f; }
            }
        }
        return t >= 900 + 2000;
    case WA_PULL:
        if (bs_at(t, 0)) {
            bs_hazard(HK_TELL, cx, cy, 0, 150, 0, 1200, 0);
            BossHazard *h = bs_hazard(HK_PULL, cx, cy, 0, .8f, 0, 1200, 1500);
            (void)h;
            boss.stamp[4] = 1;
        }
        return t >= 2800;
    }
    return true;
}

// ================================================================ LENS IMP
static void bs_lens_update() {
    boss.aux[0] += FRAME_TIME_MS / 1000.0f;
    boss.aux[1] = boss.stamp[3] && game_ms < boss.stamp[3] ? 1.0f : 0.0f; // blinking
}
static bool bs_lens_run(int id, unsigned long t) {
    if (id == MA_CURVE1) return bs_warden_run(id, t);
    // Blink: a 700 ms tell, then the imp reappears elsewhere.
    if (bs_at(t, 0)) boss.stamp[3] = game_ms + 900;
    if (bs_at(t, 700)) {
        float y = bs_rand(80, 195);
        if (fabsf(y - boss.home_y) < 50) y = y < 135 ? y + 60 : y - 60;
        boss.home_y = y;
        boss.y = y;
    }
    return t >= 1000;
}

static bool bs_blinking() { return boss.kind == BK_LENSIMP && boss.stamp[3] && game_ms < boss.stamp[3]; }
// The pull is held back for a while after it fires, and never under the calm assist.
static int bs_warden_pick() {
    int id = bs_seq_pick(SEQ_WARDEN, 3);
    if (id == WA_PULL && (boss.stamp[4] || boss_assist_calm)) id = WA_CURVE;
    return id;
}
static int bs_lens_pick() { return bs_seq_pick(SEQ_LENS, 1); }
static void bs_warden_circles() {
    for (unsigned i = 0; i < 4; i++)
        if (boss.parts[i].exists) bs_circle(boss.parts[i].x, boss.parts[i].y, 9, BC_PART, i, 3);
    bool open = boss.aux[1] > .5f || !bs_stars();
    if (open) bs_circle(boss.x, boss.y, 46, BC_CORE, 0, 3);
    else {
        bs_circle(boss.x, boss.y, 100, BC_BLOCK, 0, 1);
        bs_circle(boss.x, boss.y, 46, BC_CORE, 0, 2);
    }
}
static void bs_lens_circles() {
    if (!bs_blinking()) bs_circle(boss.x, boss.y, 30, BC_CORE, 0, 3);
}
static unsigned bs_warden_body(float *out) {
    unsigned n = 0;
    bs_guard_body(out, n, boss.x, boss.y, 108);
    for (unsigned i = 0; i < 4; i++)
        if (boss.parts[i].exists) bs_guard_body(out, n, boss.parts[i].x, boss.parts[i].y, 7);
    return n;
}
static unsigned bs_lens_body(float *out) {
    unsigned n = 0;
    if (!bs_blinking()) bs_guard_body(out, n, boss.x, boss.y, 30);
    return n;
}
static void bs_warden_hit(BossPart& p, unsigned, unsigned damage, bool) {
    p.hp = damage >= (unsigned)p.hp ? 0 : p.hp - damage;
    if (p.hp <= 0) {
        p.exists = false;
        p.state = 0;
        bs_particles(p.x, p.y);
        display_shake(1);
    }
}
static const BossOps OPS_WARDEN = {338, 135, 4, 3, {70, 35}, {1400, 1200, 1000},
    bs_warden_begin, bs_warden_update, bs_warden_pick, bs_warden_run, bs_warden_circles,
    bs_warden_body, nullptr, nullptr, bs_warden_hit};
static const BossOps OPS_LENSIMP = {380, 135, 6, 1, {0, 0}, {1000, 1000, 1000},
    nullptr, bs_lens_update, bs_lens_pick, bs_lens_run, bs_lens_circles,
    bs_lens_body, nullptr, nullptr, nullptr};
