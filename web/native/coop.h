#pragma once

// Browser-only co-op. Shared legacy globals are a scratch context, never a
// second world: load/save only player-owned fields around existing combat APIs.
struct CoopPlayer {
    Ship hull = {};
    CombatState weapons = {};
    CombatInput actions = {};
    InputState input = {};
    ScoringState chain = {1, 0, false, 0};
    Bullet shots[BULLET_MAX] = {};
    uint32_t points = 0;
    uint32_t kills = 0;
    unsigned best = 1;
    unsigned long respawn_at = 0;
    unsigned boss_participation = 0;
    bool boss_touched = false;
    bool laser_fired = false;
};
static bool coop_active = false;
static bool coop_friendly = false;
static CoopPlayer coop_players[2] = {};
static unsigned coop_tick = 0;
static unsigned coop_owner = 0;
static GameState coop_pause_state = STATE_PLAYING;
static unsigned long coop_paused_at = 0;

static void coop_load(unsigned owner) {
    coop_owner = owner;
    const CoopPlayer& player = coop_players[owner];
    ship = player.hull;
    combat = player.weapons;
    combat_input = player.actions;
    input_state = player.input;
    score_state = player.chain;
    score = player.points;
    run_destroyed = player.kills;
    run_best_multiplier = player.best;
    memcpy(bullets, player.shots, sizeof(bullets));
}
static void coop_save() {
    CoopPlayer& player = coop_players[coop_owner];
    player.hull = ship;
    player.weapons = combat;
    player.chain = score_state;
    player.points = score;
    player.kills = run_destroyed;
    player.best = run_best_multiplier;
    memcpy(player.shots, bullets, sizeof(bullets));
}
static void coop_hit(unsigned owner) {
    CoopPlayer& player = coop_players[owner];
    if (!player.hull.alive || player.hull.invincible_left) return;
    if (player.hull.effects.shield) {
        player.hull.effects.shield = false;
        player.hull.invincible_left = SHIELD_PROTECTION_MS;
        return;
    }
    ship_die(player.hull);
    player.respawn_at = game_ms + DEATH_ANIMATION_MS;
    player.weapons.charging = false;
    player.weapons.beam_left_ms = 0;
    player.weapons.shield_stored = false;
    player.weapons.chain = 0;
    memset(player.weapons.pending_shots, 0,
           sizeof(player.weapons.pending_shots));
    memset(player.shots, 0, sizeof(player.shots));
    score_reset(&player.chain);
    particles_spawn(player.hull.position_x, player.hull.position_y);
    sound_play(SFX_DEATH);
}
static void coop_bind_boss();
static void coop_begin(bool friendly) {
    begin_game();
    coop_active = true;
    coop_friendly = friendly;
    coop_tick = 0;
    boss = {};
    coop_bind_boss();
    practice_mode = false;
    for (unsigned i = 0; i < 2; i++) {
        coop_players[i] = {};
        ship_init(coop_players[i].hull);
        coop_players[i].hull.position_y = 95 + i * 80;
        score_reset(&coop_players[i].chain);
    }
    coop_load(0);
}
// Circle entry time, not closest-point distance: blocking friendlies cannot
// be skipped in favour of a farther enemy at high projectile speed.
static float coop_entry(const Bullet& bullet, float x, float y, float radius) {
    float dx = bullet.position_x - bullet.previous_x;
    float dy = bullet.position_y - bullet.previous_y;
    float ox = bullet.previous_x - x;
    float oy = bullet.previous_y - y;
    float outside = ox * ox + oy * oy - radius * radius;
    if (outside <= 0) return 0;
    float length = dx * dx + dy * dy;
    float projection = ox * dx + oy * dy;
    float disc = projection * projection - length * outside;
    if (!length || disc < 0) return 2;
    float entry = (-projection - sqrtf(disc)) / length;
    return entry >= 0 && entry <= 1 ? entry : 2;
}
static void coop_award(unsigned owner, uint32_t points, bool sentinel = false) {
    coop_load(owner);
    combat_award(points);
    if (sentinel) run_destroyed--;
    coop_save();
}
static void coop_boss_hit(unsigned owner) { coop_hit(owner); }
static void coop_boss_stat(unsigned owner) { coop_players[owner].weapons.hits++; }
static void coop_boss_award(unsigned owner, uint32_t points) {
    for (unsigned i = 0; i < 2; i++) {
        coop_players[i].boss_participation += boss.touched[i];
        coop_players[i].boss_touched = false;
    }
    coop_award(owner, points, true);
}
static void coop_bind_boss() {
    boss_hulls[0] = &coop_players[0].hull;
    boss_hulls[1] = &coop_players[1].hull;
    boss_hull_n = 2;
    boss_hit_hook = coop_boss_hit;
    boss_award_hook = coop_boss_award;
    boss_stat_hook = coop_boss_stat;
}
static void coop_rock(unsigned owner, int index, bool laser) {
    if (!rocks[index].active) return;
    Asteroid parent = rocks[index];
    // Match existing atomic split failure when the shared rock pool is full.
    if (!laser && parent.size != AST_SMALL && free_slots() < 1) return;
    rocks[index].active = false;
    particles_spawn(parent.position_x, parent.position_y);
    coop_award(owner, asteroid_points(parent.size));
    if (laser) coop_players[owner].weapons.laser_kills++;
    powerups_drop(parent.position_x, parent.position_y);
    // Fragments are created after all tick collisions, below.
}
struct CoopImpact {
    float time;
    unsigned owner;
    unsigned shot;
    int target; // rock index; -1 teammate; -2 sentinel
};
static void coop_projectiles() {
    bool original[ASTEROID_MAX] = {};
    Asteroid parents[ASTEROID_MAX] = {};
    bool split[ASTEROID_MAX] = {};
    for (int r = 0; r < ASTEROID_MAX; r++) {
        original[r] = rocks[r].active;
        parents[r] = rocks[r];
    }
    unsigned pending_fragments = 0;
    bs_build_circles();
    // Resolve globally earliest eligible impacts. Recompute after destruction
    // so a second shot may continue to its next target, but never a new fragment.
    for (unsigned event = 0; event < 2 * BULLET_MAX; event++) {
        CoopImpact best = {2, 0, 0, -3};
        for (unsigned order = 0; order < 2; order++) {
            unsigned p = (order + coop_tick) % 2;
            for (unsigned b = 0; b < BULLET_MAX; b++) {
                const Bullet& bullet = coop_players[p].shots[b];
                if (!bullet.active) continue;
                for (unsigned c = 0; c < boss_circle_count; c++) {
                    if (!(boss_circles[c].flags & 1)) continue;
                    float entry = bs_entry(c, bullet.previous_x, bullet.previous_y,
                                           bullet.position_x, bullet.position_y);
                    if (entry < best.time) best = {entry, p, b, int(1000 + c)};
                }
                for (int r = -1; r < ASTEROID_MAX; r++) {
                    float entry = 2;
                    if (r == -1 && coop_friendly &&
                               coop_players[1-p].hull.alive) {
                        const Ship& other = coop_players[1-p].hull;
                        entry = coop_entry(bullet, other.position_x,
                                           other.position_y, SHIP_RADIUS);
                    } else if (r >= 0 && original[r] && rocks[r].active) {
                        entry = coop_entry(bullet, rocks[r].position_x,
                                           rocks[r].position_y, rocks[r].radius);
                    }
                    if (entry < best.time) best = {entry, p, b, r};
                }
            }
        }
        if (best.time > 1) break;
        coop_players[best.owner].shots[best.shot].active = false;
        if (best.target == -1) coop_hit(1-best.owner);
        else if (best.target >= 1000) {
            bs_circle_hit(best.target - 1000, best.owner, 1, false);
            bs_build_circles();
        } else {
            if (best.target >= 0 && rocks[best.target].size != AST_SMALL &&
                free_slots() < 1 + int(pending_fragments)) continue;
            coop_players[best.owner].weapons.hits++;
            split[best.target] = parents[best.target].size != AST_SMALL;
            coop_rock(best.owner, best.target, false);
            if (split[best.target]) pending_fragments += 2;
        }
    }
    for (int r = 0; r < ASTEROID_MAX; r++) {
        if (split[r]) split_asteroid(parents[r]);
    }
    for (CoopPlayer& player : coop_players) {
        for (Bullet& bullet : player.shots) {
            if (bullet.position_x < 0 || bullet.position_x >= SCREEN_W ||
                bullet.position_y < 0 || bullet.position_y >= SCREEN_H) {
                bullet.active = false;
            }
        }
    }
}
static void coop_lasers() {
    for (unsigned order = 0; order < 2; order++) {
        unsigned owner = (order + coop_tick) % 2;
        if (!coop_players[owner].laser_fired || !coop_players[owner].hull.alive) continue;
        coop_load(owner);
        bool targets[ASTEROID_MAX] = {};
        for (int r = 0; r < ASTEROID_MAX; r++) {
            targets[r] = rocks[r].active && combat_beam_hits(rocks[r]);
        }
        Asteroid friend_target = {};
        friend_target.position_x = coop_players[1-owner].hull.position_x;
        friend_target.position_y = coop_players[1-owner].hull.position_y;
        friend_target.radius = SHIP_RADIUS;
        bool friendly = coop_friendly && combat_beam_hits(friend_target);
        for (int r = 0; r < ASTEROID_MAX; r++) {
            if (targets[r]) coop_rock(owner, r, true);
        }
        if (boss.active) bs_laser(owner);
        if (friendly) coop_hit(1-owner);
    }
}
static void coop_pickup_update() {
    collection_cue_left -= min(collection_cue_left,
                              (unsigned long)FRAME_TIME_MS);
    if (!pickup.active) return;
    pickup.position_x -= PICKUP_SPEED;
    if (pickup.position_x + PICKUP_RADIUS < 0) pickup.active = false;
    if (!pickup.active) return;
    int collector = -1;
    float nearest = (PICKUP_RADIUS + SHIP_RADIUS) *
                    (PICKUP_RADIUS + SHIP_RADIUS) + 0.01f;
    for (unsigned order = 0; order < 2; order++) {
        unsigned p = (order + coop_tick) % 2;
        const Ship& hull = coop_players[p].hull;
        float dx = hull.position_x - pickup.position_x;
        float dy = hull.position_y - pickup.position_y;
        float distance = dx * dx + dy * dy;
        if (hull.alive && distance < nearest) {
            nearest = distance;
            collector = p;
        }
    }
    if (collector < 0) return;
    CoopPlayer& player = coop_players[collector];
    if (pickup.kind == PICKUP_SHIELD) {
        if (!player.hull.effects.shield) player.weapons.shield_stored = true;
        collection_x = pickup.position_x;
        collection_y = pickup.position_y;
        collection_cue_left = PICKUP_CUE_MS;
        pickup.active = false;
    } else collect_pickup(player.hull);
}
static void coop_weapons(unsigned owner) {
    coop_load(owner);
    CoopPlayer& player = coop_players[owner];
    player.laser_fired = false;
    bool pressed = combat_input.laser && !combat.laser_was_held;
    combat.laser_was_held = combat_input.laser;
    if (!ship.alive) { coop_save(); return; }
    score_update(&score_state, game_ms);
    combat_update_aim();
    combat_move_ship(input_state);
    ship.effects.multishot_left_ms -= min(ship.effects.multishot_left_ms,
                                         (unsigned long)FRAME_TIME_MS);
    ship.effects.double_fire_left_ms -= min(ship.effects.double_fire_left_ms,
                                           (unsigned long)FRAME_TIME_MS);
    if (combat_input.shield && combat.shield_stored) {
        ship.effects.shield = true;
        combat.shield_stored = false;
    }
    // Defer laser damage to the shared collision phase.
    combat.cooldown_left_ms -= min(combat.cooldown_left_ms,
                                  (unsigned long)FRAME_TIME_MS);
    combat.beam_left_ms -= min(combat.beam_left_ms,
                              (unsigned long)FRAME_TIME_MS);
    if (pressed && !combat.cooldown_left_ms) {
        combat.charging = true;
        combat.charge_started_ms = game_ms;
    }
    if (!combat_input.laser) combat.charging = false;
    if (combat.charging && game_ms - combat.charge_started_ms >= LASER_WINDUP_MS) {
        combat.charging = false;
        combat.laser_shots++;
        combat.cooldown_left_ms = LASER_COOLDOWN_MS;
        combat.beam_left_ms = LASER_BEAM_MS;
        combat.beam_x = ship.position_x + combat.aim_x * SHIP_BULLET_OFFSET;
        combat.beam_y = ship.position_y + combat.aim_y * SHIP_BULLET_OFFSET;
        combat.beam_direction_x = combat.aim_x;
        combat.beam_direction_y = combat.aim_y;
        player.laser_fired = true;
    }
    combat_update_cps(input_state.fire_pressed);
    combat.highest_wave = max(combat.highest_wave, unsigned(wave_number));
    for (unsigned long& due : combat.pending_shots) {
        if (due && game_ms >= due) {
            due = 0;
            if (!combat.charging && !player.laser_fired) combat_primary_event();
            else combat.primary_laser_blocked++;
        }
    }
    if (input_state.fire_pressed) {
        combat.primary_presses++;
        if (combat.charging || player.laser_fired) combat.primary_laser_blocked++;
        if (!combat.charging && !player.laser_fired) {
            combat_primary_event();
            if (ship.effects.double_fire_left_ms) {
                for (unsigned long& due : combat.pending_shots) {
                    if (!due) { due = game_ms + 80; break; }
                }
            }
        }
    }
    bullets_update();
    coop_save();
}
static void coop_boss_update() {
    if (boss.active) boss_tick();
}
static void coop_respawn(unsigned p) {
    CoopPlayer& player = coop_players[p];
    if (player.hull.alive || !player.hull.lives || game_ms < player.respawn_at) return;
    float x = SHIP_X;
    float y = 95 + p * 80;
    asteroid_safe_respawn(x, y);
    if (boss.active) {
        float best_clearance = -10000;
        float body[96];
        unsigned bodies = bs_kind_body(body);
        for (int candidate_x = SHIP_MIN_X; candidate_x <= 160; candidate_x += 24) {
            for (int candidate_y = SHIP_MIN_Y; candidate_y <= SHIP_MAX_Y; candidate_y += 16) {
                float clearance = respawn_clearance(candidate_x, candidate_y);
                for (unsigned i = 0; i < bodies; i++)
                    clearance = min(clearance, bs_dist(candidate_x, candidate_y, body[i*3], body[i*3+1])
                                               - body[i*3+2] - SHIP_RADIUS);
                for (const BossHazard& h : boss.hz)
                    if (h.active && bs_lethal_kind(h.kind) && h.warn_left <= 1500 &&
                        bs_hazard_hits(h, candidate_x, candidate_y, SHIP_RADIUS + 6))
                        clearance = min(clearance, -1.0f);
                for (const BossShot& shot : boss.shots) {
                    if (!shot.active) continue;
                    clearance = min(clearance, bs_dist(candidate_x, candidate_y, shot.x, shot.y) - 11);
                }
                if (clearance > best_clearance) {
                    best_clearance = clearance;
                    x = candidate_x;
                    y = candidate_y;
                }
            }
        }
    }
    ship_respawn(player.hull, x, y, game_ms);
    player.weapons.laser_was_held = player.actions.laser;
}
static void coop_update() {
    if (state == STATE_PAUSED) return;
    if (state == STATE_COUNTDOWN) {
        if (browser_ms - state_entered_ms >= COUNTDOWN_START * COUNTDOWN_STEP_MS)
            set_state(STATE_PLAYING);
        return;
    }
    if (state != STATE_PLAYING) return;
    game_ms += FRAME_TIME_MS;
    coop_tick++;
    if (boss.wave != wave_number && boss_wave_is_boss(wave_number))
        for (CoopPlayer& player : coop_players) player.boss_touched = false;
    if (!boss_controls_wave(2)) asteroids_update(game_ms);
    for (unsigned p = 0; p < 2; p++) {
        coop_respawn(p);
        coop_weapons(p);
    }
    coop_pickup_update();
    coop_boss_update();
    coop_lasers();
    coop_projectiles();
    for (unsigned p = 0; p < 2; p++) {
        if (asteroid_hits_ship(coop_players[p].hull.position_x,
                               coop_players[p].hull.position_y)) coop_hit(p);
    }
    particles_update();
    display_shake_update();
    if (!coop_players[0].hull.lives && !coop_players[1].hull.lives) {
        sound_stop();
        sound_play(SFX_GAMEOVER);
        set_state(STATE_GAME_OVER);
    }
    coop_load(0);
}
