#pragma once
// Hit targets: circles, damage, defeat, player shots and the laser.

// ---------------------------------------------------------------- circles
static void bs_circle(float x, float y, float r, uint8_t type, uint8_t index = 0, uint8_t flags = 3) {
    if (boss_circle_count >= BOSS_CIRCLES) return;
    boss_circle_count++;
    boss_circles[boss_circle_count - 1] = {x, y, r, type, index, flags};
}

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
    bs_damage(owner, bs_kind_soak(damage, laser));
}
// Resolve one player shot or laser touching a circle.
static void bs_circle_hit(unsigned index, unsigned owner, unsigned damage, bool laser) {
    if (index >= boss_circle_count) return;
    const BossCircle c = boss_circles[index];
    if (c.type == BC_BLOCK) return;
    boss_stat_hook(owner);
    if (c.type == BC_CORE)
        bs_core_damage(owner, laser ? damage * bs_ops().k : damage, laser);
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
