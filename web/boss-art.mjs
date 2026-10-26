// Lazy sprite sheets for bosses. Each region has one sheet (bosses/<region>.png and
// .json), loaded the first time that region's boss or mini-boss is in sight; the
// projectile sheet is shared. Cells are cropped to their opaque pixels, so drawing
// places a cell by the original frame's centre (see tools/make-bosses.py).
import { KINDS, REGION_SHEETS } from './boss-scene.mjs';

const loadImage = async url => {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
};

// The frame a boss's rubble is cut from.
const MAIN_FRAME = ['sentinel-0', 'ringwarden-core-0', 'forge-1', 'bastion-hull', 'tide-0-0', 'warden-0', 'picket-0', 'shardling-0', 'cinderling-0', 'gunnery-0', 'moonjelly-0', 'lensimp-0'];

export class BossArt {
  constructor(base = './assets/bosses/') {
    this.base = base;
    this.sheets = new Map();
    this.flashes = new Map();
    this.chunks = new Map();
  }
  // Starts loading a sheet once; failures are remembered so play never waits.
  load(name) {
    let sheet = this.sheets.get(name);
    if (sheet) return sheet.promise;
    sheet = { state:'loading', image:null, cells:null };
    sheet.promise = Promise.all([loadImage(`${this.base}${name}.png`), fetch(`${this.base}${name}.json`).then(r => r.json())])
      .then(([image, cells]) => { Object.assign(sheet, { image, cells, state:'ready' }); return sheet; })
      .catch(error => { sheet.state = 'failed'; console.warn(`Boss art ${name} unavailable`, error); return sheet; });
    this.sheets.set(name, sheet);
    return sheet.promise;
  }
  // The current region's sheet (every fight of a region lives in it) and the
  // projectiles, requested early so the art is ready long before an entrance.
  prepare(wave) {
    this.load('shots');
    this.load(REGION_SHEETS[Math.floor(((wave || 1) - 1) / 5) % 6]);
  }
  ready(name) { return this.sheets.get(name)?.state === 'ready'; }
  cell(sheet, key) {
    const entry = this.sheets.get(sheet);
    return entry?.state === 'ready' ? entry.cells[key] : undefined;
  }
  // Draws a cell so the original frame's centre lands on (cx, cy).
  draw(ctx, sheet, key, cx, cy, { alpha = 1, flash = 0 } = {}) {
    const entry = this.sheets.get(sheet), c = entry?.state === 'ready' ? entry.cells[key] : undefined;
    if (!c) return false;
    const x = Math.round(cx - c.W / 2) + c.ox, y = Math.round(cy - c.H / 2) + c.oy;
    ctx.globalAlpha = alpha;
    ctx.drawImage(entry.image, c.x, c.y, c.w, c.h, x, y, c.w, c.h);
    if (flash > 0) {
      ctx.globalAlpha = Math.min(1, flash) * alpha;
      ctx.drawImage(this.silhouette(sheet, key), x, y);
    }
    ctx.globalAlpha = 1;
    return true;
  }
  // Same, rotated about the cell's centre (small projectiles).
  drawRotated(ctx, sheet, key, cx, cy, angle, alpha = 1) {
    const entry = this.sheets.get(sheet), c = entry?.state === 'ready' ? entry.cells[key] : undefined;
    if (!c) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(cx), Math.round(cy));
    ctx.rotate(angle);
    ctx.drawImage(entry.image, c.x, c.y, c.w, c.h, Math.round(-c.W / 2) + c.ox, Math.round(-c.H / 2) + c.oy, c.w, c.h);
    ctx.restore();
    return true;
  }
  silhouette(sheet, key) {
    const id = `${sheet}/${key}`;
    let canvas = this.flashes.get(id);
    if (!canvas) {
      const entry = this.sheets.get(sheet), c = entry.cells[key];
      canvas = document.createElement('canvas');
      canvas.width = c.w; canvas.height = c.h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(entry.image, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#fff4e0';
      ctx.fillRect(0, 0, c.w, c.h);
      this.flashes.set(id, canvas);
    }
    return canvas;
  }
  // A cell about its frame centre with a transform. `clip` is a rectangle [x, y, w, h] in
  // the sprite's own space (relative to its centre), applied before the transform, so a
  // sprite can be cut in two and each half moved on its own.
  drawFx(ctx, sheet, key, cx, cy, { dx = 0, dy = 0, sx = 1, sy = 1, rot = 0, alpha = 1, flash = 0, clip = null } = {}) {
    const entry = this.sheets.get(sheet), c = entry?.state === 'ready' ? entry.cells[key] : undefined;
    if (!c || alpha <= 0) return false;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.translate(Math.round(cx + dx), Math.round(cy + dy));
    if (rot) ctx.rotate(rot);
    if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
    if (clip) { ctx.beginPath(); ctx.rect(clip[0], clip[1], clip[2], clip[3]); ctx.clip(); }
    const x = c.ox - Math.round(c.W / 2), y = c.oy - Math.round(c.H / 2);
    ctx.drawImage(entry.image, c.x, c.y, c.w, c.h, x, y, c.w, c.h);
    if (flash > 0) { ctx.globalAlpha = Math.min(1, flash) * alpha; ctx.drawImage(this.silhouette(sheet, key), x, y); }
    ctx.restore();
    return true;
  }
  // Draws a boss's main frame scaled to fit a small canvas (the Records boss log).
  icon(kind, canvas) {
    const info = KINDS[kind], entry = this.sheets.get(info.region), c = entry?.state === 'ready' ? entry.cells[MAIN_FRAME[kind]] : undefined;
    if (!c) return false;
    const ctx = canvas.getContext('2d'), fit = Math.min((canvas.width - 4) / c.W, (canvas.height - 4) / c.H);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const w = Math.max(1, Math.round(c.w * fit)), h = Math.max(1, Math.round(c.h * fit));
    ctx.drawImage(entry.image, c.x, c.y, c.w, c.h, Math.round((canvas.width - c.W * fit) / 2 + c.ox * fit), Math.round((canvas.height - c.H * fit) / 2 + c.oy * fit), w, h);
    return true;
  }
  // Ten rubble tiles cut from a boss's own sprite for its defeat sequence.
  rubble(kind) {
    if (this.chunks.has(kind)) return this.chunks.get(kind);
    const info = KINDS[kind], entry = this.sheets.get(info.region);
    const list = [];
    if (entry?.state === 'ready') {
      const key = MAIN_FRAME[kind];
      const c = key && entry.cells[key];
      if (c) {
        const scan = document.createElement('canvas');
        scan.width = c.w; scan.height = c.h;
        const sctx = scan.getContext('2d', { willReadFrequently:true });
        sctx.drawImage(entry.image, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
        const data = sctx.getImageData(0, 0, c.w, c.h).data;
        let seed = 17 + kind * 31;
        const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
        for (let tries = 0; list.length < 9 && tries < 400; tries++) {
          const size = 44 + Math.floor(random() * 34);
          const x = Math.floor(random() * Math.max(1, c.w - size)), y = Math.floor(random() * Math.max(1, c.h - size));
          let solid = 0;
          for (let j = 0; j < size; j += 4) for (let i = 0; i < size; i += 4) solid += data[((y + j) * c.w + x + i) * 4 + 3] > 0;
          if (solid < (size / 4) ** 2 * .6) continue;
          // A shard, not a square: an angular polygon cut out of the tile (as in the boss-destroyed draft).
          const tile = document.createElement('canvas');
          tile.width = tile.height = size;
          const tctx = tile.getContext('2d');
          const corners = 4 + Math.floor(random() * 2), start = random() * Math.PI * 2;
          tctx.beginPath();
          for (let k = 0; k < corners; k++) {
            const a = start + k / corners * Math.PI * 2 + (random() - .5) * .5, r = size / 2 * (.78 + random() * .22);
            tctx[k ? 'lineTo' : 'moveTo'](Math.round(size / 2 + Math.cos(a) * r), Math.round(size / 2 + Math.sin(a) * r));
          }
          tctx.closePath();
          tctx.clip();
          tctx.drawImage(scan, x, y, size, size, 0, 0, size, size);
          list.push({ canvas:tile, dx:x + size / 2 + c.ox - c.W / 2, dy:y + size / 2 + c.oy - c.H / 2 });
        }
      }
    }
    this.chunks.set(kind, list);
    return list;
  }
}
