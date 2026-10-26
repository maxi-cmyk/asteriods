#pragma once
// Horizon Warden and Lens Imp

// Slots of boss.aux and boss.stamp.
enum { AUX_WARDEN_CLOCK = 0,      // seconds since the entrance, moves the orbiting stars
       AUX_WARDEN_CORE_OPEN = 1,  // 1 during the periodic window the core can be shot
       AUX_WARDEN_BUSY = 2,       // 1 while an attack runs
       AUX_WARDEN_PASS = 3,       // counts accretion passes
       AUX_WARDEN_CLOAK = 4,      // .25 shimmer (tell), 1 cloaked, .75 decloaking, 0 solid
       AUX_WARDEN_MIRROR = 5 };   // .5 the mirror is forming (tell), 1 it deflects
// (aux 8..15 hold the queued Bastion bolts, see bastion.h)
enum { STAMP_WARDEN_WINDOW = 1,   // start of the next (or current) core window
       STAMP_WARDEN_CLOAK = 3,    // game_ms until which the Warden is cloaked
       STAMP_WARDEN_PULLED = 4 }; // the gravity pull was used; it is not repeated
enum { AUX_LENS_CLOCK = 0, AUX_LENS_BLINK = 1 };     // the mini's clock and blink flag
enum { STAMP_LENS_BLINK_UNTIL = 3 };                 // game_ms until which the imp is gone

// ================================================================ HORIZON WARDEN / LENS IMP
// The last boss fights with the whole gallery. Phase 1 is the Sentinel and Ringwarden's kit,
// phase 2 the Cinderforge and Bastion's, phase 3 its own pull, accretion, nova and cloak. From
// phase 3 on every other attack is drawn from the pool below: every attack of every boss before it.
static const BossRow SEQ_WARDEN[] = {
    {6, SA_LANCE, WA_SPIRAL, RA_PICK, SA_FAN, WA_CURVE, RA_PRISM},
    {7, CA_LOB, BA_CANNON, WX_JETS, BA_MISSILE, CA_EMBER, WX_BURST, BA_MINES},
    {7, TA_SINE, TA_TENDRIL, WX_CLOAK, WA_ACCRETE, TA_SPORE, WX_NOVA, WA_PULL}};
static const uint8_t WARDEN_POOL[] = {
    SA_LANCE, SA_FAN, SA_VOLLEY, SA_CROSS,                   // Sentinel
    RA_PRISM, RA_PICK, WX_BURST,                             // Ringwarden
    CA_LOB, WX_JETS, CA_EMBER, WX_NOVA, CA_HAMMER, CA_GEYSER, CA_BARRAGE,  // Cinderforge
    BA_CANNON, BA_MISSILE, BA_MINES, BA_BROAD,               // Bastion
    TA_SINE, TA_TENDRIL, TA_SPORE, TA_PULSE, TA_WALL, TA_RAIN, TA_WHIRL};  // Tidecaller
static const BossRow SEQ_LENS[] = {{2, MA_CURVE1, MA_BLINK}};
static const float WARDEN_ORBIT[4][3] = {{138, 78, .5f}, {152, 96, 2.2f}, {124, 70, 4.1f}, {106, 60, 3.2f}};
static void bs_warden_begin() {
    for (unsigned i = 0; i < 4; i++) {
        BossPart& p = boss.parts[i];
        p = {};
        p.exists = true; p.kind = PK_STAR; p.slot = i; p.hp = p.hp_max = 5; p.r = 8;
        p.fire_at = game_ms + BOSS_ENTRANCE_MS + 1500 + i * 1000;
    }
    boss.stamp[STAMP_WARDEN_WINDOW] = game_ms + BOSS_ENTRANCE_MS + 4000;
}
static void bs_star_pos(unsigned i, float& x, float& y) {
    float ia = WARDEN_ORBIT[i][0], ib = WARDEN_ORBIT[i][1], rot = WARDEN_ORBIT[i][2];
    float t = boss.aux[AUX_WARDEN_CLOCK] * (100.0f / ia) + rot * 2;
    float ex = ia * cosf(t), ey = ib * sinf(t);
    x = boss.x + ex * cosf(rot) - ey * sinf(rot);
    y = boss.y + ex * sinf(rot) + ey * cosf(rot);
}
static unsigned bs_stars() {
    unsigned n = 0;
    for (unsigned i = 0; i < 4; i++) n += boss.parts[i].exists;
    return n;
}
static bool bs_cloaked() {
    return boss.kind == BK_WARDEN && boss.stamp[STAMP_WARDEN_CLOAK] && game_ms < boss.stamp[STAMP_WARDEN_CLOAK];
}
// The mirror is up (deflecting) while its aux is at 1; at .5 it is only forming.
static bool bs_mirrored() { return boss.kind == BK_WARDEN && boss.aux[AUX_WARDEN_MIRROR] > .75f && !bs_cloaked(); }
static void bs_warden_update() {
    boss.aux[AUX_WARDEN_CLOCK] += FRAME_TIME_MS / 1000.0f;
    for (unsigned i = 0; i < 4; i++) bs_star_pos(i, boss.parts[i].x, boss.parts[i].y);
    if (!boss.phase) return;
    // The core opens for 2 s every 8 s, announced by the halo (aux[1]). A window that would fall
    // inside the cloak waits for it to end, so no window is ever spent on an empty sky.
    if (bs_cloaked() && boss.stamp[STAMP_WARDEN_WINDOW] < boss.stamp[STAMP_WARDEN_CLOAK] + 400)
        boss.stamp[STAMP_WARDEN_WINDOW] = boss.stamp[STAMP_WARDEN_CLOAK] + 400;
    if (game_ms >= boss.stamp[STAMP_WARDEN_WINDOW] + 2000) boss.stamp[STAMP_WARDEN_WINDOW] = game_ms + 6000;
    boss.aux[AUX_WARDEN_CORE_OPEN] = game_ms >= boss.stamp[STAMP_WARDEN_WINDOW] && game_ms < boss.stamp[STAMP_WARDEN_WINDOW] + 2000 ? 1.0f : 0.0f;
    boss.aux[AUX_WARDEN_BUSY] = boss.atk ? 1.0f : 0.0f;
    // From phase 2 a mirror rises in each closed stretch between core windows: it forms for
    // 600 ms (.5), then throws every shot and the laser back at the pilot until just before the
    // next window. 900 ms after a window closes it is still down, so each window stays clear.
    float mirror = 0;
    if (boss.phase >= 2 && game_ms < boss.stamp[STAMP_WARDEN_WINDOW]) {
        unsigned long since = game_ms + 6000 - boss.stamp[STAMP_WARDEN_WINDOW]; // ms since the last window closed
        unsigned long up = boss.phase >= 3 ? 3500 : 2600;
        if (since >= 900 && since < 1500) mirror = .5f;
        else if (since >= 1500 && since < 1500 + up) mirror = 1.0f;
    }
    boss.aux[AUX_WARDEN_MIRROR] = mirror;
    unsigned long cloak = boss.stamp[STAMP_WARDEN_CLOAK];
    boss.aux[AUX_WARDEN_CLOAK] = bs_cloaked() ? (cloak - game_ms < 400 ? .75f : 1.0f) : 0.0f;
    bs_bolts_tick();
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
    // The earlier bosses' attacks run as they are; they only need the Warden's position.
    if (id >= SA_LANCE && id <= SA_CROSS) return bs_sentinel_run(id, t);
    if (id == RA_PRISM || id == RA_PICK) return bs_ring_run(id, t);
    if (id == CA_LOB || id == CA_EMBER || id == CA_HAMMER || id == CA_GEYSER || id == CA_BARRAGE) return bs_forge_run(id, t);
    if (id >= BA_CANNON && id <= BA_BROAD) return bs_bastion_run(id, t);
    if (id >= TA_SINE && id <= TA_WHIRL) return bs_tide_run(id, t);
    switch (id) {
    case WX_BURST:   // the Ringwarden's burst, fired from a ring round the core
        if (bs_at(t, 0)) bs_hazard(HK_TELL, cx, cy, 0, 124, 0, 700, 0);
        if (bs_at(t, 700)) {
            unsigned n = bs_density(14);
            float spin = bs_rand(0, TWO_PI / n);
            for (unsigned k = 0; k < n; k++) {
                float a = k * TWO_PI / n + spin;
                if (cosf(a) > .6f) continue; // not into the right-hand wall
                bs_shot_at(SF_SHARD, cx + cosf(a) * 120, cy + sinf(a) * 120, a, 1.6f);
            }
        }
        return t >= 1000;
    case WX_JETS:    // the Cinderforge's jets: lanes fanned out from the left of the body
        if (bs_at(t, 0)) {
            int picks[3];
            unsigned n = 0;
            for (unsigned tries = 0; tries < 40 && n < 3; tries++) {
                int c = rock_random_bounded(5);
                bool ok = true;
                for (unsigned j = 0; j < n; j++) if (abs(picks[j] - c) < 2) ok = false;
                if (ok) picks[n++] = c;
            }
            for (unsigned j = 0; j < n; j++) {
                float a = BOSS_PI + (picks[j] - 2) * .5f;
                bs_hazard(HK_LANE, cx + cosf(a) * 108, cy + sinf(a) * 108, a, 420, 14, 900, 500);
            }
        }
        return t >= 1500;
    case WX_NOVA: {  // the Cinderforge's nova ring, with a gap that changes sides each time
        if (bs_at(t, 0)) {
            float gap = bs_angle_to(cx, cy, boss.target_x, boss.target_y) + (boss.cycle % 2 ? .9f : -.9f);
            BossHazard *h = bs_hazard(HK_RING, cx, cy, gap, 112, .52f, 1000, 4000);
            if (h) { h->d = 2.0f; h->e = 0; }
            bs_hazard(HK_TELL, cx, cy, 0, 132, 0, 1000, 0);
        }
        return t >= 1100;
    }
    case WX_CLOAK: { // the Lens Imp's blink, whole: shimmer, vanish, hop, fire from the dark
        if (bs_at(t, 0)) bs_hazard(HK_TELL, cx, cy, 0, 140, 0, 600, 0);
        boss.aux[AUX_WARDEN_CLOAK] = t < 600 ? .25f : boss.aux[AUX_WARDEN_CLOAK];
        if (bs_at(t, 600)) {
            boss.stamp[STAMP_WARDEN_CLOAK] = game_ms + 2400;
            float y = bs_rand(100, 172);
            if (fabsf(y - boss.home_y) < 30) y = y < boss.home_y ? y - 30 : y + 30;
            boss.home_y = y;
            boss.y = y;
        }
        for (unsigned k = 0; k < 2; k++) {
            unsigned long at = 1100 + k * 900;
            if (bs_at(t, at - 500)) {
                float ang = bs_angle_to(boss.x, boss.y, boss.target_x, boss.target_y);
                bs_hazard(HK_AIM, boss.x, boss.y, ang, 480, 0, 500, 0);
                boss.scratch[0] = ang;
            }
            if (bs_at(t, at))
                for (int i = 0; i < 3; i++) bs_shot_at(SF_NEEDLE, boss.x, boss.y, boss.scratch[0] + (i - 1) * .22f, 2.2f);
        }
        return t >= 600 + 2400 + 100;
    }
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
            unsigned pass = (unsigned)boss.aux[AUX_WARDEN_PASS]++;
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
            boss.stamp[STAMP_WARDEN_PULLED] = 1;
        }
        return t >= 2800;
    }
    return true;
}

// ================================================================ LENS IMP
static void bs_lens_update() {
    boss.aux[AUX_LENS_CLOCK] += FRAME_TIME_MS / 1000.0f;
    boss.aux[AUX_LENS_BLINK] = boss.stamp[STAMP_LENS_BLINK_UNTIL] && game_ms < boss.stamp[STAMP_LENS_BLINK_UNTIL] ? 1.0f : 0.0f; // blinking
}
static bool bs_lens_run(int id, unsigned long t) {
    if (id == MA_CURVE1) return bs_warden_run(id, t);
    // Blink: a 700 ms tell, then the imp reappears elsewhere.
    if (bs_at(t, 0)) boss.stamp[STAMP_LENS_BLINK_UNTIL] = game_ms + 900;
    if (bs_at(t, 700)) {
        float y = bs_rand(80, 195);
        if (fabsf(y - boss.home_y) < 50) y = y < 135 ? y + 60 : y - 60;
        boss.home_y = y;
        boss.y = y;
    }
    return t >= 1000;
}

static bool bs_blinking() { return boss.kind == BK_LENSIMP && boss.stamp[STAMP_LENS_BLINK_UNTIL] && game_ms < boss.stamp[STAMP_LENS_BLINK_UNTIL]; }
// The pull is held back for a while after it fires, and never under the calm assist. The
// cloak does not start while a core window is open or about to open.
static int bs_warden_pick() {
    int id = bs_seq_pick(SEQ_WARDEN, 3);
    if (boss.phase >= 3 && boss.seq_total % 2 == 0)
        id = WARDEN_POOL[rock_random_bounded(sizeof(WARDEN_POOL))];
    if (id == WA_PULL && (boss.stamp[STAMP_WARDEN_PULLED] || boss_assist_calm)) id = WA_CURVE;
    unsigned long window = boss.stamp[STAMP_WARDEN_WINDOW];
    if (id == WX_CLOAK && (boss.aux[AUX_WARDEN_CORE_OPEN] > .5f || (window > game_ms && window - game_ms < 700)))
        id = WA_SPIRAL;
    return id;
}
static int bs_lens_pick() { return bs_seq_pick(SEQ_LENS, 1); }
static void bs_warden_circles() {
    if (bs_cloaked()) return; // nothing to hit: shots pass straight through
    for (unsigned i = 0; i < 4; i++)
        if (boss.parts[i].exists) bs_circle(boss.parts[i].x, boss.parts[i].y, 9, BC_PART, i, 3);
    if (bs_mirrored()) {
        bs_circle(boss.x, boss.y, 104, BC_DEFLECT, 0, 3);
        return;
    }
    bool open = boss.aux[AUX_WARDEN_CORE_OPEN] > .5f || !bs_stars();
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
    if (bs_cloaked()) return 0; // harmless while it is not there
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
static const BossOps OPS_WARDEN = {338, 135, 4, 3, {70, 35}, {1000, 850, 700},
    bs_warden_begin, bs_warden_update, bs_warden_pick, bs_warden_run, bs_warden_circles,
    bs_warden_body, nullptr, nullptr, bs_warden_hit};
static const BossOps OPS_LENSIMP = {380, 135, 6, 1, {0, 0}, {1000, 1000, 1000},
    nullptr, bs_lens_update, bs_lens_pick, bs_lens_run, bs_lens_circles,
    bs_lens_body, nullptr, nullptr, nullptr};
