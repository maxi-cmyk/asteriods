#pragma once
// Boss framework: constants, enums, state, pilots, maths and the shot/hazard/part pools.

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
    HK_TELL, HK_ARC, HK_AIM, HK_PULL,                   // warnings and forces
    HK_BURN                                             // scorched ground: burns whoever stands in it
};
enum PartKind : uint8_t { PK_BLADE, PK_PANEL, PK_HARD, PK_BUBBLE, PK_STAR, PK_ORB };
// BC_DEFLECT throws player shots and the laser back at whoever fired them.
enum CircleType : uint8_t { BC_CORE, BC_BLOCK, BC_PART, BC_SHOT, BC_DEFLECT };
enum {
    SA_LANCE = 1, SA_FAN, SA_VOLLEY, SA_CROSS,
    RA_BURST = 10, RA_PRISM, RA_PICK, RA_COLLAPSE,
    CA_LOB = 20, CA_JETS, CA_EMBER, CA_NOVA, CA_HAMMER, CA_BARRAGE, CA_GEYSER, CA_VENT,
    BA_CANNON = 30, BA_MISSILE, BA_MINES, BA_BROAD,
    TA_SINE = 40, TA_TENDRIL, TA_SPORE, TA_PULSE, TA_WALL, TA_RAIN, TA_WHIRL,
    WA_SPIRAL = 50, WA_CURVE, WA_ACCRETE, WA_PULL, WX_BURST, WX_JETS, WX_NOVA, WX_CLOAK,
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
    float scratch[8] = {};        // per-attack randomness; only one attack runs at a time
    unsigned long stamp[6] = {};
    bool touched[2] = {};
    unsigned killer = 0;
    bool life_lost = false;
    unsigned lives_at_start = 0;
    uint8_t drops = 0;
    unsigned long shield_at = 0;  // Ringwarden: when the next timed shield drops
    unsigned long deflect_at[2] = {};  // per pilot: when a mirror may throw the next shot back
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

// How one kind of boss differs. Every fight family (boss/fights/*.h) supplies a row per
// kind; the framework never switches on the kind itself. Hooks marked "may be null" are
// skipped when absent. Health is stated in design hits (nextSteps.md); `k` splits each into
// sub-hits so the open windows, not raw fire rate, set the fight length: a primary shot is
// one sub-hit, the laser stays worth eight design hits.
struct BossOps {
    float home_x, home_y;           // where the body rests once the entrance is over
    uint8_t k;                      // sub-hits per design hit
    uint8_t phases;                 // phases before the tier 2+ frenzy
    uint8_t cut[2];                 // health percentages where phases 2 and 3 begin (0 = none)
    unsigned rest[3];               // rest between attacks in phases 1, 2, 3+ (ms)
    void (*begin)();                // parts and state at the start (may be null)
    void (*update)();               // passive motion each tick
    int (*pick)();                  // the next attack id, 0 for none
    bool (*run)(int id, unsigned long t);   // advance an attack; true when it is over
    void (*circles)();              // hit circles for player shots (bs_circle)
    unsigned (*body)(float *out);   // contact circles for the ship: x, y, r triples
    void (*phase)(unsigned phase);  // a new phase began (may be null)
    unsigned (*soak)(unsigned damage, bool laser);  // armour in front of the core (may be null)
    void (*hit)(BossPart& part, unsigned owner, unsigned damage, bool laser); // sub-target (may be null)
};
static const BossOps& bs_ops_for(unsigned kind);   // boss/ops.h
static const BossOps& bs_ops();                    // the current fight's row

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
