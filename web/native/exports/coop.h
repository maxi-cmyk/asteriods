#pragma once
// Local co-op ABI version 1: two inputs, one read-only scene per player.
// Included inside bridge.cpp's extern "C" block.

// Co-op ABI version 1: two independent inputs, legacy read-only player scenes.
void web_coop_start(int friendly) {
#ifdef WEB_HD
    coop_begin(friendly != 0);
#endif
}
void web_coop_pause(int pause) {
#ifdef WEB_HD
    if (!coop_active) return;
    if (pause && (state == STATE_PLAYING || state == STATE_COUNTDOWN)) {
        coop_pause_state = state;
        coop_paused_at = browser_ms - state_entered_ms;
        set_state(STATE_PAUSED);
    } else if (!pause && state == STATE_PAUSED) {
        state = coop_pause_state;
        // Countdown elapsed before pause is stored separately below.
        state_entered_ms = browser_ms - coop_paused_at;
    }
#endif
}
void web_coop_input(int owner, float x, float y, int fire, float aim_x,
                    float aim_y, int laser, int precision, int shield) {
#ifdef WEB_HD
    if (owner < 0 || owner > 1 || !coop_active) return;
    auto finite_axis = [](float value) {
        return __builtin_isfinite(value) ? constrain(value, -1.0f, 1.0f) : 0.0f;
    };
    CoopPlayer& player = coop_players[owner];
    player.input = {};
    player.input.joystick_x = finite_axis(x);
    player.input.joystick_y = finite_axis(y);
    player.input.fire_pressed = fire != 0;
    player.actions = {finite_axis(aim_x), finite_axis(aim_y), bool(laser),
                      bool(precision), bool(shield)};
    if (state == STATE_PAUSED && !laser) player.weapons.charging = false;
#endif
}
const float *web_coop_player(int owner) {
    static float snapshot[SCENE_FLOATS];
#ifdef WEB_HD
    if (coop_active && owner >= 0 && owner < 2) {
        coop_load(owner);
        memcpy(snapshot, web_scene(), sizeof(snapshot));
        snapshot[SCENE_COOP_VERSION] = 1; // ABI version
        snapshot[SCENE_COOP_ID] = owner;
        snapshot[SCENE_COOP_RESPAWN_AT] = coop_players[owner].respawn_at;
        snapshot[SCENE_COOP_PARTICIPATION] = coop_players[owner].boss_participation;
        snapshot[SCENE_COOP_TEAM_SCORE] = coop_players[0].points + coop_players[1].points;
        snapshot[SCENE_COOP_FRIENDLY_FIRE] = coop_friendly;
        // Statistics share the existing stats field ordering.
        memcpy(snapshot + SCENE_COOP_STATS_AT, web_stats(), SCENE_COOP_STATS_COUNT * sizeof(float));
        coop_load(0);
    }
#endif
    return snapshot;
}
