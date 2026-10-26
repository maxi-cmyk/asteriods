#pragma once

// The twelve fights. Each kind supplies: a begin hook (home position, parts),
// a passive update (motion, parts), an attack picker and runner, hit circles
// for player shots, and contact circles for the ship. Coordinates are in
// playfield pixels; see nextSteps.md for the design of every attack.

// ---------------------------------------------------------------- phases
static unsigned bs_phases() {
    static const uint8_t count[BK_COUNT] = {2, 3, 3, 2, 3, 3, 1, 1, 1, 1, 1, 1};
    return count[boss.kind];
}
static unsigned bs_phase_for(unsigned health) {
    static const uint8_t cut[BK_COUNT][2] = {{60, 0}, {66, 33}, {66, 33}, {50, 0},
                                             {70, 35}, {70, 35}, {0, 0}, {0, 0},
                                             {0, 0}, {0, 0}, {0, 0}, {0, 0}};
    unsigned phase = 1;
    for (uint8_t c : cut[boss.kind])
        if (c && health * 100 <= c * boss.maximum) phase++;
    if (boss.tier >= 2 && !boss.mini && health * 100 <= 15 * boss.maximum) phase = bs_phases() + 1;
    return phase;
}
// Health at which a phase begins (for practice starting mid-fight).
static unsigned bs_phase_health(unsigned phase) {
    static const uint8_t cut[BK_COUNT][2] = {{60, 0}, {66, 33}, {66, 33}, {50, 0}, {70, 35}, {70, 35},
                                             {0, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}};
    unsigned pct = 100;
    if (phase > bs_phases()) pct = 15;
    else if (phase >= 2) pct = cut[boss.kind][phase - 2];
    unsigned health = boss.maximum * pct / 100;
    return health ? health : 1;
}
static unsigned bs_density(unsigned n) {
    return boss.tier >= 2 ? (n * 5 + 3) / 4 : n;
}
static bool bs_frenzy() { return boss.phase > bs_phases(); }

// ---------------------------------------------------------------- shared helpers
static float bs_angle_to(float x, float y, float tx, float ty) { return bs_atan2(ty - y, tx - x); }
static void bs_guard_body(float *out, unsigned& n, float x, float y, float r) {
    out[n * 3] = x; out[n * 3 + 1] = y; out[n * 3 + 2] = r; n++;
}
static void bs_particles(float x, float y) { particles_spawn(x, y); }

// ================================================================ SENTINEL / PICKET
static const BossRow SEQ_SENTINEL[] = {{2, SA_LANCE, SA_FAN}, {4, SA_LANCE, SA_FAN, SA_VOLLEY, SA_CROSS}};
static const BossRow SEQ_PICKET[] = {{1, SA_LANCE}};

static void bs_gate_update() {
    float want = boss.atk ? 0.0f : 1.0f;
    boss.aux[0] += bs_clamp(want - boss.aux[0], -.08f, .08f);
    boss.aux[1] = boss.atk ? 1.0f : 0.0f;
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

// ================================================================ RINGWARDEN / SHARDLING
static const BossRow SEQ_RING[] = {{2, RA_BURST, RA_BURST},
                                   {4, RA_BURST, RA_PRISM, RA_PICK, RA_PRISM},
                                   {4, RA_COLLAPSE, RA_BURST, RA_PRISM, RA_PICK}};
static void bs_ring_pos(unsigned i, float& x, float& y) {
    bool outer = i < 16;
    unsigned count = outer ? 16 : 11, slot = outer ? i : i - 16;
    float spin = outer ? boss.aux[1] : boss.aux[2];
    float radius = (outer ? 106.0f : 70.0f) * boss.aux[0];
    float a = slot * TWO_PI / count + spin;
    x = boss.x + cosf(a) * radius;
    y = boss.y + sinf(a) * radius;
}
static void bs_ring_update() {
    float t = bs_since(boss.born) / 1000.0f;
    boss.y = boss.home_y + 40 * sinf(TWO_PI * t / 8.0f);
    boss.aux[1] += .0042f;
    boss.aux[2] -= .0075f;
    if (boss.atk != RA_COLLAPSE) boss.aux[0] = 1 + .02f * sinf(t * 2);
    boss.aux[3] = boss.atk == RA_BURST || boss.atk == RA_PRISM ? 1.0f : 0.0f;
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
    boss.aux[0] = 1;
    boss.aux[2] = .28f;
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
        if (t < 1200) boss.aux[0] = 1 - .8f * (t / 1200.0f);
        if (bs_at(t, 1200)) {
            boss.aux[0] = 1;
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

// ================================================================ CINDERFORGE / CINDERLING
static const BossRow SEQ_FORGE[] = {{2, CA_LOB, CA_LOB},
                                    {4, CA_LOB, CA_JETS, CA_EMBER, CA_JETS},
                                    {4, CA_NOVA, CA_LOB, CA_JETS, CA_EMBER}};
static const BossRow SEQ_CINDERLING[] = {{1, CA_LOB}};
static float bs_panel_angle(unsigned i) { return BOSS_PI + (i - 3.5f) * .32f; }
static void bs_forge_begin() {
    for (unsigned i = 0; i < 8; i++) {
        BossPart& p = boss.parts[i];
        p = {};
        p.exists = true; p.kind = PK_PANEL; p.slot = i; p.hp = p.hp_max = 3; p.r = 16;
    }
    boss.aux[0] = .5f;
}
static unsigned bs_broken_panels() {
    unsigned n = 0;
    for (unsigned i = 0; i < 8; i++) n += boss.parts[i].state == 2;
    return n;
}
static void bs_forge_update() {
    boss.aux[0] = .45f + .12f * (boss.phase > 1) + .12f * (boss.phase > 2) + .04f * sinf(bs_since(boss.born) / 300.0f);
    boss.aux[1] = game_ms < boss.stamp[0] ? 1.0f : 0.0f;
    for (unsigned i = 0; i < 8; i++) {
        BossPart& p = boss.parts[i];
        float a = bs_panel_angle(i);
        p.x = boss.x + cosf(a) * 108;
        p.y = boss.y + sinf(a) * 108;
        if (p.state == 1 && game_ms >= p.until) p.state = 0;
    }
}
static void bs_lob(float tx, float ty, float sx, float sy) {
    tx = bs_clamp(tx, 36, 330);
    ty = bs_clamp(ty, 36, 240);
    BossShot *s = bs_shot(SF_LOB, sx, sy, (tx - sx) / 60, (ty - sy) / 60, 1, 1200);
    BossHazard *h = bs_hazard(HK_POOL, tx, ty, 0, 0, 22, 1200, 4000);
    if (s && h) s->link = bs_hazard_index(h);
    else if (s && !h) s->active = false;
    else if (h && !s) h->active = false;
}
static bool bs_forge_run(int id, unsigned long t) {
    float mx = boss.x - 100, my = boss.y;
    switch (id) {
    case CA_LOB: {
        unsigned n = boss.mini ? 1 : (boss.phase == 1 ? 1 : 2);
        for (unsigned k = 0; k < n; k++)
            if (bs_at(t, k * 500)) {
                float px = boss.target_x, py = boss.target_y;
                if (k) bs_nearest(mx, my, px, py);
                bs_lob(px, py, mx, my - 30 + k * 36);
                if (boss.mini) boss.stamp[0] = game_ms + 2300;
            }
        return t >= (n - 1) * 500 + 1300;
    }
    case CA_JETS:
        if (bs_at(t, 0)) {
            int picks[5];
            unsigned n = 0, want = 3 + bs_broken_panels();
            if (want > 4) want = 4;
            for (unsigned i = 0; i < 8 && n < want; i++)  // broken panels fire first
                if (boss.parts[i].state == 2) picks[n++] = i;
            for (unsigned tries = 0; tries < 40 && n < want; tries++) {
                int c = rock_random_bounded(8);
                bool ok = boss.parts[c].state != 2;
                for (unsigned j = 0; j < n; j++) if (abs(picks[j] - c) < 2) ok = false;
                if (ok) picks[n++] = c;
            }
            for (unsigned j = 0; j < n; j++) {
                BossPart& p = boss.parts[picks[j]];
                if (p.state == 0) { p.state = 1; p.until = game_ms + 2900; }
                float a = bs_panel_angle(picks[j]);
                bs_hazard(HK_LANE, p.x, p.y, a, 420, 14, 900, 500);
            }
        }
        return t >= 1500;
    case CA_EMBER: {
        float ang = bs_angle_to(mx, my, boss.target_x, boss.target_y);
        unsigned n = bs_density(7);
        if (bs_at(t, 0)) bs_hazard(HK_ARC, mx, my, ang, .6f, 190, 600, 0);
        if (bs_at(t, 600))
            for (unsigned i = 0; i < n; i++)
                bs_shot_at(SF_EMBER, mx, my, ang + (i - (n - 1) / 2.0f) * .2f, 2.4f);
        return t >= 700;
    }
    case CA_NOVA:
        if (bs_at(t, 0)) {
            float gap = bs_angle_to(boss.x, boss.y, boss.target_x, boss.target_y) + (boss.cycle % 2 ? .9f : -.9f);
            BossHazard *h = bs_hazard(HK_RING, boss.x, boss.y, gap, 120, .52f, 1000, 4200);
            if (h) { h->d = 2.0f; h->e = 0; }
            bs_hazard(HK_TELL, boss.x, boss.y, 0, 132, 0, 1000, 0);
        }
        if (bs_at(t, 1000)) {
            for (unsigned i = 0; i < 8; i += 2) {
                BossPart& p = boss.parts[i];
                if (p.state != 2) { p.state = 2; bs_particles(p.x, p.y); }
            }
            boss.stamp[0] = game_ms + 2000;
            display_shake(2);
        }
        return t >= 1100;
    }
    return true;
}

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
    if (any) boss.stamp[3] = 0;
    else if (!boss.stamp[3]) boss.stamp[3] = game_ms;
    else if (!boss.stamp[2] && bs_since(boss.stamp[3]) >= 8000) {
        bs_bastion_revive(6);
        boss.stamp[2] = 1;
        boss.stamp[3] = 0;
    }
    boss.aux[0] = boss.atk == BA_CANNON || boss.atk == BA_BROAD ? 1.0f : 0.0f;
    boss.aux[1] = boss.atk == BA_MISSILE || boss.atk == BA_MINES ? 1.0f : 0.0f;
    boss.aux[2] = .6f + .3f * (boss.phase > 1);
    // Bolts wait on their aim lines.
    for (unsigned k = 0; k < 2; k++) {
        float& fire = boss.aux[11 + k * 4];
        if (fire > 0 && game_ms >= (unsigned long)fire) {
            bs_shot_at(SF_BOLT, boss.aux[8 + k * 4], boss.aux[9 + k * 4], boss.aux[10 + k * 4], 3.0f);
            fire = 0;
        }
    }
}
static void bs_bolt(unsigned k, float x, float y, float tx, float ty, unsigned long delay) {
    float ang = bs_angle_to(x, y, tx, ty);
    bs_hazard(HK_AIM, x, y, ang, 520, 0, 500, 0);
    boss.aux[8 + k * 4] = x;
    boss.aux[9 + k * 4] = y;
    boss.aux[10 + k * 4] = ang;
    boss.aux[11 + k * 4] = float(game_ms + 500 + delay);
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

// ================================================================ SHARDLING
static void bs_shardling_update() {
    boss.aux[2] += .02f;
    float want = boss.aux[4] > 0 ? boss.aux[4] : boss.home_x;
    boss.x += bs_clamp(want - boss.x, -1.1f, 1.1f);
    boss.y += bs_clamp(bs_clamp(boss.target_y, 70, 205) - boss.y, -.8f, .8f);
}
static bool bs_shardling_run(int id, unsigned long t) {
    (void)id;
    float ang = bs_angle_to(boss.x, boss.y, boss.target_x, boss.target_y);
    float mx = boss.x + cosf(ang) * 62, my = boss.y + sinf(ang) * 62;
    if (bs_at(t, 0)) {
        bs_hazard(HK_AIM, mx, my, ang, 480, 0, 500, 0);
        boss.aux[4] = 300; // kite in
    }
    for (int k = 0; k < 3; k++)
        if (bs_at(t, 500 + k * 150)) bs_shot_at(SF_FAST, mx, my, ang, 2.6f);
    if (bs_at(t, 1100)) boss.aux[4] = boss.home_x;
    return t >= 1200;
}

// ================================================================ dispatch
static void bs_kind_begin() {
    static const float home[BK_COUNT][2] = {{366, 135}, {352, 135}, {340, 135}, {324, 138}, {356, 142},
                                            {338, 135}, {380, 135}, {370, 135}, {380, 135}, {372, 135},
                                            {380, 140}, {380, 135}};
    boss.home_x = home[boss.kind][0];
    boss.home_y = home[boss.kind][1];
    boss.aux[4] = 0;
    switch (boss.kind) {
    case BK_RINGWARDEN: bs_ring_spawn_parts(); break;
    case BK_CINDERFORGE: bs_forge_begin(); break;
    case BK_BASTION: bs_bastion_begin(); break;
    case BK_TIDECALLER: bs_tide_begin(); break;
    case BK_WARDEN: bs_warden_begin(); break;
    default: break;
    }
}
static void bs_kind_update() {
    switch (boss.kind) {
    case BK_SENTINEL: case BK_PICKET: bs_gate_update(); break;
    case BK_RINGWARDEN: bs_ring_update(); break;
    case BK_CINDERFORGE: bs_forge_update(); break;
    case BK_BASTION: bs_bastion_update(); break;
    case BK_TIDECALLER: bs_tide_update(); break;
    case BK_WARDEN: bs_warden_update(); break;
    case BK_SHARDLING: bs_shardling_update(); break;
    case BK_CINDERLING:
        boss.aux[0] = .5f + .1f * sinf(bs_since(boss.born) / 260.0f);
        boss.aux[1] = game_ms < boss.stamp[0] ? 1.0f : 0.0f;
        break;
    case BK_GUNNERY:
        boss.y = boss.home_y + 20 * sinf(TWO_PI * bs_since(boss.born) / 6000.0f);
        for (unsigned k = 0; k < 2; k++) {
            float& fire = boss.aux[11 + k * 4];
            if (fire > 0 && game_ms >= (unsigned long)fire) {
                bs_shot_at(SF_BOLT, boss.aux[8 + k * 4], boss.aux[9 + k * 4], boss.aux[10 + k * 4], 3.0f);
                fire = 0;
            }
        }
        boss.aux[0] = boss.atk == MA_BOLTS ? 1.0f : 0.0f;
        break;
    case BK_MOONJELLY: {
        boss.aux[0] += FRAME_TIME_MS / 1000.0f;
        float w = TWO_PI / 8.0f * boss.aux[0];
        boss.x = boss.home_x + 16 * sinf(w);
        boss.y = boss.home_y + 24 * sinf(2 * w);
        break;
    }
    case BK_LENSIMP: bs_lens_update(); break;
    default: break;
    }
}
static int bs_kind_pick() {
    switch (boss.kind) {
    case BK_SENTINEL: return bs_seq_pick(SEQ_SENTINEL, 2);
    case BK_PICKET: return bs_seq_pick(SEQ_PICKET, 1);
    case BK_RINGWARDEN: return bs_seq_pick(SEQ_RING, 3);
    case BK_CINDERFORGE: return bs_seq_pick(SEQ_FORGE, 3);
    case BK_BASTION: return bs_bastion_pick();
    case BK_TIDECALLER: return bs_seq_pick(SEQ_TIDE, 3);
    case BK_WARDEN: {
        int id = bs_seq_pick(SEQ_WARDEN, 3);
        if (id == WA_PULL && (boss.stamp[4] || boss_assist_calm)) id = WA_CURVE;
        return id;
    }
    case BK_SHARDLING: return MA_SHARDS;
    case BK_CINDERLING: {
        for (const BossHazard& h : boss.hz) if (h.active && h.kind == HK_POOL) return 0;
        for (const BossShot& s : boss.shots) if (s.active && s.family == SF_LOB) return 0;
        return CA_LOB;
    }
    case BK_GUNNERY: return bs_seq_pick(SEQ_GUNNERY, 1);
    case BK_MOONJELLY: return MA_SINE6;
    case BK_LENSIMP: return bs_seq_pick(SEQ_LENS, 1);
    }
    return 0;
}
static bool bs_kind_run(int id, unsigned long t) {
    switch (boss.kind) {
    case BK_SENTINEL: case BK_PICKET: return bs_sentinel_run(id, t);
    case BK_RINGWARDEN: return bs_ring_run(id, t);
    case BK_CINDERFORGE: case BK_CINDERLING: return bs_forge_run(id, t);
    case BK_BASTION: case BK_GUNNERY: return bs_bastion_run(id, t);
    case BK_TIDECALLER: case BK_MOONJELLY: return bs_tide_run(id, t);
    case BK_WARDEN: return bs_warden_run(id, t);
    case BK_SHARDLING: return bs_shardling_run(id, t);
    case BK_LENSIMP: return bs_lens_run(id, t);
    }
    return true;
}
static unsigned long bs_kind_rest() {
    static const unsigned base[BK_COUNT][3] = {
        {950, 800, 800}, {1200, 1100, 1000}, {1200, 1000, 900}, {1300, 1000, 1000},
        {1100, 1000, 800}, {1400, 1200, 1000}, {1100, 1100, 1100}, {1000, 1000, 1000},
        {900, 900, 900}, {1100, 1100, 1100}, {1300, 1300, 1300}, {1000, 1000, 1000}};
    unsigned idx = (boss.phase < 3 ? boss.phase : 3) - 1;
    return base[boss.kind][idx];
}

static bool bs_open_gate() { return boss.aux[0] > .5f; }
static bool bs_blinking() { return boss.kind == BK_LENSIMP && boss.stamp[3] && game_ms < boss.stamp[3]; }
static void bs_kind_circles() {
    float x = boss.x, y = boss.y;
    switch (boss.kind) {
    case BK_SENTINEL:
        if (bs_open_gate()) bs_circle(x, y, 33, BC_CORE, 0, 3);
        else bs_circle(x, y, 72, BC_BLOCK, 0, 1);
        break;
    case BK_PICKET:
        if (bs_open_gate()) bs_circle(x, y, 18, BC_CORE, 0, 3);
        else bs_circle(x, y, 40, BC_BLOCK, 0, 1);
        break;
    case BK_RINGWARDEN:
        for (unsigned i = 0; i < 27; i++)
            if (boss.parts[i].exists) bs_circle(boss.parts[i].x, boss.parts[i].y, boss.parts[i].r, BC_PART, i, 3);
        bs_circle(x, y, 26, BC_CORE, 0, 3);
        break;
    case BK_CINDERFORGE: {
        bool open_all = game_ms < boss.stamp[0];
        if (open_all) bs_circle(x, y, 34, BC_CORE, 0, 3);
        else {
            for (unsigned i = 0; i < 8; i++) bs_circle(boss.parts[i].x, boss.parts[i].y, 16, BC_PART, i, 1);
            bs_circle(x, y, 114, BC_BLOCK, 0, 1);
            bs_circle(x, y, 34, BC_CORE, 0, 2); // the laser pierces the shell
        }
        break;
    }
    case BK_BASTION:
        for (unsigned i = 0; i < 3; i++)
            if (boss.parts[i].exists) bs_circle(boss.parts[i].x, boss.parts[i].y, boss.parts[i].r, BC_PART, i, 3);
        bs_circle(x + 114, y + 2, 17, BC_CORE, 0, 3);
        break;
    case BK_TIDECALLER: {
        for (unsigned i = 0; i < 3; i++)
            if (boss.parts[i].exists) bs_circle(boss.parts[i].x, boss.parts[i].y, 14, BC_PART, i, 3);
        if (bs_bubbles()) {
            bs_circle(x, y - 37, 72, BC_BLOCK, 0, 1);
            bs_circle(x, y - 37, 72, BC_CORE, 0, 2);
        } else bs_circle(x, y - 37, 72, BC_CORE, 0, 3);
        break;
    }
    case BK_WARDEN: {
        for (unsigned i = 0; i < 4; i++)
            if (boss.parts[i].exists) bs_circle(boss.parts[i].x, boss.parts[i].y, 9, BC_PART, i, 3);
        bool open = boss.aux[1] > .5f || !bs_stars();
        if (open) bs_circle(x, y, 46, BC_CORE, 0, 3);
        else {
            bs_circle(x, y, 100, BC_BLOCK, 0, 1);
            bs_circle(x, y, 46, BC_CORE, 0, 2);
        }
        break;
    }
    case BK_SHARDLING:
        for (unsigned k = 0; k < 3; k++) {
            float a = boss.aux[2] + k * TWO_PI / 3;
            bs_circle(x + cosf(a) * 46, y + sinf(a) * 46, 11, BC_BLOCK, 0, 1);
        }
        bs_circle(x, y, 22, BC_CORE, 0, 3);
        break;
    case BK_CINDERLING:
        if (boss.aux[1] > .5f) bs_circle(x, y, 24, BC_CORE, 0, 3);
        else {
            bs_circle(x, y, 50, BC_BLOCK, 0, 1);
            bs_circle(x, y, 24, BC_CORE, 0, 2);
        }
        break;
    case BK_GUNNERY: bs_circle(x + 68, y, 15, BC_CORE, 0, 3); break;
    case BK_MOONJELLY: bs_circle(x, y - 25, 44, BC_CORE, 0, 3); break;
    case BK_LENSIMP:
        if (!bs_blinking()) bs_circle(x, y, 30, BC_CORE, 0, 3);
        break;
    }
}
static unsigned bs_kind_body(float *out) {
    unsigned n = 0;
    float x = boss.x, y = boss.y;
    switch (boss.kind) {
    case BK_SENTINEL: bs_guard_body(out, n, x, y, 72); break;
    case BK_PICKET: bs_guard_body(out, n, x, y, 40); break;
    case BK_RINGWARDEN:
        bs_guard_body(out, n, x, y, 28);
        for (unsigned i = 0; i < 27 && n < 32; i++)
            if (boss.parts[i].exists) bs_guard_body(out, n, boss.parts[i].x, boss.parts[i].y, boss.parts[i].r - 2);
        break;
    case BK_CINDERFORGE: bs_guard_body(out, n, x, y, 116); break;
    case BK_BASTION:
        bs_guard_body(out, n, x - 64, y, 24); bs_guard_body(out, n, x - 24, y, 40);
        bs_guard_body(out, n, x + 26, y, 60); bs_guard_body(out, n, x + 86, y, 70);
        break;
    case BK_TIDECALLER: bs_guard_body(out, n, x, y - 37, 74); break;
    case BK_WARDEN:
        bs_guard_body(out, n, x, y, 108);
        for (unsigned i = 0; i < 4; i++)
            if (boss.parts[i].exists) bs_guard_body(out, n, boss.parts[i].x, boss.parts[i].y, 7);
        break;
    case BK_SHARDLING:
        bs_guard_body(out, n, x, y, 24);
        for (unsigned k = 0; k < 3; k++) {
            float a = boss.aux[2] + k * TWO_PI / 3;
            bs_guard_body(out, n, x + cosf(a) * 46, y + sinf(a) * 46, 11);
        }
        break;
    case BK_CINDERLING: bs_guard_body(out, n, x, y, 50); break;
    case BK_GUNNERY:
        bs_guard_body(out, n, x - 70, y, 12); bs_guard_body(out, n, x - 30, y, 30);
        bs_guard_body(out, n, x + 20, y, 40); bs_guard_body(out, n, x + 70, y, 44);
        break;
    case BK_MOONJELLY: bs_guard_body(out, n, x, y - 25, 46); break;
    case BK_LENSIMP:
        if (!bs_blinking()) bs_guard_body(out, n, x, y, 30);
        break;
    }
    return n;
}
static void bs_kind_phase(unsigned phase) {
    if (boss.kind == BK_BASTION && phase >= 2) {
        bs_bastion_revive(7);
        boss.stamp[3] = 0;
    }
    if (phase >= 2) bs_pickups();
}
// A player shot or the laser touched a sub-target.
static void bs_kind_hit(const BossCircle& c, unsigned owner, unsigned damage, bool laser) {
    BossPart& p = boss.parts[c.index];
    if (!p.exists) return;
    switch (boss.kind) {
    case BK_RINGWARDEN: bs_ring_break(p, 6000); break;
    case BK_CINDERFORGE:
        if (laser) return;
        if (p.state == 0) {
            p.hp -= damage;
            if (p.hp <= 0) { p.state = 2; bs_particles(p.x, p.y); display_shake(1); }
        } else bs_core_damage(owner, 1, false);
        break;
    case BK_BASTION:
        p.hp = damage >= (unsigned)p.hp ? 0 : p.hp - damage;
        if (p.hp <= 0) { p.exists = false; bs_particles(p.x, p.y); display_shake(1); sound_play(SFX_ASTEROID_SMALL); }
        break;
    case BK_TIDECALLER:
        if (laser) {
            for (unsigned i = 0; i < 3; i++) if (boss.parts[i].exists) { boss.parts[i].exists = false; bs_particles(boss.parts[i].x, boss.parts[i].y); }
        } else {
            p.hp = damage >= (unsigned)p.hp ? 0 : p.hp - damage;
            if (p.hp <= 0) { p.exists = false; bs_particles(p.x, p.y); }
        }
        break;
    case BK_WARDEN:
        p.hp = damage >= (unsigned)p.hp ? 0 : p.hp - damage;
        if (p.hp <= 0) { p.exists = false; p.state = 0; bs_particles(p.x, p.y); display_shake(1); }
        break;
    default: break;
    }
}
