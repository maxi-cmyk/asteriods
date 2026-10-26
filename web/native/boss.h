#pragma once

// Region bosses and mini-bosses (design: nextSteps.md, Part A).
//
// One BossState holds the live fight. Solo and co-op drive the same code:
// `boss_hulls` points at the pilots, `boss_hit_hook` damages a pilot and
// `boss_award_hook` pays the defeat score. Every fight is a script of attacks
// (warn -> live -> rest) that spawn hostile shots, telegraphed hazards and
// shootable parts. All timing comes from `game_ms`; all randomness from the
// run's seeded generator, so tests and replays agree.
//
// Fairness rules enforced here (and measured by the test build):
//   1 the entrance is harmless; 2 a lethal hazard always has its warning;
//   3 a 42 px safe corridor exists; 4 at most 48 shots / 6 hazards;
//   6 dying never resets the boss; 7 the body stays in the right 55%.

static const unsigned long BOSS_ENTRANCE_MS = 1400;
static const unsigned long BOSS_RECOVERY_MS = 1200;
static const float BOSS_PI = 3.14159265f;
static const unsigned BOSS_SHOTS = 48;
static const unsigned BOSS_HAZARDS = 10;
static const unsigned BOSS_LETHAL_CAP = 6;
static const unsigned BOSS_PARTS = 32;
static const unsigned BOSS_CIRCLES = 112;

enum BossKind : uint8_t {
    BK_SENTINEL, BK_RINGWARDEN, BK_CINDERFORGE, BK_BASTION, BK_TIDECALLER,
    BK_WARDEN, BK_PICKET, BK_SHARDLING, BK_CINDERLING, BK_GUNNERY,
    BK_MOONJELLY, BK_LENSIMP, BK_COUNT
};
enum ShotFamily : uint8_t {
    SF_NEEDLE, SF_SHARD, SF_BOLT, SF_SINE, SF_PELLET, SF_MISSILE, SF_MINE,
    SF_LOB, SF_SPORE, SF_EMBER, SF_CURVE, SF_FAST
};
enum HazardKind : uint8_t {
    HK_LANE, HK_POOL, HK_BEAM, HK_RING, HK_ARM,         // lethal when live
    HK_TELL, HK_ARC, HK_AIM, HK_PULL                    // warnings and forces
};
enum PartKind : uint8_t { PK_BLADE, PK_PANEL, PK_HARD, PK_BUBBLE, PK_STAR, PK_ORB };
enum CircleType : uint8_t { BC_CORE, BC_BLOCK, BC_PART, BC_SHOT };
enum {
    SA_LANCE = 1, SA_FAN, SA_VOLLEY, SA_CROSS,
    RA_BURST = 10, RA_PRISM, RA_PICK, RA_COLLAPSE,
    CA_LOB = 20, CA_JETS, CA_EMBER, CA_NOVA,
    BA_CANNON = 30, BA_MISSILE, BA_MINES, BA_BROAD,
    TA_SINE = 40, TA_TENDRIL, TA_SPORE, TA_PULSE,
    WA_SPIRAL = 50, WA_CURVE, WA_ACCRETE, WA_PULL,
    MA_BOLTS = 60, MA_SHARDS, MA_CURVE1, MA_BLINK, MA_SINE6
};

struct BossShot {
    bool active = false;
    uint8_t family = 0;
    int8_t hp = 0;
    int8_t link = -1;
    float x = 0, y = 0;     // current position
    float bx = 0, by = 0;   // sine baseline
    float dx = 0, dy = 0;   // velocity per tick
    float turn = 0;         // radians per tick (curve) or turn limit (missile)
    float amp = 0, phase = 0;
    unsigned long born = 0, life = 0;
};
struct BossHazard {
    bool active = false;
    uint8_t kind = 0;
    float x = 0, y = 0, a = 0, b = 0, c = 0, d = 0, e = 0;
    unsigned long warn_total = 0, warn_left = 0, live_left = 0;
};
struct BossPart {
    bool exists = false;
    uint8_t kind = 0;
    uint8_t slot = 0;
    uint8_t state = 0;
    int8_t hp = 0;
    int8_t hp_max = 0;
    float x = 0, y = 0, r = 0, ang = 0;
    unsigned long until = 0;   // revive time, or open-until for panels
    unsigned long fire_at = 0;
};
struct BossCircle {
    float x, y, r;
    uint8_t type, index, flags; // flags: 1 player shots, 2 laser
};
struct BossState {
    bool active = false;
    bool mini = false;
    bool practice = false;
    uint8_t kind = 0;
    uint8_t tier = 0;
    unsigned wave = 0;
    unsigned players = 1;
    unsigned health = 0;
    unsigned maximum = 0;
    unsigned kills = 0;
    unsigned cycle = 0;
    unsigned phase = 0;           // 0 entrance, then 1..4
    unsigned long phase_started = 0;
    unsigned start_phase = 1;     // boss practice can begin in a later phase
    unsigned long born = 0;
    unsigned long defeated = 0;
    unsigned long flash_until = 0;
    unsigned defeated_mask = 0;
    float x = 0, y = 0, home_x = 0, home_y = 0;
    float target_x = 40, target_y = 135;
    int atk = 0;
    unsigned long atk_t0 = 0, rest_until = 0;
    unsigned seq = 0, seq_total = 0;
    float aux[16] = {};
    unsigned long stamp[6] = {};
    bool touched[2] = {};
    unsigned killer = 0;
    bool life_lost = false;
    unsigned lives_at_start = 0;
    uint8_t drops = 0;
    bool hold = false;            // keeps a wave open while a mini lives
    float armor = 0;
    unsigned hits_taken = 0;
    unsigned violations = 0, max_shots = 0, max_hazards = 0, entrance_hits = 0;
    unsigned min_corridor = 999, spawn_in_body = 0;
    BossShot shots[BOSS_SHOTS] = {};
    BossHazard hz[BOSS_HAZARDS] = {};
    BossPart parts[BOSS_PARTS] = {};
};
static BossState boss = {};
static BossCircle boss_circles[BOSS_CIRCLES];
static unsigned boss_circle_count = 0;
static bool boss_assist_long = false;     // +30% telegraphs
static bool boss_assist_calm = false;     // no pull, straight lens shots
static unsigned boss_force_tier = 0;      // practice picks a tier directly

static void combat_ship_hit();
static void combat_award(uint32_t points);

// Health is stated in design hits (nextSteps.md). The engine splits each into
// sub-hits so the open windows, not raw fire rate, set the fight length: a
// primary shot is one sub-hit, the laser stays worth eight design hits.
static const uint8_t BOSS_K[12] = {3, 6, 7, 5, 5, 4, 5, 8, 5, 8, 8, 6};

// ---------------------------------------------------------------- pilots
static Ship *boss_hulls[2] = {&ship, nullptr};
static unsigned boss_hull_n = 1;
static void boss_hit_solo(unsigned) { combat_ship_hit(); }
static void boss_award_solo(unsigned, uint32_t points) {
    combat_award(points);
    run_destroyed--; // Boss kills have their own counter, not asteroid kills.
}
static void boss_stat_solo(unsigned) { combat.hits++; }
static void (*boss_hit_hook)(unsigned) = boss_hit_solo;
static void (*boss_award_hook)(unsigned, uint32_t) = boss_award_solo;
static void (*boss_stat_hook)(unsigned) = boss_stat_solo;
static void boss_bind_solo() {
    boss_hulls[0] = &ship;
    boss_hulls[1] = nullptr;
    boss_hull_n = 1;
    boss_hit_hook = boss_hit_solo;
    boss_award_hook = boss_award_solo;
    boss_stat_hook = boss_stat_solo;
}

// ---------------------------------------------------------------- maths
static float bs_clamp(float v, float lo, float hi) { return v < lo ? lo : v > hi ? hi : v; }
static float bs_min(float a, float b) { return a < b ? a : b; }
static float bs_max(float a, float b) { return a > b ? a : b; }
static float bs_wrap(float a) {
    while (a > BOSS_PI) a -= TWO_PI;
    while (a < -BOSS_PI) a += TWO_PI;
    return a;
}
static float bs_atan2(float y, float x) {
    float ax = fabsf(x), ay = fabsf(y);
    float hi = bs_max(ax, ay), lo = bs_min(ax, ay);
    if (hi == 0) return 0;
    float a = lo / hi, s = a * a;
    float r = ((-0.0464964749f * s + 0.15931422f) * s - 0.327622764f) * s * a + a;
    if (ay > ax) r = 1.57079637f - r;
    if (x < 0) r = BOSS_PI - r;
    return y < 0 ? -r : r;
}
static float bs_rand(float lo, float hi) {
    return lo + (hi - lo) * (rock_random_bounded(1000) / 1000.0f);
}
static unsigned long bs_since(unsigned long t) { return game_ms >= t ? game_ms - t : 0; }
static bool bs_at(unsigned long t, unsigned long ms) { return t >= ms && t < ms + FRAME_TIME_MS; }
static float bs_dist(float x0, float y0, float x1, float y1) {
    float dx = x1 - x0, dy = y1 - y0;
    return sqrtf(dx * dx + dy * dy);
}

// ---------------------------------------------------------------- pilots
static bool bs_alive(unsigned i) { return i < boss_hull_n && boss_hulls[i] && boss_hulls[i]->alive; }
static unsigned bs_alive_count() {
    unsigned n = 0;
    for (unsigned i = 0; i < boss_hull_n; i++) n += bs_alive(i);
    return n;
}
static unsigned bs_lives_total() {
    unsigned n = 0;
    for (unsigned i = 0; i < boss_hull_n; i++) n += boss_hulls[i] ? boss_hulls[i]->lives : 0;
    return n;
}
// Aim memory for one attack: the nearer pilot, then every other attack the farther.
static void bs_acquire() {
    int pick = -1;
    unsigned alive = bs_alive_count();
    if (!alive) return;
    if (alive == 1) {
        for (unsigned i = 0; i < boss_hull_n; i++) if (bs_alive(i)) pick = i;
    } else {
        float d0 = bs_dist(boss.x, boss.y, boss_hulls[0]->position_x, boss_hulls[0]->position_y);
        float d1 = bs_dist(boss.x, boss.y, boss_hulls[1]->position_x, boss_hulls[1]->position_y);
        bool near_first = d0 <= d1;
        bool want_near = boss.seq_total % 2 == 1; // the first attack of a fight picks the nearer pilot
        pick = want_near == near_first ? 0 : 1;
    }
    boss.target_x = boss_hulls[pick]->position_x;
    boss.target_y = boss_hulls[pick]->position_y;
}
// Nearest pilot to a point, for homing and live aiming.
static bool bs_nearest(float x, float y, float& px, float& py) {
    float best = 1e9f;
    bool found = false;
    for (unsigned i = 0; i < boss_hull_n; i++) {
        if (!bs_alive(i)) continue;
        float d = bs_dist(x, y, boss_hulls[i]->position_x, boss_hulls[i]->position_y);
        if (d < best) { best = d; px = boss_hulls[i]->position_x; py = boss_hulls[i]->position_y; found = true; }
    }
    return found;
}
static void bs_hit_pilot(unsigned i) {
    boss.hits_taken++;
    if (boss.phase == 0) boss.entrance_hits++;
    boss_hit_hook(i);
}

// ---------------------------------------------------------------- pools
static float bs_shot_radius(uint8_t f) {
    static const float r[] = {2, 3, 3, 4, 2.5f, 4, 5, 5, 18, 2, 2.5f, 3};
    return r[f];
}
static bool bs_shootable(uint8_t f) {
    return f == SF_MISSILE || f == SF_MINE || f == SF_LOB || f == SF_SPORE;
}
static unsigned bs_shot_count() {
    unsigned n = 0;
    for (const BossShot& s : boss.shots) n += s.active;
    return n;
}
static bool bs_lethal_kind(uint8_t k) { return k <= HK_ARM; }
static unsigned bs_lethal_count() {
    unsigned n = 0;
    for (const BossHazard& h : boss.hz) n += h.active && bs_lethal_kind(h.kind);
    return n;
}
static int bs_shot_index(const BossShot* s) { return s ? int(s - boss.shots) : -1; }
static BossShot *bs_shot(uint8_t family, float x, float y, float dx, float dy,
                         int hp = 0, unsigned long life = 0) {
    if (bs_shot_count() >= BOSS_SHOTS) return nullptr;
    for (BossShot& s : boss.shots) {
        if (s.active) continue;
        s = {};
        s.active = true;
        s.family = family;
        s.hp = hp;
        s.x = s.bx = x;
        s.y = s.by = y;
        s.dx = dx;
        s.dy = dy;
        s.born = game_ms;
        s.life = life;
        unsigned n = bs_shot_count();
        if (n > boss.max_shots) boss.max_shots = n;
        return &s;
    }
    return nullptr;
}
static BossShot *bs_shot_at(uint8_t family, float x, float y, float angle, float speed,
                            int hp = 0, unsigned long life = 0) {
    return bs_shot(family, x, y, cosf(angle) * speed, sinf(angle) * speed, hp, life);
}
static unsigned long bs_warn_min(uint8_t kind) {
    return kind == HK_RING ? 700 : bs_lethal_kind(kind) ? 900 : 0;
}
static BossHazard *bs_hazard(uint8_t kind, float x, float y, float a, float b, float c,
                             unsigned long warn, unsigned long live) {
    if (bs_lethal_kind(kind) && bs_lethal_count() >= BOSS_LETHAL_CAP) return nullptr;
    if (boss_assist_long) warn = warn * 13 / 10;
    for (BossHazard& h : boss.hz) {
        if (h.active) continue;
        h = {};
        h.active = true;
        h.kind = kind;
        h.x = x; h.y = y; h.a = a; h.b = b; h.c = c;
        h.warn_total = h.warn_left = warn;
        h.live_left = live;
        unsigned n = bs_lethal_count();
        if (n > boss.max_hazards) boss.max_hazards = n;
        return &h;
    }
    return nullptr;
}
static int bs_hazard_index(const BossHazard *h) { return h ? int(h - boss.hz) : -1; }
static void bs_clear_threats() {
    for (BossShot& s : boss.shots) s.active = false;
    for (BossHazard& h : boss.hz) h.active = false;
}
static BossPart *bs_part(unsigned i) { return &boss.parts[i]; }

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

// ---------------------------------------------------------------- shots
static void bs_burst(float x, float y, int n, float speed, float offset = 0) {
    for (int i = 0; i < n; i++)
        bs_shot_at(SF_NEEDLE, x, y, offset + i * TWO_PI / n, speed);
}
static void bs_ember_split(float x, float y) {
    for (int i = 0; i < 3; i++)
        bs_shot_at(SF_EMBER, x, y, BOSS_PI + (i - 1) * .55f, 1.0f);
}
// A shootable shot ends: missiles pop, mines and spores burst, a lob splits.
static void bs_shot_end(BossShot& s, bool by_player) {
    // Copy first: spawning children may reuse this very slot.
    const BossShot was = s;
    s.active = false;
    particles_spawn(was.x, was.y);
    if (was.family == SF_MINE) bs_burst(was.x, was.y, 8, 1.8f, .3f);
    else if (was.family == SF_SPORE) bs_burst(was.x, was.y, 4, 1.2f, bs_rand(0, 1.5f));
    else if (was.family == SF_LOB && by_player) {
        if (was.link >= 0) boss.hz[was.link].active = false; // the pool never lands
        bs_ember_split(was.x, was.y);
    }
}
static void bs_shots_update() {
    for (unsigned i = 0; i < BOSS_SHOTS; i++) {
        BossShot& s = boss.shots[i];
        if (!s.active) continue;
        unsigned long age = bs_since(s.born);
        if (s.family == SF_SINE) {
            s.bx += s.dx;
            s.by += s.dy;
            float len = bs_max(.01f, sqrtf(s.dx * s.dx + s.dy * s.dy));
            float wave = s.amp * sinf(TWO_PI * age / 700.0f + s.phase);
            s.x = s.bx - s.dy / len * wave;
            s.y = s.by + s.dx / len * wave;
        } else {
            if (s.family == SF_MISSILE) {
                float px, py;
                if (bs_nearest(s.x, s.y, px, py)) {
                    float want = bs_atan2(py - s.y, px - s.x);
                    float have = bs_atan2(s.dy, s.dx);
                    float diff = bs_clamp(bs_wrap(want - have), -s.turn, s.turn);
                    s.dx = cosf(have + diff) * 1.4f;
                    s.dy = sinf(have + diff) * 1.4f;
                }
            } else if (s.family == SF_CURVE && s.turn != 0) {
                float c = cosf(s.turn), n = sinf(s.turn);
                float nx = s.dx * c - s.dy * n, ny = s.dx * n + s.dy * c;
                s.dx = nx;
                s.dy = ny;
            }
            s.x += s.dx;
            s.y += s.dy;
        }
        if (s.life && age >= s.life) {
            if (s.family == SF_LOB) s.active = false;      // lands; the pool goes live
            else if (s.family == SF_MINE || s.family == SF_SPORE) bs_shot_end(s, false);
            else s.active = false;
            continue;
        }
        if (s.x < -14 || s.x > SCREEN_W + 14 || s.y < -14 || s.y > SCREEN_H + 14) {
            s.active = false;
            continue;
        }
        if (s.family == SF_LOB) continue; // airborne plasma is harmless
        float reach = bs_shot_radius(s.family) + SHIP_RADIUS;
        for (unsigned p = 0; p < boss_hull_n; p++) {
            if (!bs_alive(p)) continue;
            float dx = s.x - boss_hulls[p]->position_x, dy = s.y - boss_hulls[p]->position_y;
            if (dx * dx + dy * dy < reach * reach) {
                if (s.family == SF_SPORE || s.family == SF_MINE) bs_shot_end(s, false);
                else s.active = false;
                bs_hit_pilot(p);
                break;
            }
        }
    }
}

// ---------------------------------------------------------------- circles
static void bs_circle(float x, float y, float r, uint8_t type, uint8_t index = 0, uint8_t flags = 3) {
    if (boss_circle_count >= BOSS_CIRCLES) return;
    boss_circle_count++;
    boss_circles[boss_circle_count - 1] = {x, y, r, type, index, flags};
}

// Per-kind hooks live in boss_fights.h.
static void bs_kind_begin();
static void bs_kind_update();
static int bs_kind_pick();
static bool bs_kind_run(int id, unsigned long t);
static unsigned long bs_kind_rest();
static void bs_kind_circles();
static unsigned bs_kind_body(float *out); // contact circles: x, y, r triples
static void bs_kind_phase(unsigned phase);
static void bs_kind_hit(const BossCircle& c, unsigned owner, unsigned damage, bool laser);
static unsigned bs_phase_for(unsigned health);

static void bs_build_circles() {
    boss_circle_count = 0;
    if (!boss.active || boss.phase == 0) return;
    bs_kind_circles();
    for (unsigned i = 0; i < BOSS_SHOTS; i++) {
        const BossShot& s = boss.shots[i];
        if (s.active && bs_shootable(s.family))
            bs_circle(s.x, s.y, bs_shot_radius(s.family) + 1.5f, BC_SHOT, i, 3);
    }
}
static void bs_defeat(unsigned owner);
static void bs_damage(unsigned owner, unsigned damage) {
    if (!boss.active || boss.phase == 0 || !damage) return;
    if (owner < 2) boss.touched[owner] = true;
    boss.flash_until = game_ms + 80;
    boss.health = damage >= boss.health ? 0 : boss.health - damage;
    unsigned phase = boss.phase;
    if (boss.health) {
        unsigned next = bs_phase_for(boss.health);
        if (next > phase) {
            boss.phase = next;
            boss.phase_started = game_ms;
            boss.seq = 0;
            boss.rest_until = game_ms + 700;
            bs_kind_phase(next);
            display_shake(1);
        }
        return;
    }
    bs_defeat(owner);
}
static void bs_defeat(unsigned owner) {
    boss.active = false;
    boss.defeated = game_ms;
    boss.kills++;
    boss.killer = owner;
    boss.defeated_mask |= 1u << boss.kind;
    if (boss.hold) {
        boss.hold = false;
        // Release the wave the mini was holding open.
        if (next_spawn_ms > game_ms + 500000) { pending_asteroids = 0; waiting_for_next_wave = false; }
    }
    bs_clear_threats();
    for (BossPart& p : boss.parts) p.exists = false;
    if (!boss.practice) {
        uint32_t base;
        unsigned region = boss.kind % 6;
        if (boss.mini) base = 400 + 100 * region;
        else base = 1500 + min(10u, boss.wave / 5) * 250;
        if (!boss.life_lost) base = base * 3 / 2; // flawless: no life lost in the fight
        boss_award_hook(owner, base);
    }
    particles_spawn(boss.x, boss.y);
    sound_play(SFX_ASTEROID_LARGE);
    display_shake(boss.mini ? 1 : 2);
}
static void bs_core_damage(unsigned owner, unsigned damage, bool laser) {
    // A laser through the bell pops every bubble guarding it.
    if (boss.kind == BK_TIDECALLER && laser)
        for (unsigned i = 0; i < 3; i++)
            if (boss.parts[i].exists) { boss.parts[i].exists = false; particles_spawn(boss.parts[i].x, boss.parts[i].y); }
    // The forge's shell blunts the laser unless the core is exposed.
    if (boss.kind == BK_CINDERFORGE && laser && game_ms >= boss.stamp[0]) damage /= 2;
    if (boss.kind == BK_BASTION && !laser) {
        bool shielded = false;
        for (unsigned i = 0; i < 3; i++) shielded |= boss.parts[i].exists;
        if (shielded) {
            boss.armor += damage * .5f;
            damage = 0;
            if (boss.armor >= 1) { damage = 1; boss.armor -= 1; }
        }
    }
    bs_damage(owner, damage);
}
// Resolve one player shot or laser touching a circle.
static void bs_circle_hit(unsigned index, unsigned owner, unsigned damage, bool laser) {
    if (index >= boss_circle_count) return;
    const BossCircle c = boss_circles[index];
    if (c.type == BC_BLOCK) return;
    boss_stat_hook(owner);
    if (c.type == BC_CORE)
        bs_core_damage(owner, laser ? damage * BOSS_K[boss.kind] : damage, laser);
    else if (c.type == BC_SHOT) {
        BossShot& s = boss.shots[c.index];
        if (!s.active) return;
        if (s.hp > (int)damage && !laser) { s.hp -= damage; return; }
        bs_shot_end(s, true);
    } else bs_kind_hit(c, owner, damage, laser);
}
// Earliest circle a segment enters, or -1.
static int bs_first_circle(float x0, float y0, float x1, float y1) {
    float dx = x1 - x0, dy = y1 - y0, length = dx * dx + dy * dy;
    int best = -1;
    float best_t = 2;
    for (unsigned i = 0; i < boss_circle_count; i++) {
        const BossCircle& c = boss_circles[i];
        if (!(c.flags & 1)) continue;
        float ox = x0 - c.x, oy = y0 - c.y;
        float outside = ox * ox + oy * oy - c.r * c.r;
        float t = 0;
        if (outside > 0) {
            float projection = ox * dx + oy * dy;
            float disc = projection * projection - length * outside;
            if (!length || disc < 0) continue;
            t = (-projection - sqrtf(disc)) / length;
        }
        if (t >= 0 && t <= 1 && t < best_t) { best_t = t; best = i; }
    }
    return best;
}
static float bs_entry(int index, float x0, float y0, float x1, float y1) {
    const BossCircle& c = boss_circles[index];
    float dx = x1 - x0, dy = y1 - y0, length = dx * dx + dy * dy;
    float ox = x0 - c.x, oy = y0 - c.y;
    float outside = ox * ox + oy * oy - c.r * c.r;
    if (outside <= 0) return 0;
    float projection = ox * dx + oy * dy;
    float disc = projection * projection - length * outside;
    if (!length || disc < 0) return 2;
    float t = (-projection - sqrtf(disc)) / length;
    return t >= 0 && t <= 1 ? t : 2;
}
static bool bs_beam_hits(float x, float y, float r) {
    float dx = x - combat.beam_x, dy = y - combat.beam_y;
    float along = dx * combat.beam_direction_x + dy * combat.beam_direction_y;
    float across = dx * combat.beam_direction_y - dy * combat.beam_direction_x;
    r += 2.0f;
    bool hit = along >= 0 ? across * across <= r * r : dx * dx + dy * dy <= r * r;
    return hit && x >= 0 && x < SCREEN_W && y >= 0 && y < SCREEN_H;
}
static void bs_laser(unsigned owner) {
    if (!boss.active || boss.phase == 0) return;
    bs_build_circles();
    for (unsigned i = 0; i < boss_circle_count; i++) {
        const BossCircle c = boss_circles[i];
        if (!(c.flags & 2) || c.type == BC_BLOCK) continue;
        if (bs_beam_hits(c.x, c.y, c.r)) bs_circle_hit(i, owner, 8, true);
    }
}

// ---------------------------------------------------------------- scheduler
// Attack rows: {count, ids...} per phase. Tier 1 adds the next phase's closing
// attack to each row, so it appears one phase early.
typedef uint8_t BossRow[8];
static int bs_seq_pick(const BossRow *rows, unsigned count) {
    unsigned idx = (boss.phase < count ? boss.phase : count) - 1;
    const uint8_t *row = rows[idx];
    unsigned total = row[0];
    int extra = 0;
    if (boss.tier >= 1) {
        const uint8_t *next = rows[idx + 1 < count ? idx + 1 : idx];
        extra = next[0] ? next[next[0]] : 0;
        if (extra) total++;
    }
    if (!total) return 0;
    unsigned k = (boss.seq ? boss.seq - 1 : 0) % total;
    return k < row[0] ? row[1 + k] : extra;
}
static bool bs_frenzy();
static unsigned long bs_rest_scaled(unsigned long base) {
    float scale = boss.tier >= 1 ? .85f : 1.0f;
    if (boss.tier >= 2 && bs_frenzy()) scale = .7f;
    return (unsigned long)(base * scale);
}
static void bs_pickups() {
    if (boss.mini || pickup.active) return;
    uint8_t want = boss.phase >= 3 ? 2 : boss.phase >= 2 ? 1 : 0;
    for (uint8_t bit = 0; bit < want; bit++) {
        if (boss.drops & (1u << bit)) continue;
        pickup = {float(SCREEN_W - 24), bs_rand(70, 200), bit == 0 ? PICKUP_SHIELD : PICKUP_MULTISHOT, true};
        boss.drops |= 1u << bit;
        return;
    }
}
static void bs_scheduler() {
    if (!boss.atk) {
        if (game_ms < boss.rest_until) return;
        int id = bs_kind_pick();
        if (!id) { boss.rest_until = game_ms + 500; return; }
        boss.atk = id;
        boss.atk_t0 = game_ms;
        boss.seq++;
        boss.seq_total++;
        boss.cycle++;
        bs_acquire();
    }
    if (bs_kind_run(boss.atk, game_ms - boss.atk_t0)) {
        boss.atk = 0;
        boss.rest_until = game_ms + bs_rest_scaled(bs_kind_rest());
    }
}

// ---------------------------------------------------------------- begin / tick
static void bs_setup(uint8_t kind, uint8_t tier, unsigned players, unsigned wave, bool practice) {
    unsigned kills = boss.kills, mask = boss.defeated_mask;
    boss = {};
    boss.kills = kills;
    boss.defeated_mask = mask;
    boss.active = true;
    boss.kind = kind;
    boss.mini = kind >= BK_PICKET;
    boss.tier = tier;
    boss.practice = practice;
    boss.wave = wave;
    boss.players = constrain(players, 1u, 2u);
    unsigned region = kind % 6;
    unsigned base;
    if (boss.mini) base = 6 + 2 * region;
    else base = 18 + 6 * (min(10u, wave ? wave / 5 : region + 1) - 1);
    if (practice && !boss.mini) base = 18 + 6 * region;
    if (tier >= 1) base = base * 12 / 10;
    boss.maximum = base * boss.players * BOSS_K[kind];
    boss.health = boss.maximum;
    boss.born = game_ms;
    boss.phase_started = game_ms;
    boss.lives_at_start = bs_lives_total();
    boss.rest_until = 0;
    bs_kind_begin();
    boss.x = boss.home_x + 160;
    boss.y = boss.home_y;
}
static unsigned bs_tier_for(unsigned wave) {
    return wave >= 5 && wave % 5 == 0 ? (wave / 5 - 1) / 6
           : wave >= 3 && wave % 5 == 3 ? ((wave - 3) / 5) / 6 : 0;
}
static uint8_t bs_kind_for(unsigned wave) {
    if (wave % 5 == 0) return (wave / 5 - 1) % 6;
    return BK_PICKET + ((wave - 3) / 5) % 6;
}
// A wave boss starts with its wave; a mini shares the wave with half the rocks.
static void boss_begin(unsigned players = 1) {
    uint8_t kind = bs_kind_for(wave_number);
    bs_setup(kind, bs_tier_for(wave_number), players, wave_number, false);
    if (boss.mini) {
        pending_asteroids = (pending_asteroids + 1) / 2;
        boss.hold = true;
    } else {
        pending_asteroids = 0;
        memset(rocks, 0, sizeof(rocks));
        waiting_for_next_wave = false;
    }
}
static void boss_begin_practice(unsigned kind, unsigned tier, unsigned players = 1) {
    wave_number = kind >= BK_PICKET ? (kind % 6) * 5 + 3 + 30 * tier : (kind + 1) * 5 + 30 * tier;
    bs_setup(kind % BK_COUNT, tier, players, 0, true);
    pending_asteroids = 0;
    memset(rocks, 0, sizeof(rocks));
}
static bool boss_wave_is_boss(unsigned wave) { return wave >= 3 && (wave % 5 == 0 || wave % 5 == 3); }

// Returns true when the regular rock spawner must not run this tick.
static bool boss_controls_wave(unsigned players = 1) {
    if (practice_mode || boss.practice) return boss.practice;
    if (!boss_wave_is_boss(wave_number)) return false;
    if (boss.wave != wave_number) boss_begin(players);
    bool full = !boss.mini;
    if (boss.mini && boss.active && !pending_asteroids && !asteroid_active_count()) {
        // Keep the wave open: a fake pending rock far in the future.
        pending_asteroids = 1;
        next_spawn_ms = game_ms + 1000000;
    }
    return full && (boss.active || game_ms - boss.defeated < BOSS_RECOVERY_MS);
}

static bool bs_entrance() {
    unsigned long elapsed = bs_since(boss.born);
    if (elapsed >= BOSS_ENTRANCE_MS) {
        boss.phase = boss.start_phase > 1 ? boss.start_phase : 1;
        boss.phase_started = game_ms;
        if (boss.phase > 1) bs_kind_phase(boss.phase);
        boss.x = boss.home_x;
        boss.y = boss.home_y;
        boss.rest_until = game_ms + 500;
        return false;
    }
    float t = elapsed / float(BOSS_ENTRANCE_MS);
    float ease = 1 - (1 - t) * (1 - t);
    boss.x = boss.home_x + 160 * (1 - ease);
    boss.y = boss.home_y;
    return true;
}
static void bs_contact() {
    float body[24];
    unsigned n = bs_kind_body(body);
    for (unsigned p = 0; p < boss_hull_n; p++) {
        if (!bs_alive(p)) continue;
        for (unsigned i = 0; i < n; i++) {
            float reach = body[i * 3 + 2] + SHIP_RADIUS;
            float dx = boss_hulls[p]->position_x - body[i * 3];
            float dy = boss_hulls[p]->position_y - body[i * 3 + 1];
            if (dx * dx + dy * dy < reach * reach) { bs_hit_pilot(p); break; }
        }
    }
}
static void boss_tick() {
    if (!boss.active) return;
    if (bs_lives_total() < boss.lives_at_start) boss.life_lost = true;
    if (boss.phase == 0) {
        bool entering = bs_entrance();
        bs_kind_update();
        if (entering) return;
    } else {
        bs_kind_update();
        bs_scheduler();
        bs_pickups();
    }
    bs_shots_update();
    bs_hazards_update();
    if (!boss.active) return;
    bs_contact();
#ifdef WEB_TEST
    unsigned corridor = bs_corridor();
    if (corridor < boss.min_corridor) boss.min_corridor = corridor;
#endif
}
// Player shots and the laser against this tick's targets (solo).
static void boss_player_hits(bool laser_fired) {
    if (!boss.active || boss.phase == 0) return;
    if (laser_fired) bs_laser(0);
    bs_build_circles();
    for (Bullet& bullet : bullets) {
        if (!boss.active || boss.phase == 0) break;
        if (!bullet.active) continue;
        int hit = bs_first_circle(bullet.previous_x, bullet.previous_y,
                                  bullet.position_x, bullet.position_y);
        if (hit < 0) continue;
        bullet.active = false;
        bs_circle_hit(hit, 0, 1, false);
        bs_build_circles();
    }
}
static void boss_update(bool laser_fired) {
    if (!boss.active) return;
    boss_tick();
    boss_player_hits(laser_fired);
}

#include "boss_fights.h"
