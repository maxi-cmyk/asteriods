#pragma once
// Bastion and Gunnery

// Slots of boss.aux and boss.stamp.
enum { AUX_BASTION_CANNON = 0,    // 1 while the nose cannon or broadside fires
       AUX_BASTION_PODS = 1,      // 1 while the missile pods or mine bay is open
       AUX_BASTION_ARMOUR = 2 };  // hull plating shown in the scene
enum { AUX_GUNNERY_FIRING = 0 };  // 1 while the bolts attack runs
// Queued bolts (Bastion's MA_BOLTS echo and Gunnery): four floats per gun from AUX_BOLTS.
enum { AUX_BOLTS = 8, BOLT_STRIDE = 4, BOLT_X = 0, BOLT_Y = 1, BOLT_ANGLE = 2, BOLT_FIRE_AT = 3 };
enum { STAMP_BASTION_REVIVED = 2,           // the guns came back once already
       STAMP_BASTION_GUNLESS_SINCE = 3 };   // when the last gun fell (0 = a gun stands)

// ================================================================ BASTION / GUNNERY
static const BossRow SEQ_BASTION[] = {{4, BA_CANNON, BA_MISSILE, BA_CANNON, BA_MINES},
                                      {4, BA_CANNON, BA_MISSILE, BA_BROAD, BA_MINES}};
static const BossRow SEQ_GUNNERY[] = {{2, MA_BOLTS, BA_MISSILE}};
static void bs_bastion_xy(unsigned i, float& x, float& y) {
    static const float off[3][2] = {{8, -56}, {-28, 58}, {50, 56}};
    x = boss.x + off[i][0];
    y = boss.y + off[i][1];
}
static void bs_bastion_begin() {
    static const float r[3] = {34, 28, 24};
    for (unsigned i = 0; i < 3; i++) {
        BossPart& p = boss.parts[i];
        p = {};
        p.exists = true; p.kind = PK_HARD; p.slot = i; p.hp = p.hp_max = 6; p.r = r[i];
    }
}
static void bs_bastion_revive(int hp) {
    for (unsigned i = 0; i < 3; i++) {
        BossPart& p = boss.parts[i];
        p.exists = true; p.hp = p.hp_max = hp;
    }
}
static void bs_bastion_update() {
    for (unsigned i = 0; i < 3; i++) bs_bastion_xy(i, boss.parts[i].x, boss.parts[i].y);
    bool any = false;
    for (unsigned i = 0; i < 3; i++) any |= boss.parts[i].exists;
    if (any) boss.stamp[STAMP_BASTION_GUNLESS_SINCE] = 0;
    else if (!boss.stamp[STAMP_BASTION_GUNLESS_SINCE]) boss.stamp[STAMP_BASTION_GUNLESS_SINCE] = game_ms;
    else if (!boss.stamp[STAMP_BASTION_REVIVED] && bs_since(boss.stamp[STAMP_BASTION_GUNLESS_SINCE]) >= 8000) {
        bs_bastion_revive(6);
        boss.stamp[STAMP_BASTION_REVIVED] = 1;
        boss.stamp[STAMP_BASTION_GUNLESS_SINCE] = 0;
    }
    boss.aux[AUX_BASTION_CANNON] = boss.atk == BA_CANNON || boss.atk == BA_BROAD ? 1.0f : 0.0f;
    boss.aux[AUX_BASTION_PODS] = boss.atk == BA_MISSILE || boss.atk == BA_MINES ? 1.0f : 0.0f;
    boss.aux[AUX_BASTION_ARMOUR] = .6f + .3f * (boss.phase > 1);
    // Bolts wait on their aim lines.
    for (unsigned k = 0; k < 2; k++) {
        float& fire = boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_FIRE_AT];
        if (fire > 0 && game_ms >= (unsigned long)fire) {
            bs_shot_at(SF_BOLT, boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_X], boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_Y], boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_ANGLE], 3.0f);
            fire = 0;
        }
    }
}
static void bs_bolt(unsigned k, float x, float y, float tx, float ty, unsigned long delay) {
    float ang = bs_angle_to(x, y, tx, ty);
    bs_hazard(HK_AIM, x, y, ang, 520, 0, 500, 0);
    boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_X] = x;
    boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_Y] = y;
    boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_ANGLE] = ang;
    boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_FIRE_AT] = float(game_ms + 500 + delay);
}
static int bs_bastion_pick() {
    const BossRow *rows = SEQ_BASTION;
    unsigned idx = boss.phase >= 2 ? 1 : 0;
    const uint8_t *row = rows[idx];
    for (unsigned k = 0; k < row[0]; k++) {
        int id = row[1 + (boss.seq + k) % row[0]];
        bool ok = id == BA_BROAD
                  || (id == BA_CANNON && boss.parts[0].exists)
                  || (id == BA_MISSILE && boss.parts[1].exists)
                  || (id == BA_MINES && boss.parts[2].exists);
        if (ok) { boss.seq += k; return id; }
    }
    return 0;
}
static bool bs_bastion_run(int id, unsigned long t) {
    switch (id) {
    case BA_CANNON: {
        unsigned n = boss.phase == 1 ? 1 : 2;
        for (unsigned k = 0; k < n; k++)
            if (bs_at(t, k * 400)) {
                float tx = boss.target_x, ty = boss.target_y;
                if (k) bs_nearest(boss.x, boss.y, tx, ty);
                static const float turret[3][2] = {{-40, -44}, {8, -58}, {56, -71}};
                unsigned which = (boss.seq + k) % 3;
                bs_bolt(k, boss.x + turret[which][0] - 28, boss.y + turret[which][1], tx, ty, 0);
            }
        return t >= (n - 1) * 400 + 700;
    }
    case BA_MISSILE: {
        unsigned n = boss.mini ? 1 : (boss.phase == 1 ? 2 : 3);
        float sx = boss.mini ? boss.x - 20 : boss.x - 30, sy = boss.mini ? boss.y + 48 : boss.y + 76;
        for (unsigned k = 0; k < n; k++)
            if (bs_at(t, 600 + k * 600)) {
                float px = boss.target_x, py = boss.target_y;
                bs_nearest(sx, sy, px, py);
                BossShot *s = bs_shot_at(SF_MISSILE, sx, sy, bs_angle_to(sx, sy, px, py), 1.4f, 2, 4000);
                if (s) s->turn = .04f;
            }
        return t >= 600 + n * 600 + 200;
    }
    case BA_MINES: {
        unsigned n = boss.phase == 1 ? 2 : 3;
        for (unsigned k = 0; k < n; k++)
            if (bs_at(t, 400 + k * 700))
                bs_shot(SF_MINE, boss.x + 50, boss.y + 68, -.8f, bs_rand(-.12f, .18f), 1, 2000);
        return t >= 400 + n * 700 + 300;
    }
    case BA_BROAD: {
        if (bs_at(t, 0)) bs_hazard(HK_ARC, boss.x - 40, boss.y, BOSS_PI, BOSS_PI / 2, 220, 800, 0);
        for (unsigned i = 0; i < 10; i++)
            if (bs_at(t, 800 + i * 110)) {
                float xs = 60 + (i / 2) * 40, edge = 84 * (xs - 4) / 254;
                bool top = i % 2 == 0;
                float x = boss.x - 170 + xs, y = boss.y - 98 + (top ? 98 - edge - 8 : 98 + edge + 8);
                float px = boss.target_x, py = boss.target_y;
                bs_nearest(x, y, px, py);
                bs_shot_at(SF_NEEDLE, x, y, bs_angle_to(x, y, px, py), 2.2f);
            }
        return t >= 800 + 10 * 110 + 200;
    }
    case MA_BOLTS: {
        float gx = boss.x - 66;
        if (bs_at(t, 0)) {
            bs_bolt(0, gx, boss.y - 10, boss.target_x, boss.target_y, 0);
            bs_bolt(1, gx, boss.y + 10, boss.target_x, boss.target_y, 0);
        }
        return t >= 700;
    }
    }
    return true;
}

static void bs_gunnery_update() {
    boss.y = boss.home_y + 20 * sinf(TWO_PI * bs_since(boss.born) / 6000.0f);
    for (unsigned k = 0; k < 2; k++) {
        float& fire = boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_FIRE_AT];
        if (fire > 0 && game_ms >= (unsigned long)fire) {
            bs_shot_at(SF_BOLT, boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_X], boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_Y], boss.aux[AUX_BOLTS + k * BOLT_STRIDE + BOLT_ANGLE], 3.0f);
            fire = 0;
        }
    }
    boss.aux[AUX_GUNNERY_FIRING] = boss.atk == MA_BOLTS ? 1.0f : 0.0f;
}
static int bs_gunnery_pick() { return bs_seq_pick(SEQ_GUNNERY, 1); }
static void bs_bastion_circles() {
    for (unsigned i = 0; i < 3; i++)
        if (boss.parts[i].exists)
            bs_circle(boss.parts[i].x, boss.parts[i].y, boss.parts[i].r, BC_PART, i, 3);
    bs_circle(boss.x + 114, boss.y + 2, 17, BC_CORE, 0, 3);
}
static void bs_gunnery_circles() { bs_circle(boss.x + 68, boss.y, 15, BC_CORE, 0, 3); }
static unsigned bs_bastion_body(float *out) {
    unsigned n = 0;
    float x = boss.x, y = boss.y;
    bs_guard_body(out, n, x - 64, y, 24);
    bs_guard_body(out, n, x - 24, y, 40);
    bs_guard_body(out, n, x + 26, y, 60);
    bs_guard_body(out, n, x + 86, y, 70);
    return n;
}
static unsigned bs_gunnery_body(float *out) {
    unsigned n = 0;
    float x = boss.x, y = boss.y;
    bs_guard_body(out, n, x - 70, y, 12);
    bs_guard_body(out, n, x - 30, y, 30);
    bs_guard_body(out, n, x + 20, y, 40);
    bs_guard_body(out, n, x + 70, y, 44);
    return n;
}
// While a gun still stands the hull's armour soaks every second primary hit.
static unsigned bs_bastion_soak(unsigned damage, bool laser) {
    if (laser) return damage;
    bool shielded = false;
    for (unsigned i = 0; i < 3; i++) shielded |= boss.parts[i].exists;
    if (!shielded) return damage;
    boss.armor += damage * .5f;
    damage = 0;
    if (boss.armor >= 1) { damage = 1; boss.armor -= 1; }
    return damage;
}
static void bs_bastion_phase(unsigned phase) {
    if (phase >= 2) {
        bs_bastion_revive(7);
        boss.stamp[STAMP_BASTION_GUNLESS_SINCE] = 0;
    }
}
static void bs_bastion_hit(BossPart& p, unsigned, unsigned damage, bool) {
    p.hp = damage >= (unsigned)p.hp ? 0 : p.hp - damage;
    if (p.hp <= 0) {
        p.exists = false;
        bs_particles(p.x, p.y);
        display_shake(1);
        sound_play(SFX_ASTEROID_SMALL);
    }
}
static const BossOps OPS_BASTION = {324, 138, 5, 2, {50, 0}, {1300, 1000, 1000},
    bs_bastion_begin, bs_bastion_update, bs_bastion_pick, bs_bastion_run, bs_bastion_circles,
    bs_bastion_body, bs_bastion_phase, bs_bastion_soak, bs_bastion_hit};
static const BossOps OPS_GUNNERY = {372, 135, 8, 1, {0, 0}, {1100, 1100, 1100},
    nullptr, bs_gunnery_update, bs_gunnery_pick, bs_bastion_run, bs_gunnery_circles,
    bs_gunnery_body, nullptr, nullptr, nullptr};
