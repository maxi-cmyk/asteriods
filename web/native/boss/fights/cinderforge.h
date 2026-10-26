#pragma once
// Cinderforge and Cinderling

// ================================================================ CINDERFORGE / CINDERLING
static const BossRow SEQ_FORGE[] = {{2, CA_LOB, CA_LOB},
                                    {4, CA_LOB, CA_JETS, CA_EMBER, CA_JETS},
                                    {4, CA_NOVA, CA_LOB, CA_JETS, CA_EMBER}};
static const BossRow SEQ_CINDERLING[] = {{1, CA_LOB}};
static float bs_panel_angle(unsigned i) { return BOSS_PI + (i - 3.5f) * .32f; }
static void bs_forge_begin() {
    for (unsigned i = 0; i < 8; i++) {
        BossPart& p = boss.parts[i];
        p = {};
        p.exists = true; p.kind = PK_PANEL; p.slot = i; p.hp = p.hp_max = 3; p.r = 16;
    }
    boss.aux[0] = .5f;
}
static unsigned bs_broken_panels() {
    unsigned n = 0;
    for (unsigned i = 0; i < 8; i++) n += boss.parts[i].state == 2;
    return n;
}
static void bs_forge_update() {
    boss.aux[0] = .45f + .12f * (boss.phase > 1) + .12f * (boss.phase > 2) + .04f * sinf(bs_since(boss.born) / 300.0f);
    boss.aux[1] = game_ms < boss.stamp[0] ? 1.0f : 0.0f;
    for (unsigned i = 0; i < 8; i++) {
        BossPart& p = boss.parts[i];
        float a = bs_panel_angle(i);
        p.x = boss.x + cosf(a) * 108;
        p.y = boss.y + sinf(a) * 108;
        if (p.state == 1 && game_ms >= p.until) p.state = 0;
    }
}
static void bs_lob(float tx, float ty, float sx, float sy) {
    tx = bs_clamp(tx, 36, 330);
    ty = bs_clamp(ty, 36, 240);
    BossShot *s = bs_shot(SF_LOB, sx, sy, (tx - sx) / 60, (ty - sy) / 60, 1, 1200);
    BossHazard *h = bs_hazard(HK_POOL, tx, ty, 0, 0, 22, 1200, 4000);
    if (s && h) s->link = bs_hazard_index(h);
    else if (s && !h) s->active = false;
    else if (h && !s) h->active = false;
}
static bool bs_forge_run(int id, unsigned long t) {
    float mx = boss.x - 100, my = boss.y;
    switch (id) {
    case CA_LOB: {
        unsigned n = boss.mini ? 1 : (boss.phase == 1 ? 1 : 2);
        for (unsigned k = 0; k < n; k++)
            if (bs_at(t, k * 500)) {
                float px = boss.target_x, py = boss.target_y;
                if (k) bs_nearest(mx, my, px, py);
                bs_lob(px, py, mx, my - 30 + k * 36);
                if (boss.mini) boss.stamp[0] = game_ms + 2300;
            }
        return t >= (n - 1) * 500 + 1300;
    }
    case CA_JETS:
        if (bs_at(t, 0)) {
            int picks[5];
            unsigned n = 0, want = 3 + bs_broken_panels();
            if (want > 4) want = 4;
            for (unsigned i = 0; i < 8 && n < want; i++)  // broken panels fire first
                if (boss.parts[i].state == 2) picks[n++] = i;
            for (unsigned tries = 0; tries < 40 && n < want; tries++) {
                int c = rock_random_bounded(8);
                bool ok = boss.parts[c].state != 2;
                for (unsigned j = 0; j < n; j++) if (abs(picks[j] - c) < 2) ok = false;
                if (ok) picks[n++] = c;
            }
            for (unsigned j = 0; j < n; j++) {
                BossPart& p = boss.parts[picks[j]];
                if (p.state == 0) { p.state = 1; p.until = game_ms + 2900; }
                float a = bs_panel_angle(picks[j]);
                bs_hazard(HK_LANE, p.x, p.y, a, 420, 14, 900, 500);
            }
        }
        return t >= 1500;
    case CA_EMBER: {
        float ang = bs_angle_to(mx, my, boss.target_x, boss.target_y);
        unsigned n = bs_density(7);
        if (bs_at(t, 0)) bs_hazard(HK_ARC, mx, my, ang, .6f, 190, 600, 0);
        if (bs_at(t, 600))
            for (unsigned i = 0; i < n; i++)
                bs_shot_at(SF_EMBER, mx, my, ang + (i - (n - 1) / 2.0f) * .2f, 2.4f);
        return t >= 700;
    }
    case CA_NOVA:
        if (bs_at(t, 0)) {
            float gap = bs_angle_to(boss.x, boss.y, boss.target_x, boss.target_y) + (boss.cycle % 2 ? .9f : -.9f);
            BossHazard *h = bs_hazard(HK_RING, boss.x, boss.y, gap, 120, .52f, 1000, 4200);
            if (h) { h->d = 2.0f; h->e = 0; }
            bs_hazard(HK_TELL, boss.x, boss.y, 0, 132, 0, 1000, 0);
        }
        if (bs_at(t, 1000)) {
            for (unsigned i = 0; i < 8; i += 2) {
                BossPart& p = boss.parts[i];
                if (p.state != 2) { p.state = 2; bs_particles(p.x, p.y); }
            }
            boss.stamp[0] = game_ms + 2000;
            display_shake(2);
        }
        return t >= 1100;
    }
    return true;
}

static int bs_forge_pick() { return bs_seq_pick(SEQ_FORGE, 3); }
// A lob in the air or a pool burning keeps the little forge from lobbing again.
static int bs_cinderling_pick() {
    for (const BossHazard& h : boss.hz) if (h.active && h.kind == HK_POOL) return 0;
    for (const BossShot& s : boss.shots) if (s.active && s.family == SF_LOB) return 0;
    return CA_LOB;
}
static void bs_cinderling_update() {
    boss.aux[0] = .5f + .1f * sinf(bs_since(boss.born) / 260.0f);
    boss.aux[1] = game_ms < boss.stamp[0] ? 1.0f : 0.0f;
}
static void bs_forge_circles() {
    if (game_ms < boss.stamp[0]) bs_circle(boss.x, boss.y, 34, BC_CORE, 0, 3);
    else {
        for (unsigned i = 0; i < 8; i++)
            bs_circle(boss.parts[i].x, boss.parts[i].y, 16, BC_PART, i, 1);
        bs_circle(boss.x, boss.y, 114, BC_BLOCK, 0, 1);
        bs_circle(boss.x, boss.y, 34, BC_CORE, 0, 2); // the laser pierces the shell
    }
}
static void bs_cinderling_circles() {
    if (boss.aux[1] > .5f) bs_circle(boss.x, boss.y, 24, BC_CORE, 0, 3);
    else {
        bs_circle(boss.x, boss.y, 50, BC_BLOCK, 0, 1);
        bs_circle(boss.x, boss.y, 24, BC_CORE, 0, 2);
    }
}
static unsigned bs_forge_body(float *out) {
    unsigned n = 0;
    bs_guard_body(out, n, boss.x, boss.y, 116);
    return n;
}
static unsigned bs_cinderling_body(float *out) {
    unsigned n = 0;
    bs_guard_body(out, n, boss.x, boss.y, 50);
    return n;
}
// The forge's shell blunts the laser unless the core is exposed.
static unsigned bs_forge_soak(unsigned damage, bool laser) {
    return laser && game_ms >= boss.stamp[0] ? damage / 2 : damage;
}
// A panel takes hits until it blows out; once open, hits reach the core.
static void bs_forge_hit(BossPart& p, unsigned owner, unsigned damage, bool laser) {
    if (laser) return;
    if (p.state == 0) {
        p.hp -= damage;
        if (p.hp <= 0) { p.state = 2; bs_particles(p.x, p.y); display_shake(1); }
    } else bs_core_damage(owner, 1, false);
}
static const BossOps OPS_CINDERFORGE = {340, 135, 7, 3, {66, 33}, {1200, 1000, 900},
    bs_forge_begin, bs_forge_update, bs_forge_pick, bs_forge_run, bs_forge_circles,
    bs_forge_body, nullptr, bs_forge_soak, bs_forge_hit};
static const BossOps OPS_CINDERLING = {380, 135, 5, 1, {0, 0}, {900, 900, 900},
    nullptr, bs_cinderling_update, bs_cinderling_pick, bs_forge_run, bs_cinderling_circles,
    bs_cinderling_body, nullptr, nullptr, nullptr};
