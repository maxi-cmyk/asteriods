import { defaults } from './settings.mjs';
export function axisToRaw(axis) {
  const value = Math.max(-1, Math.min(1, Number.isFinite(axis) ? axis : 0));
  return Math.round(2048 + value * (value > 0 ? 2047 : 2048));
}
export function radial(x,y,deadzone) {
  const length=Math.hypot(x,y);
  if (!Number.isFinite(length) || length<=deadzone) return [0,0];
  const scale=(Math.min(1,length)-deadzone)/(1-deadzone)/length;
  return [x*scale,y*scale];
}
export function readController(pad, settings = null) {
  if (!pad?.connected || pad.mapping !== 'standard') return null;
  const down = index => !!pad.buttons[index]?.pressed;
  const buttons=settings?.buttons || defaults().buttons;
  let x=pad.axes[0] || 0,y=pad.axes[1] || 0;
  if (settings) [x,y]=radial(x,y,settings.deadzone);
  x=down(14)?-1:down(15)?1:x;y=down(12)?-1:down(13)?1:y;
  let aimX=pad.axes[2] || 0,aimY=pad.axes[3] || 0;
  if (settings) [aimX,aimY]=radial(aimX,aimY,settings.deadzone);
  return {
    x:axisToRaw(x), y:axisToRaw(y), aimX,aimY,
    fire:down(buttons.fire) || (buttons.fire===7 && !Object.values(buttons).includes(0) && down(0)), laser:down(buttons.laser),
    l1:down(buttons.shield),r1:down(buttons.precision),click:down(10) && !Object.values(buttons).includes(10),options:down(buttons.pause),
  };
}
export class Controls {
  constructor(settings = null) {
    this.settings=settings;
    this.keys=new Set();this.pauseQueued=false;this.optionsHeld=false;
    this.pulseUntil=0;this.l1Held=false;this.l1UsedForPrecision=false;
    this.pointerAim=null;this.mouseFire=false;this.mouseLaser=false;this.lastAim=null;
  }
  keyDown(code, repeat = false) {
    this.keys.add(code);
    if (!repeat && ['Escape',this.settings?.keys.pause || 'KeyP'].includes(code)) this.pauseQueued=true;
  }
  keyUp(code) { this.keys.delete(code); }
  pointerDown(button, now=0) {
    if (button===0) {this.mouseFire=true;this.pulseUntil=Math.max(this.pulseUntil,now+60);}
    if (button===2) this.mouseLaser=true;
  }
  pointerUp(button) { if(button===0)this.mouseFire=false;if(button===2)this.mouseLaser=false; }
  clear() {
    this.keys.clear();this.pulseUntil=0;this.pauseQueued=false;this.optionsHeld=false;
    this.l1Held=false;this.l1UsedForPrecision=false;this.pointerAim=null;
    this.mouseFire=false;this.mouseLaser=false;this.lastAim=null;
  }
  aimAt(x,y) {
    const length=Math.hypot(x,y);
    if(length>1)this.pointerAim=[x/length,y/length];
  }
  sample(pad, now=0) {
    const controller=readController(pad,this.settings);
    const mapping=this.settings?.keys || defaults().keys;
    const has=(...codes)=>codes.some(code=>this.keys.has(code));
    const action=key=>has(mapping[key]);
    const keyboardX=+(action('right') || has('ArrowRight'))-+(action('left') || has('ArrowLeft'));
    const keyboardY=+(action('down') || has('ArrowDown'))-+(action('up') || has('ArrowUp'));
    const keyboardAimX=+action('aimRight')-+action('aimLeft');
    const keyboardAimY=+action('aimDown')-+action('aimUp');
    const l1=!!controller?.l1 || action('shield');
    const r1=!!controller?.r1 || (!this.settings && has('KeyE'));
    const precision=(l1 && r1) || action('precision') || (!this.settings && has('ShiftRight'));
    if(l1 && !this.l1Held)this.l1UsedForPrecision=false;
    if(l1 && precision)this.l1UsedForPrecision=true;
    const shield=!l1 && this.l1Held && !this.l1UsedForPrecision;
    this.l1Held=l1;
    let aimX=controller?.aimX || 0,aimY=controller?.aimY || 0;
    if(keyboardAimX || keyboardAimY) {aimX=keyboardAimX;aimY=keyboardAimY;}
    else if(Math.hypot(aimX,aimY)<=(this.settings?0:.25) && this.pointerAim) [aimX,aimY]=this.pointerAim;
    this.pointerAim=null;
    if(this.settings && Math.hypot(aimX,aimY)>0) {
      const angle=Math.atan2(aimY,aimX);
      if(this.lastAim!==null) {
        const difference=Math.atan2(Math.sin(angle-this.lastAim),Math.cos(angle-this.lastAim));
        const limit=.45*this.settings.aimSensitivity;
        this.lastAim+=Math.max(-limit,Math.min(limit,difference));
      } else this.lastAim=angle;
      aimX=Math.cos(this.lastAim);aimY=Math.sin(this.lastAim);
    }
    const options=controller?.options || false;
    const pause=this.pauseQueued || (options && !this.optionsHeld);
    this.pauseQueued=false;this.optionsHeld=options;
    return {
      x:keyboardX?axisToRaw(keyboardX):controller?.x ?? 2048,
      y:keyboardY?axisToRaw(keyboardY):controller?.y ?? 2048,
      fire:action('fire') || has('Enter') || !!controller?.fire || this.mouseFire || now<this.pulseUntil,
      click:(!this.settings && has('KeyC')) || !!controller?.click,pause,
      aimX,aimY,laser:action('laser') || !!controller?.laser || this.mouseLaser,precision,shield,
    };
  }
}
