#pragma once
// Tidecaller and Moonjelly

// ================================================================ TIDECALLER / MOONJELLY
static const BossRow SEQ_TIDE[] = {{2, TA_SINE, TA_SINE},
                                   {4, TA_SINE, TA_TENDRIL, TA_SPORE, TA_TENDRIL},
                                   {5, TA_SINE, TA_TENDRIL, TA_PULSE, TA_SPORE, TA_TENDRIL}};
static const BossRow SEQ_MOONJELLY[] = {{1, MA_SINE6}};
static unsigned bs_bubbles() {
    unsigned n = 0;
    for (unsigned i = 0; i < 3; i++) n += boss.parts[i].exists;
    return n;
}
static void bs_tide_begin() {
    for (unsigned i = 0; i < 3; i++) {
        BossPart& p = boss.parts[i];
        p = {};
        p.exists = true; p.kind = PK_BUBBLE; p.slot = i; p.hp = p.hp_max = 2; p.r = 14;
    }
}
static void bs_tide_update() {
    boss.aux[0] += FRAME_TIME_MS / 1000.0f;
    float w = TWO_PI / 9.0f * boss.aux[0];
    boss.x = boss.home_x + 22 * sinf(w);
    boss.y = boss.home_y + 26 * sinf(2 * w);
    boss.aux[2] = bs_bubbles() ? 0.0f : 1.0f;
    for (unsigned i = 0; i < 3; i++) {
        BossPart& p = boss.parts[i];
        float a = boss.aux[0] * 1.3f + i * TWO_PI / 3;
        p.x = boss.x + cosf(a) * 108;
        p.y = boss.y - 17 + sinf(a) * 40;
    }
    if (boss.phase && !bs_bubbles()) {
        if (!boss.stamp[0]) boss.stamp[0] = game_ms;
        else if (!boss.stamp[2] && bs_since(boss.stamp[0]) >= 3000) {
            for (unsigned i = 0; i < 3; i++) { boss.parts[i].exists = true; boss.parts[i].hp = 2; }
            boss.stamp[2] = 1; // bubbles reform once
            boss.stamp[0] = 0;
        }
    }
}
static void bs_sine_column(float mx, float my, float ang, float phase) {
    BossShot *s = bs_shot_at(SF_SINE, mx, my, ang, 1.8f);
    if (s) { s->amp = 24; s->phase = phase; }
}
static bool bs_tide_run(int id, unsigned long t) {
    switch (id) {
    case TA_SINE: case MA_SINE6: {
        bool mini = id == MA_SINE6;
        float mx = boss.x - (mini ? 50 : 78), my = boss.y + (mini ? 10 : 4);
        float ang = bs_angle_to(mx, my, boss.target_x, boss.target_y);
        unsigned n = mini ? 6 : bs_density(10), gap = mini ? 140 : 120;
        if (bs_at(t, 0)) bs_hazard(HK_ARC, mx, my, ang, .12f, 260, 600, 0);
        for (unsigned k = 0; k < n; k++)
            if (bs_at(t, 600 + k * gap)) {
                bs_sine_column(mx, my, ang, 0);
                if (!mini && boss.phase >= 2) bs_sine_column(mx, my, ang, BOSS_PI);
            }
        return t >= 600 + n * gap + 100;
    }
    case TA_TENDRIL:
        if (bs_at(t, 0)) {
            float px = boss.x - 90;
            BossHazard *a = bs_hazard(HK_ARM, px, boss.y - 48, BOSS_PI + 1.3f, 190, BOSS_PI + 1.3f, 900, 3272);
            if (a) { a->d = -.016f; a->e = BOSS_PI - 1.3f; }
            BossHazard *b = bs_hazard(HK_ARM, px, boss.y + 50, BOSS_PI - 1.3f, 190, BOSS_PI - 1.3f, 900, 3272);
            if (b) { b->d = .016f; b->e = BOSS_PI + 1.3f; }
        }
        return t >= 900 + 3272 + 100;
    case TA_SPORE: {
        unsigned n = boss.phase <= 2 ? 1 : 2;
        for (unsigned k = 0; k < n; k++)
            if (bs_at(t, 300 + k * 600)) {
                float sx = boss.x - 90, sy = boss.y - 10 + k * 20;
                float px = boss.target_x, py = boss.target_y;
                if (k) bs_nearest(sx, sy, px, py);
                bs_shot_at(SF_SPORE, sx, sy, bs_angle_to(sx, sy, px, py), 1.0f, 1, 2000);
            }
        return t >= 300 + n * 600 + 400;
    }
    case TA_PULSE:
        if (bs_at(t, 0)) {
            float gap = bs_angle_to(boss.x, boss.y, boss.target_x, boss.target_y) + (boss.cycle % 2 ? .8f : -.8f);
            BossHazard *h = bs_hazard(HK_RING, boss.x, boss.y - 37, gap, 66, .52f, 700, 4000);
            if (h) { h->d = 2.0f; h->e = 0; }
            bs_hazard(HK_TELL, boss.x, boss.y - 37, 0, 90, 0, 700, 0);
        }
        return t >= 800;
    }
    return true;
}

static int bs_tide_pick() { return bs_seq_pick(SEQ_TIDE, 3); }
static int bs_moonjelly_pick() { return MA_SINE6; }
static void bs_moonjelly_update() {
    boss.aux[0] += FRAME_TIME_MS / 1000.0f;
    float w = TWO_PI / 8.0f * boss.aux[0];
    boss.x = boss.home_x + 16 * sinf(w);
    boss.y = boss.home_y + 24 * sinf(2 * w);
}
static void bs_tide_circles() {
    for (unsigned i = 0; i < 3; i++)
        if (boss.parts[i].exists)
            bs_circle(boss.parts[i].x, boss.parts[i].y, 14, BC_PART, i, 3);
    if (bs_bubbles()) {
        bs_circle(boss.x, boss.y - 37, 72, BC_BLOCK, 0, 1);
        bs_circle(boss.x, boss.y - 37, 72, BC_CORE, 0, 2);
    } else bs_circle(boss.x, boss.y - 37, 72, BC_CORE, 0, 3);
}
static void bs_moonjelly_circles() { bs_circle(boss.x, boss.y - 25, 44, BC_CORE, 0, 3); }
static unsigned bs_tide_body(float *out) {
    unsigned n = 0;
    bs_guard_body(out, n, boss.x, boss.y - 37, 74);
    return n;
}
static unsigned bs_moonjelly_body(float *out) {
    unsigned n = 0;
    bs_guard_body(out, n, boss.x, boss.y - 25, 46);
    return n;
}
static void bs_pop_bubbles() {
    for (unsigned i = 0; i < 3; i++)
        if (boss.parts[i].exists) {
            boss.parts[i].exists = false;
            bs_particles(boss.parts[i].x, boss.parts[i].y);
        }
}
// A laser through the bell pops every bubble guarding it.
static unsigned bs_tide_soak(unsigned damage, bool laser) {
    if (laser) bs_pop_bubbles();
    return damage;
}
static void bs_tide_hit(BossPart& p, unsigned, unsigned damage, bool laser) {
    if (laser) {
        bs_pop_bubbles();
        return;
    }
    p.hp = damage >= (unsigned)p.hp ? 0 : p.hp - damage;
    if (p.hp <= 0) { p.exists = false; bs_particles(p.x, p.y); }
}
static const BossOps OPS_TIDECALLER = {356, 142, 5, 3, {70, 35}, {1100, 1000, 800},
    bs_tide_begin, bs_tide_update, bs_tide_pick, bs_tide_run, bs_tide_circles,
    bs_tide_body, nullptr, bs_tide_soak, bs_tide_hit};
static const BossOps OPS_MOONJELLY = {380, 140, 8, 1, {0, 0}, {1300, 1300, 1300},
    nullptr, bs_moonjelly_update, bs_moonjelly_pick, bs_tide_run, bs_moonjelly_circles,
    bs_moonjelly_body, nullptr, nullptr, nullptr};
