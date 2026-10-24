#pragma once

// One region-closing sentinel on waves 5, 10, ... . Player count is latched
// at entry; the current solo mode always supplies one player.
static const unsigned long BOSS_ENTRANCE_MS = 1200;
static const unsigned long BOSS_WARNING_MS = 900;
static const unsigned long BOSS_ATTACK_MS = 320;
static const unsigned long BOSS_REST_MS = 950;
static const unsigned long BOSS_RECOVERY_MS = 1200;
static const float BOSS_X = 414;
static const float BOSS_Y = 135;
static const float BOSS_CORE_RADIUS = 18;

struct BossShot {
    bool active = false;
    float x = 0;
    float y = 0;
    float dx = 0;
    float dy = 0;
};
struct BossState {
    bool active = false;
    unsigned wave = 0;
    unsigned players = 1;
    unsigned health = 0;
    unsigned maximum = 0;
    unsigned kills = 0;
    unsigned cycle = 0;
    unsigned phase = 0;
    unsigned long phase_started = 0;
    unsigned long defeated = 0;
    float target_x = 40;
    float target_y = BOSS_Y;
    BossShot shots[6] = {};
};
static BossState boss = {};
static void combat_ship_hit();

static void boss_begin(unsigned players = 1) {
    unsigned kills = boss.kills;
    boss = {};
    boss.kills = kills;
    boss.active = true;
    boss.wave = wave_number;
    boss.players = constrain(players, 1u, 2u);
    unsigned level = min(10u, unsigned(wave_number / 5));
    boss.maximum = (18 + 6 * (level - 1)) * boss.players;
    boss.health = boss.maximum;
    boss.phase_started = game_ms;
    pending_asteroids = 0;
    memset(rocks, 0, sizeof(rocks));
    waiting_for_next_wave = false;
}
static bool boss_controls_wave() {
    if (practice_mode || wave_number % 5) return false;
    if (boss.wave != wave_number) boss_begin();
    return boss.active || game_ms - boss.defeated < BOSS_RECOVERY_MS;
}
static void boss_damage(unsigned damage) {
    if (!boss.active || boss.phase == 0) return;
    boss.health = damage >= boss.health ? 0 : boss.health - damage;
    if (boss.health) return;
    boss.active = false;
    boss.defeated = game_ms;
    boss.kills++;
    for (BossShot& shot : boss.shots) shot.active = false;
    // One kill event uses the existing capped x5 multiplier. No per-hit points.
    uint32_t base = 1500 + min(10u, boss.wave / 5) * 250;
    combat_award(base);
    run_destroyed--; // Boss kills have their own counter, not asteroid kills.
    particles_spawn(BOSS_X, BOSS_Y);
    sound_play(SFX_ASTEROID_LARGE);
    display_shake(2);
}
static void boss_fan() {
    float aim_x = boss.target_x - BOSS_X;
    float aim_y = boss.target_y - BOSS_Y;
    float length = max(1.0f, sqrtf(aim_x * aim_x + aim_y * aim_y));
    aim_x /= length;
    aim_y /= length;
    for (int i = 0; i < 3; i++) {
        float spread = (i - 1) * .28f;
        boss.shots[i] = {true, BOSS_X, BOSS_Y,
                         (aim_x * cosf(spread) - aim_y * sinf(spread)) * 2.2f,
                         (aim_x * sinf(spread) + aim_y * cosf(spread)) * 2.2f};
    }
}
static void boss_update_phase() {
    unsigned long elapsed = game_ms - boss.phase_started;
    unsigned duration = boss.phase == 0 ? BOSS_ENTRANCE_MS
                        : boss.phase == 1 ? BOSS_WARNING_MS
                        : boss.phase == 2 ? BOSS_ATTACK_MS : BOSS_REST_MS;
    if (elapsed >= duration) {
        boss.phase = boss.phase == 3 ? 1 : boss.phase + 1;
        boss.phase_started = game_ms;
        if (boss.phase == 1) {
            boss.target_x = ship.position_x;
            boss.target_y = ship.position_y;
        }
        if (boss.phase == 2 && boss.cycle % 2) boss_fan();
        if (boss.phase == 3) boss.cycle++;
    }
}
static void boss_hit_projectiles(bool laser_fired) {
    if (laser_fired && boss.active) {
        Asteroid core = {};
        core.position_x = BOSS_X;
        core.position_y = BOSS_Y;
        core.radius = BOSS_CORE_RADIUS;
        if (combat_beam_hits(core)) boss_damage(8);
    }
    for (Bullet& bullet : bullets) {
        if (!boss.active || boss.phase == 0 || !bullet.active) continue;
        float dx = bullet.position_x - bullet.previous_x;
        float dy = bullet.position_y - bullet.previous_y;
        float length = dx * dx + dy * dy;
        float t = length ? ((BOSS_X - bullet.previous_x) * dx
                            + (BOSS_Y - bullet.previous_y) * dy) / length : 0;
        t = constrain(t, 0.0f, 1.0f);
        float x = bullet.previous_x + t * dx - BOSS_X;
        float y = bullet.previous_y + t * dy - BOSS_Y;
        if (x * x + y * y <= BOSS_CORE_RADIUS * BOSS_CORE_RADIUS) {
            bullet.active = false;
            combat.hits++;
            boss_damage(1);
        }
    }
}
static void boss_attack_collisions() {
    bool hit = boss.phase == 2 && !(boss.cycle % 2)
               && ship.position_x < BOSS_X
               && fabsf(ship.position_y - boss.target_y) < 9 + SHIP_RADIUS;
    float body_x = ship.position_x - BOSS_X;
    float body_y = ship.position_y - BOSS_Y;
    hit |= body_x * body_x + body_y * body_y
           < (BOSS_CORE_RADIUS + SHIP_RADIUS)
             * (BOSS_CORE_RADIUS + SHIP_RADIUS);
    for (BossShot& shot : boss.shots) {
        if (!shot.active) continue;
        shot.x += shot.dx;
        shot.y += shot.dy;
        if (shot.x < -8 || shot.x > SCREEN_W + 8
            || shot.y < -8 || shot.y > SCREEN_H + 8) shot.active = false;
        float x = shot.x - ship.position_x;
        float y = shot.y - ship.position_y;
        if (shot.active && x * x + y * y < 121) {
            shot.active = false;
            hit = true;
        }
    }
    if (hit) combat_ship_hit();
}

static void boss_update(bool laser_fired) {
    if (!boss.active) {
        return;
    }
    boss_update_phase();
    boss_hit_projectiles(laser_fired);
    if (boss.active && boss.phase != 0) {
        boss_attack_collisions();
    }
}
