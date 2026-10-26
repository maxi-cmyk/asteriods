#pragma once
// Fight lifecycle: setup, begin, entrance, contact, the per-tick update.

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
    boss.maximum = base * boss.players * bs_ops_for(kind).k;
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
