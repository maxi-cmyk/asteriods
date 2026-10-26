#pragma once
// The table of fights, indexed by BossKind: six bosses, then their six minis.

static const BossOps BOSS_OPS[BK_COUNT] = {
    OPS_SENTINEL, OPS_RINGWARDEN, OPS_CINDERFORGE, OPS_BASTION, OPS_TIDECALLER, OPS_WARDEN,
    OPS_PICKET, OPS_SHARDLING, OPS_CINDERLING, OPS_GUNNERY, OPS_MOONJELLY, OPS_LENSIMP,
};
static const BossOps& bs_ops_for(unsigned kind) { return BOSS_OPS[kind % BK_COUNT]; }
static const BossOps& bs_ops() { return bs_ops_for(boss.kind); }
