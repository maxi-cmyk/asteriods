#include "game.h"
#include "config.h"
#include "input.h"
#include "ship.h"
#include "asteroid.h"
#include "bullet.h"
#include "display.h"
#include "sound.h"
#include "highscore.h"
#include "particle.h"
#include "scoring.h"

static const uint32_t SCORE_MAX = 999999;
static const int COUNTDOWN_START = 3;
static const unsigned long COUNTDOWN_STEP_MS = 500;
static const unsigned long DEATH_ANIMATION_MS = 500;
static const unsigned long RETRY_GUARD_MS = 400;
static const int DEATH_SHAKE_FRAMES = 3;
static const int NORMAL_TEXT_SIZE = 1;
static const int TITLE_TEXT_SIZE = 2;
static const int COUNTDOWN_TEXT_SIZE = 3;

// Text positions are fixed for the 128x64 display.
static const int TITLE_X = 10;
static const int MENU_TITLE_Y = 5;
static const int MENU_BEST_X = 25;
static const int MENU_BEST_Y = 27;
static const int MENU_HINT_X = 4;
static const int MENU_MOVE_Y = 41;
static const int MENU_START_Y = 52;
static const int COUNTDOWN_X = 55;
static const int COUNTDOWN_Y = 22;
static const int PAUSE_BOX_X = 17;
static const int PAUSE_BOX_Y = 24;
static const int PAUSE_BOX_WIDTH = 95;
static const int PAUSE_BOX_HEIGHT = 30;
static const int PAUSE_TITLE_X = 28;
static const int PAUSE_TITLE_Y = 26;
static const int PAUSE_HINT_X = 19;
static const int PAUSE_HINT_Y = 45;
static const int GAME_OVER_TITLE_Y = 4;
static const int SUMMARY_X = 15;
static const int SUMMARY_SCORE_Y = 25;
static const int SUMMARY_BEST_Y = 36;
static const int SUMMARY_RECORD_Y = 46;
static const int SUMMARY_RETRY_Y = 56;

static GameState state = STATE_MENU;
static Ship ship = {};
static unsigned long state_entered_ms = 0;
static unsigned long game_ms = 0;
static uint32_t score = 0;
static bool new_best = false;
static bool retry_ready = false;

static void set_state(GameState next_state) {
    state = next_state;
    state_entered_ms = millis();
}

static void begin_game() {
    ship_init(ship);
    asteroids_init();
    bullets_init();
    particles_init();

    score = 0;
    scoring_reset();
    game_ms = 0;
    new_best = false;
    set_state(STATE_COUNTDOWN);
}

static void draw_world() {
    Adafruit_SSD1306& display = display_get();
    asteroids_draw(display);
    bullets_draw(display);
    particles_draw(display);
    ship_draw(ship, display);

    // Draw the HUD last so effects never obscure the score.
    display.fillRect(0, 0, SCREEN_W, HUD_HEIGHT, SSD1306_BLACK);
    display_hud(ship.lives,
                score,
                scoring_multiplier(),
                scoring_chain_left(game_ms));
}

static void draw_label(int position_x,
                       int position_y,
                       const char *text,
                       int text_size = NORMAL_TEXT_SIZE) {
    Adafruit_SSD1306& display = display_get();
    display.setTextSize(text_size);
    display.setCursor(position_x, position_y);
    display.print(text);
}

static void update_menu(const InputState& input) {
    Adafruit_SSD1306& display = display_get();
    draw_label(TITLE_X, MENU_TITLE_Y, "ASTEROIDS", TITLE_TEXT_SIZE);
    display.setTextSize(NORMAL_TEXT_SIZE);
    display.setCursor(MENU_BEST_X, MENU_BEST_Y);
    display.printf("BEST V3 %lu", (unsigned long)highscore_best());

    draw_label(MENU_HINT_X, MENU_MOVE_Y, "Joystick: move");
    draw_label(MENU_HINT_X, MENU_START_Y, "Fire to start");

    if (input.fire_pressed) {
        sound_play(SFX_MENU_SELECT);
        begin_game();
    }
}

static void update_countdown() {
    Adafruit_SSD1306& display = display_get();
    unsigned long elapsed_ms = millis() - state_entered_ms;
    int countdown_number
            = COUNTDOWN_START - int(elapsed_ms / COUNTDOWN_STEP_MS);

    if (countdown_number > 0) {
        display.setTextSize(COUNTDOWN_TEXT_SIZE);
        display.setCursor(COUNTDOWN_X, COUNTDOWN_Y);
        display.print(countdown_number);
    } else {
        set_state(STATE_PLAYING);
    }
}

static void award_asteroid_score(uint32_t base_points) {
    uint32_t awarded = scoring_award(base_points, game_ms);
    score += min(awarded, SCORE_MAX - score);
}

static void update_playing(const InputState& input) {
    if (input.pause_triggered) {
        sound_stop();
        set_state(STATE_PAUSED);
        draw_world();
        return;
    }

    game_ms += FRAME_TIME_MS;
    scoring_update(game_ms);
    ship_update(ship, input.joystick_x, input.joystick_y);
    asteroids_update(game_ms);

    if (input.fire_pressed
        && bullets_fire(ship.position_x + SHIP_BULLET_OFFSET,
                        ship.position_y)) {
        sound_play(SFX_SHOOT);
    }

    bullets_update();
    bullets_check_asteroids(award_asteroid_score);
    particles_update();

    if (!ship.invincible_left
        && asteroid_hits_ship(ship.position_x, ship.position_y)) {
        ship_die(ship);
        scoring_reset();
        particles_spawn(ship.position_x, ship.position_y);
        sound_play(SFX_DEATH);
        display_shake(DEATH_SHAKE_FRAMES);
        set_state(STATE_DEATH_ANIM);
    }

    draw_world();
}

static void update_paused(const InputState& input) {
    Adafruit_SSD1306& display = display_get();
    draw_world();
    display.fillRect(PAUSE_BOX_X,
                     PAUSE_BOX_Y,
                     PAUSE_BOX_WIDTH,
                     PAUSE_BOX_HEIGHT,
                     SSD1306_BLACK);
    draw_label(PAUSE_TITLE_X, PAUSE_TITLE_Y, "PAUSED", TITLE_TEXT_SIZE);
    draw_label(PAUSE_HINT_X, PAUSE_HINT_Y, "Double-click joy");

    if (input.pause_triggered) {
        set_state(STATE_PLAYING);
    }
}

static void update_death_animation() {
    particles_update();
    draw_world();

    if (millis() - state_entered_ms >= DEATH_ANIMATION_MS) {
        bullets_init();

        if (ship.lives) {
            float respawn_x = SHIP_X;
            float respawn_y = ship.position_y;
            asteroid_safe_respawn(respawn_x, respawn_y);
            ship_respawn(ship, respawn_x, respawn_y);
            set_state(STATE_PLAYING);
        } else {
            new_best = highscore_record(score);
            retry_ready = false;
            sound_stop();
            sound_play(SFX_GAMEOVER);
            set_state(STATE_GAME_OVER);
        }
    }
}

static void update_game_over(const InputState& input) {
    Adafruit_SSD1306& display = display_get();
    draw_label(TITLE_X, GAME_OVER_TITLE_Y, "GAME OVER", TITLE_TEXT_SIZE);
    display.setTextSize(NORMAL_TEXT_SIZE);
    display.setCursor(SUMMARY_X, SUMMARY_SCORE_Y);
    display.printf("SCORE %lu", (unsigned long)score);
    display.setCursor(SUMMARY_X, SUMMARY_BEST_Y);
    display.printf("BEST  %lu", (unsigned long)highscore_best());

    if (new_best) {
        draw_label(SUMMARY_X, SUMMARY_RECORD_Y, "NEW BEST!");
    }

    draw_label(SUMMARY_X, SUMMARY_RETRY_Y, "Fire to retry");

    if (!input.fire_held && millis() - state_entered_ms >= RETRY_GUARD_MS) {
        retry_ready = true;
    }

    if (retry_ready && input.fire_pressed) {
        begin_game();
    }
}

void game_init() {
    highscore_init();
    set_state(STATE_MENU);
}

GameState game_get_state() {
    return state;
}

void game_update() {
    const InputState& input = input_get();
    Adafruit_SSD1306& display = display_get();
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(NORMAL_TEXT_SIZE);

    switch (state) {
    case STATE_MENU:
        update_menu(input);
        break;
    case STATE_COUNTDOWN:
        update_countdown();
        break;
    case STATE_PLAYING:
        update_playing(input);
        break;
    case STATE_PAUSED:
        update_paused(input);
        break;
    case STATE_DEATH_ANIM:
        update_death_animation();
        break;
    case STATE_GAME_OVER:
        update_game_over(input);
        break;
    }

    display_shake_update();
    display_flip();
}
