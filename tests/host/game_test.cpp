// Host gameplay tests: the firmware sources are compiled for the desktop and driven frame
// by frame. Each group lives in its own header; main runs them all.
#include "harness.h"
#include "test_gameplay.h"
#include "test_scoring.h"
#include "test_powerups.h"
#include "test_demo.h"

int main() {
    assert(rock_random_init());
    test_demo_controller();
    test_demo_lifecycle();
    test_unlimited_primary_fire();
    test_multishot_allocation_and_sweep();
    test_pickup_drops_and_collection();
    test_powerup_game_rules();
    test_powerup_input_and_rendering();
    test_hardware_random_ranges();
    test_difficulty_profiles();
    test_deferred_spawns_and_patterns();
    test_scoring_chain();
    test_individual_hit_scoring();
    test_score_versioning();
    test_initials_navigation();
    test_bullet_collisions();
    test_wave_progression();
    test_ship_movement();
    test_bullet_capacity();
    test_spawn_warning();
    test_input_movement_and_firing();
    set_state(STATE_MENU);

    // Exercise a continuous session: fire, pause, die, retry, and save.
    test_fire_input_edges();
    test_pause_state();
    test_respawn_location();
    int expected_writes = test_best_score_and_retry();
    test_joystick_click();
    test_repeated_runs(expected_writes);

    std::cout << "Host gameplay checks passed\n";
}

