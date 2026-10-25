import { element } from '../dom.mjs';
import { hullById, hullIcon } from '../hangar.mjs';
import { drawShowcase } from '../showcase.mjs';

// Mode cards preview the hulls you will actually fly: solo uses the active
// profile's hull, co-op shows both profiles side by side.
export function createModeScreen({ getArt, store, activeProfile, reduced }) {
  const solo = element('modeArtSolo').getContext('2d'), coop = element('modeArtCoop').getContext('2d');
  const chip = element('modeHull').getContext('2d');
  return {
    render() {
      const hull = store.profiles[activeProfile()], art = getArt(), cell = art?.sprites[hullIcon(hull)];
      element('modeHullName').textContent = hullById(hull).name;
      if (cell) {
        chip.imageSmoothingEnabled = false; chip.clearRect(0, 0, 24, 16);
        chip.drawImage(art.atlas, cell.x, cell.y, cell.w, cell.h, 0, 0, 24, 16);
      }
    },
    draw(time) {
      const art = getArt();
      if (!art) return;
      const { width, height } = solo.canvas, still = reduced();
      drawShowcase(solo, art, { ships:[{ hull:store.profiles[activeProfile()], x:Math.round(width * .42), y:Math.round(height * .5), scale:2 }], time, reduced:still, seed:3 });
      drawShowcase(coop, art, { ships:[
        { hull:store.profiles[0], x:Math.round(width * .36), y:Math.round(height * .34), scale:2 },
        { hull:store.profiles[1], x:Math.round(width * .5), y:Math.round(height * .68), scale:2 },
      ], time, reduced:still, seed:4 });
    },
  };
}
