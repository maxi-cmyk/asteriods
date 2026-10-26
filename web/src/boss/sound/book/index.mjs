// The sound book: for each boss group, its entrance sting, defeat, and per-attack charge
// and release sounds. charge: attack id -> (v, seconds). live/shot: hazard kind or shot
// family -> (v). A mini-boss borrows its parent's group.
import { sentinel } from './sentinel.mjs';
import { ringwarden } from './ringwarden.mjs';
import { cinderforge } from './cinderforge.mjs';
import { bastion } from './bastion.mjs';
import { tidecaller } from './tidecaller.mjs';
import { warden } from './warden.mjs';

export const BOOK = { sentinel, ringwarden, cinderforge, bastion, tidecaller, warden };
