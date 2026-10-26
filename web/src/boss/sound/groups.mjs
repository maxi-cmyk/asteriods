export const GROUPS = ['sentinel', 'ringwarden', 'cinderforge', 'bastion', 'tidecaller', 'warden'];
// Six bosses, then their six minis in the same order.
export const groupOf = (kind) => GROUPS[kind % 6];
export const isMini = (kind) => kind >= 6;
