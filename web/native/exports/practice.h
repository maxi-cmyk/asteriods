#pragma once
// Practice tools: boss practice, assists and target dummies.
// Included inside bridge.cpp's extern "C" block.

// Boss practice: pick a boss (0-5) or mini-boss (6-11) and a tier. Lives are
// never lost; the fight is the whole room.
void web_boss_practice(int kind, int tier, int phase) {
#ifdef WEB_HD
    coop_active = false;
    boss_bind_solo();
    practice_mode = true;
    practice_goals = 0;
    begin_game();
    combat_reset();
    boss = {};
    boss_begin_practice(constrain(kind, 0, int(BK_COUNT) - 1), constrain(tier, 0, 3));
    if (phase > 1) {
        unsigned top = bs_phases() + (boss.tier >= 2 && !boss.mini ? 1 : 0);
        boss.start_phase = constrain(unsigned(phase), 1u, top);
        boss.health = bs_phase_health(boss.start_phase);
    }
    pending_asteroids = 0;
    ship.invincible_left = 0;
    ship.effects.double_fire_left_ms = 0;
    set_state(STATE_PLAYING);
#else
    (void)kind;
    (void)tier;
    (void)phase;
#endif
}
void web_boss_assist(int longer_warnings, int calm) {
#ifdef WEB_HD
    boss_assist_long = longer_warnings != 0;
    boss_assist_calm = calm != 0;
#else
    (void)longer_warnings;
    (void)calm;
#endif
}
void web_practice_targets() {
#ifdef WEB_HD
    if (practice_mode) {
        practice_targets();
    }
#endif
}
void web_practice_double_fire() {
#ifdef WEB_HD
    if (practice_mode) ship.effects.double_fire_left_ms = 6000;
#endif
}
void web_practice_multishot() {
#ifdef WEB_HD
    if (practice_mode) {
        ship.effects.multishot_left_ms = MULTISHOT_DURATION_MS;
    }
#endif
}
