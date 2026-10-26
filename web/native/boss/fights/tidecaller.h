#pragma once
// Tidecaller and Moonjelly

// Slots of boss.aux and boss.stamp.
enum { AUX_TIDE_CLOCK = 0,        // seconds since the entrance, drives the sway
       AUX_TIDE_EXPOSED = 2 };    // 1 once no bubble guards the bell
// Slots of boss.scratch, this attack's own random choices (shared with the Horizon Warden,
// which borrows these attacks, so they never live in boss.aux).
enum { SCR_TIDE_MUZZLE = 0,       // this stream's muzzle height, relative to the bell
       SCR_TIDE_TILT = 1,         // this stream's aim error in radians
       SCR_TIDE_SEED = 2,         // random seed for the stream's uneven rhythm
       SCR_TIDE_GAP = 3 };        // 3..5: where each tidal wall's gap is
enum { AUX_JELLY_CLOCK = 0 };
enum { STAMP_TIDE_BARE_SINCE = 0,     // when the last bubble popped (0 = bubbles stand)
       STAMP_TIDE_REFORMED = 2 };     // the bubbles reformed once already

// ================================================================ TIDECALLER / MOONJELLY
// Faster, wider and less predictable than the bosses before it: the streams wander over the whole
// bell, and three attacks (a wall of pellets with a random gap, spores raining from the top, and
// whirlpools that open anywhere) come on top of the old kit.
static const BossRow SEQ_TIDE[] = {{4, TA_SINE, TA_RAIN, TA_SINE, TA_WALL},
                                   {6, TA_SINE, TA_TENDRIL, TA_WALL, TA_RAIN, TA_SPORE, TA_WHIRL},
                                   {7, TA_SINE, TA_TENDRIL, TA_WALL, TA_WHIRL, TA_PULSE, TA_RAIN, TA_SPORE}};
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
    boss.aux[AUX_TIDE_CLOCK] += FRAME_TIME_MS / 1000.0f;
    float w = TWO_PI / 9.0f * boss.aux[AUX_TIDE_CLOCK];
    boss.x = boss.home_x + 22 * sinf(w);
    boss.y = boss.home_y + 26 * sinf(2 * w);
    boss.aux[AUX_TIDE_EXPOSED] = bs_bubbles() ? 0.0f : 1.0f;
    for (unsigned i = 0; i < 3; i++) {
        BossPart& p = boss.parts[i];
        float a = boss.aux[AUX_TIDE_CLOCK] * 1.3f + i * TWO_PI / 3;
        p.x = boss.x + cosf(a) * 108;
        p.y = boss.y - 17 + sinf(a) * 40;
    }
    if (boss.phase && !bs_bubbles()) {
        if (!boss.stamp[STAMP_TIDE_BARE_SINCE]) boss.stamp[STAMP_TIDE_BARE_SINCE] = game_ms;
        else if (!boss.stamp[STAMP_TIDE_REFORMED] && bs_since(boss.stamp[STAMP_TIDE_BARE_SINCE]) >= 3000) {
            for (unsigned i = 0; i < 3; i++) { boss.parts[i].exists = true; boss.parts[i].hp = 2; }
            boss.stamp[STAMP_TIDE_REFORMED] = 1; // bubbles reform once
            boss.stamp[STAMP_TIDE_BARE_SINCE] = 0;
        }
    }
}
static void bs_sine_column(float mx, float my, float ang, float phase, float speed = 1.8f, float amp = 24) {
    BossShot *s = bs_shot_at(SF_SINE, mx, my, ang, speed);
    if (s) { s->amp = amp; s->phase = phase; }
}
// A repeatable pseudo-random 0..1 for column k of a stream, from the stream's own seed.
static float bs_tide_noise(unsigned k, unsigned salt) {
    unsigned h = (unsigned)boss.scratch[SCR_TIDE_SEED] * 2654435761u + k * 40503u + salt * 9973u;
    h ^= h >> 15; h *= 2246822519u; h ^= h >> 13;
    return (h % 1000) / 1000.0f;
}
static bool bs_tide_run(int id, unsigned long t) {
    switch (id) {
    case TA_SINE: case MA_SINE6: {
        bool mini = id == MA_SINE6;
        if (!mini && bs_at(t, 0)) {
            boss.scratch[SCR_TIDE_MUZZLE] = bs_rand(-62, 62);
            boss.scratch[SCR_TIDE_TILT] = bs_rand(-.16f, .16f);
            boss.scratch[SCR_TIDE_SEED] = float(1 + rock_random_bounded(60000));
        }
        float mx = boss.x - (mini ? 50 : 78), my = boss.y + (mini ? 10 : 4 + boss.scratch[SCR_TIDE_MUZZLE]);
        float ang = bs_angle_to(mx, my, boss.target_x, boss.target_y) + (mini ? 0.0f : boss.scratch[SCR_TIDE_TILT]);
        unsigned n = mini ? 6 : bs_density(boss.phase >= 2 ? 16 : 13);
        unsigned long gap = mini ? 140 : 88;
        if (bs_at(t, 0)) bs_hazard(HK_ARC, mx, my, ang, mini ? .12f : .3f, 260, 600, 0);
        unsigned long at = 600;
        for (unsigned k = 0; k < n; k++) {
            if (bs_at(t, at)) {
                if (mini) bs_sine_column(mx, my, ang, 0);
                else {
                    // Each column leaves from a slightly different height, speed and bearing.
                    float cy = my + (bs_tide_noise(k, 1) - .5f) * 40, ca = ang + (bs_tide_noise(k, 2) - .5f) * .22f;
                    float speed = 1.6f + bs_tide_noise(k, 3) * .6f, amp = 18 + bs_tide_noise(k, 4) * 14;
                    bs_sine_column(mx, cy, ca, 0, speed, amp);
                    if (boss.phase >= 2) bs_sine_column(mx, cy, ca, BOSS_PI, speed, amp);
                }
            }
            at += mini ? gap : gap - 20 + (unsigned long)(bs_tide_noise(k, 5) * 50);
        }
        return t >= at + 100;
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
    case TA_WALL: {
        // A wall of pellets across the whole field with one gap. Two lines mark each gap 700 ms
        // before its wall leaves; every gap is somewhere new.
        unsigned walls = boss.phase >= 3 ? 3 : 2;
        for (unsigned w = 0; w < walls; w++) {
            unsigned long t0 = w * 1100;
            float& gapy = boss.scratch[SCR_TIDE_GAP + w];
            if (bs_at(t, t0)) {
                gapy = bs_rand(64, 206);
                bs_hazard(HK_AIM, boss.x - 100, gapy - 34, BOSS_PI, 330, 0, 700, 0);
                bs_hazard(HK_AIM, boss.x - 100, gapy + 34, BOSS_PI, 330, 0, 700, 0);
            }
            if (bs_at(t, t0 + 700)) {
                unsigned n = bs_density(17);
                for (unsigned i = 0; i < n; i++) {
                    float y = 12 + i * (246.0f / (n - 1));
                    if (fabsf(y - gapy) < 34) continue;
                    bs_shot_at(SF_PELLET, boss.x - 100, y, BOSS_PI, 1.45f);
                }
            }
        }
        return t >= walls * 1100 + 800;
    }
    case TA_RAIN: {
        // Spores fall from the top at random columns and burst into needles; they can be shot early.
        unsigned n = bs_density(boss.phase >= 3 ? 7 : 5);
        for (unsigned k = 0; k < n; k++)
            if (bs_at(t, 300 + k * 380))
                bs_shot(SF_SPORE, bs_rand(70, 330), -6, bs_rand(-.1f, .1f), 1.15f, 1, 2300);
        return t >= 300 + n * 380 + 600;
    }
    case TA_WHIRL: {
        // Two whirlpools open anywhere but on the pilot: closing rings with a turning gap.
        for (unsigned k = 0; k < 2; k++)
            if (bs_at(t, k * 500)) {
                float rx = 200, ry = 135;
                for (unsigned tries = 0; tries < 30; tries++) {
                    rx = bs_rand(110, 330);
                    ry = bs_rand(60, 210);
                    bool ok = true;
                    for (unsigned p = 0; p < boss_hull_n; p++)
                        if (bs_alive(p) && bs_dist(rx, ry, boss_hulls[p]->position_x, boss_hulls[p]->position_y) < 105) ok = false;
                    for (const BossHazard& h : boss.hz)
                        if (h.active && h.kind == HK_RING && bs_dist(rx, ry, h.x, h.y) < 110) ok = false;
                    if (ok) break;
                }
                BossHazard *h = bs_hazard(HK_RING, rx, ry, bs_rand(-3.0f, 3.0f), 76, .62f, 1100, 3400);
                if (h) { h->d = -.22f; h->e = k ? -.015f : .015f; }
                bs_hazard(HK_TELL, rx, ry, 0, 86, 0, 1100, 0);
            }
        return t >= 500 + 1100 + 3400 + 100;
    }
    }
    return true;
}

static int bs_tide_pick() { return bs_seq_pick(SEQ_TIDE, 3); }
static int bs_moonjelly_pick() { return MA_SINE6; }
static void bs_moonjelly_update() {
    boss.aux[AUX_JELLY_CLOCK] += FRAME_TIME_MS / 1000.0f;
    float w = TWO_PI / 8.0f * boss.aux[AUX_JELLY_CLOCK];
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
static const BossOps OPS_TIDECALLER = {356, 142, 5, 3, {70, 35}, {800, 700, 520},
    bs_tide_begin, bs_tide_update, bs_tide_pick, bs_tide_run, bs_tide_circles,
    bs_tide_body, nullptr, bs_tide_soak, bs_tide_hit};
static const BossOps OPS_MOONJELLY = {380, 140, 8, 1, {0, 0}, {1300, 1300, 1300},
    nullptr, bs_moonjelly_update, bs_moonjelly_pick, bs_tide_run, bs_moonjelly_circles,
    bs_moonjelly_body, nullptr, nullptr, nullptr};
