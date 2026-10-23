export const WIDTH = 480;
export const HEIGHT = 270;
const COLOUR = { background:'#080f19', ink:'#f2f1df', muted:'#91a4b3', dim:'#273849', cyan:'#70d9ed', amber:'#efb963', hot:'#ed7659' };
const record = (scene, offset, stride, count) => Array.from({ length:count }, (_, i) => scene.subarray(offset+i*stride, offset+(i+1)*stride));

async function loadImage(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}
export async function loadArt() {
  const [atlas, font, response] = await Promise.all([
    loadImage('./assets/sprites.png'), loadImage('./assets/font.png'), fetch('./assets/sprites.json'),
  ]);
  if (!response.ok) throw new Error('Sprite manifest could not load');
  return { atlas, font, sprites:await response.json() };
}

export class PixelRenderer {
  constructor(canvas, art) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha:false });
    this.context.imageSmoothingEnabled = false;
    this.art = art;
    this.fonts = new Map();
    this.previous = null;
    this.shake = .5;
    this.readyUntil = 0;
    this.effects = [];
    this.stars = Array.from({length:100}, (_, i) => ({
      x:(i*137+71)%WIDTH, y:(i*i*29+31)%HEIGHT, depth:i%3,
    }));
  }
  sprite(name, x, y, scale = 1, alpha = 1) {
    const sprite = this.art.sprites[name];
    if (!sprite) return;
    const ctx = this.context;
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.art.atlas, sprite.x, sprite.y, sprite.w, sprite.h,
      Math.round(x), Math.round(y), sprite.w*scale, sprite.h*scale);
    ctx.globalAlpha = 1;
  }
  text(value, x, y, colour = COLOUR.ink, scale = 1, align = 'left') {
    const text = String(value);
    let font = this.fonts.get(colour);
    if (!font) {
      font = document.createElement('canvas'); font.width=96; font.height=128;
      const ctx=font.getContext('2d'); ctx.drawImage(this.art.font,0,0);
      ctx.globalCompositeOperation='source-in';ctx.fillStyle=colour;ctx.fillRect(0,0,96,128);
      this.fonts.set(colour,font);
    }
    if (align==='center') x -= text.length*6*scale/2;
    if (align==='right') x -= text.length*6*scale;
    for (let i=0;i<text.length;i++) {
      const code=text.charCodeAt(i)&255;
      this.context.drawImage(font,code%16*6,Math.floor(code/16)*8,6,8,
        Math.round(x+i*6*scale),Math.round(y),6*scale,8*scale);
    }
  }
  box(x,y,width,height,colour) {
    const ctx=this.context;ctx.fillStyle=colour;
    ctx.fillRect(x,y,width,1);ctx.fillRect(x,y+height-1,width,1);
    ctx.fillRect(x,y,1,height);ctx.fillRect(x+width-1,y,1,height);
  }
  background(time = 0) {
    const ctx=this.context;
    ctx.fillStyle=COLOUR.background;ctx.fillRect(0,0,WIDTH,HEIGHT);
    for (const star of this.stars) {
      const x=Math.floor((star.x-time*(star.depth+1)*.002)%WIDTH+WIDTH)%WIDTH;
      ctx.fillStyle=['#182633','#263c4c','#4b6573'][star.depth];
      ctx.fillRect(x,star.y,1,1);
    }
  }
  observe(scene) {
    const old=this.previous;
    if (old && old[49]>0 && scene[49]===0 && scene[0]===2) this.readyUntil=scene[37]+1100;
    if (old && scene[2]<old[2]) this.readyUntil=0;
    if (old && old[2]<=scene[2] && [2,4].includes(scene[0])) {
      for (let i=0;i<24;i++) {
        const at=64+i*8;
        if (old[at] && (!scene[at] || scene[at+5]!==old[at+5]) && old[at+1]>-16) {
          this.effects.push({x:old[at+1],y:old[at+2],time:scene[37]});
        }
      }
      if (old[6] && !scene[6]) this.effects.push({x:scene[4],y:scene[5],time:scene[37]});
    }
    if (old && scene[2]<old[2]) this.effects=[];
    this.effects=this.effects.filter(effect=>scene[37]-effect.time<320).slice(-20);
    this.previous=new Float32Array(scene);
  }
  world(scene) {
    const ctx=this.context;
    const time=scene[37];
    for (const [i,rock] of record(scene,64,8,24).entries()) {
      if (!rock[0]) continue;
      const size=rock[5], diameter=[32,20,12][size];
      const frame=((Math.floor(rock[4]/(Math.PI/4))%8)+8)%8;
      this.sprite(`rock-${size}-${i%3}-${frame}`,rock[1]-diameter/2,rock[2]-diameter/2);
    }
    if (scene[22]) {
      const y=Math.round(scene[21]);
      ctx.fillStyle=scene[63]?COLOUR.hot:COLOUR.amber;
      if(scene[63])this.text("FAST",WIDTH-8,Math.max(0,y-14),COLOUR.hot,1,"right");
      for (let i=0;i<4;i++) ctx.fillRect(WIDTH-2-i,y-i,1,i*2+1);
    }
    if (scene[478]) {
      if(scene[481]===2) {
        this.box(Math.round(scene[479])-8,Math.round(scene[480])-7,17,15,COLOUR.cyan);
        this.text('2X',scene[479],scene[480]-3,COLOUR.cyan,1,'center');
      } else this.sprite(scene[481]===0?'multishot':'shield',scene[479]-6,scene[480]-6);
    }
    if (scene[24]) {
      const radius=8+Math.floor((400-scene[24])/80);
      this.box(Math.round(scene[25])-radius,Math.round(scene[26])-radius,radius*2+1,radius*2+1,COLOUR.cyan);
    }
    for (const bullet of record(scene,256,6,12)) {
      if (!bullet[0]) continue;
      const length=Math.hypot(bullet[3],bullet[4]) || 1;
      const dx=bullet[3]/length,dy=bullet[4]/length;
      for (let pixel=0;pixel<6;pixel++) {
        ctx.fillStyle=pixel<2?COLOUR.ink:(scene[14]>0?COLOUR.cyan:COLOUR.amber);
        ctx.fillRect(Math.round(bullet[1]-dx*pixel),Math.round(bullet[2]-dy*pixel),2,2);
      }
    }
    for (const particle of record(scene,328,5,30)) {
      if (!particle[0]) continue;
      ctx.fillStyle=particle[3]>10?COLOUR.amber:'#9d502e';
      ctx.fillRect(Math.round(particle[1]),Math.round(particle[2]),1,1);
    }
    this.laser(scene);
    if (scene[6]) this.ship(scene);
    for (const effect of this.effects) {
      const frame=Math.min(7,Math.floor((time-effect.time)/40));
      this.sprite(`explosion-${frame}`,effect.x-16,effect.y-16);
    }
    if (scene[60]) this.text("PRACTICE / NO LIVES LOST",WIDTH/2,8,COLOUR.muted,1,"center");
    if (!scene[60] && scene[23] && scene[0]===2) this.text(`WAVE ${scene[19]}`,WIDTH/2,14,COLOUR.muted,1,'center');
  }
  ray(x,y,dx,dy,length,colour,width=1,step=1) {
    const ctx=this.context;ctx.fillStyle=colour;
    const offset=Math.floor(width/2);
    for (let distance=0;distance<length;distance+=step) {
      const px=Math.round(x+dx*distance),py=Math.round(y+dy*distance);
      if (px<0 || px>=WIDTH || py<0 || py>=HEIGHT) break;
      ctx.fillRect(px-offset,py-offset,width,width);
    }
  }
  laser(scene) {
    if (scene[47] && scene[6]) {
      const progress=Math.min(1,scene[48]/1500);
      const x=scene[4]+scene[45]*13,y=scene[5]+scene[46]*13;
      this.ray(x,y,scene[45],scene[46],560,progress>.8?COLOUR.cyan:'#28536b',1,8);
      this.box(Math.round(x)-2,Math.round(y)-2,5,5,COLOUR.cyan);
      this.context.fillStyle=COLOUR.cyan;
      this.context.fillRect(Math.round(scene[4])-12,Math.min(HEIGHT-3,Math.round(scene[5])+24),Math.ceil(24*progress),2);
    }
    if (scene[50]) {
      this.ray(scene[51],scene[52],scene[53],scene[54],560,'#205d78',7);
      this.ray(scene[51],scene[52],scene[53],scene[54],560,COLOUR.cyan,4);
      this.ray(scene[51],scene[52],scene[53],scene[54],560,COLOUR.ink,2);
    }
  }
  ship(scene) {
    const ctx=this.context, x=Math.round(scene[4]), y=Math.round(scene[5]);
    const time=scene[37],dx=scene[45] || 0,dy=scene[46] || 0;
    const direction=((Math.round(Math.atan2(dy,dx)*8/Math.PI)%16)+16)%16;
    if (scene[15]) {
      ctx.fillStyle=COLOUR.cyan;
      for (let step=0;step<48;step++) {
        if (step%12===0) continue;
        const angle=step*Math.PI/24;
        ctx.fillRect(x+Math.round(Math.cos(angle)*15),y+Math.round(Math.sin(angle)*15),1,1);
      }
    }
    const visible=!scene[8] || Math.floor(scene[8]/100)%2!==0;
    if (visible) {
      const flame=3+Math.floor(time/80)%3;
      this.ray(x-dx*11,y-dy*11,-dx,-dy,flame+4,'#9d502e',3);
      this.ray(x-dx*11,y-dy*11,-dx,-dy,flame+2,COLOUR.amber,1);
      this.sprite(`ship-aim-${direction}`,x-16,y-16);
    }
    if (scene[14]) {ctx.fillStyle=COLOUR.cyan;ctx.fillRect(x-9,y+20,Math.ceil(18*scene[14]/6000),1);}
    // Keep ability state beside the ship, clamped inside the playfield.
    const labelX=Math.max(3,Math.min(WIDTH-76,x-24));
    const labelY=y<42?Math.min(HEIGHT-20,y+26):y-29;
    const laser=scene[47]?`L ${(scene[48]/1000).toFixed(1)}/3` : scene[49]>0?`L ${(scene[49]/1000).toFixed(1)}s`:'L READY';
    this.text(laser,labelX,labelY,scene[49]>0?COLOUR.muted:COLOUR.cyan);
    if(scene[55] || scene[15])this.text(scene[15]?'S ARMED':'S STORED',labelX,labelY+10,COLOUR.cyan);
    if(this.readyUntil>scene[37])this.text('LASER READY',WIDTH/2,28,COLOUR.cyan,1,'center');
    // A small pixel reticle shows the last deliberate aim direction.
    const targetX=Math.round(x+dx*38),targetY=Math.round(y+dy*38);
    ctx.fillStyle=scene[56]?COLOUR.cyan:COLOUR.muted;
    ctx.fillRect(targetX-3,targetY,2,1);ctx.fillRect(targetX+2,targetY,2,1);
    ctx.fillRect(targetX,targetY-3,1,2);ctx.fillRect(targetX,targetY+2,1,2);
  }
  overlay(title, subtitle, scene) {
    const ctx=this.context;
    ctx.fillStyle='#080f19e8';ctx.fillRect(78,77,324,112);
    this.text(title,WIDTH/2,99,COLOUR.ink,2,'center');
    this.text(subtitle,WIDTH/2,137,COLOUR.muted,1,'center');
    if (scene[0]===3) this.text('OPTIONS / ESC TO RESUME',WIDTH/2,159,COLOUR.cyan,1,'center');
  }
  menu(scene) {
    this.sprite('ship',WIDTH/2-12,53,1);
    this.text('ASTEROIDS',WIDTH/2,91,COLOUR.ink,3,'center');
    this.text('PRESS FIRE TO START',WIDTH/2,139,COLOUR.cyan,1,'center');
    const leader=scene[31] ? `${String.fromCharCode(...scene.subarray(487,490))}  ${scene[486]}` : '---  0';
    this.text(`BEST  ${leader}`,WIDTH/2,169,COLOUR.muted,1,'center');
    this.text('MOVE  /  SHOOT  /  SURVIVE',WIDTH/2,223,COLOUR.muted,1,'center');
  }
  summary(scene) {
    this.text(scene[0]===5?'TOP FIVE!':'GAME OVER',WIDTH/2,29,COLOUR.ink,2,'center');
    this.text(`SCORE ${scene[27]}${scene[27]>scene[59]?' / NEW BEST':''}`,WIDTH/2,54,COLOUR.amber,1,'center');
    this.text(`WAVE ${scene[19]} / ${Math.floor(scene[2]/1000)}s / ${scene[57]} KILLS / x${scene[58]}`,WIDTH/2,70,COLOUR.muted,1,'center');
    if (scene[0]===5) {
      const letters=String.fromCharCode(...scene.subarray(32,35));
      this.text(letters,WIDTH/2,96,COLOUR.ink,3,'center');
      const x=WIDTH/2-27+scene[28]*18;
      this.context.fillStyle=COLOUR.cyan;this.context.fillRect(x,122,15,2);
      this.text('UP/DOWN: LETTER   LEFT/RIGHT: SLOT',WIDTH/2,151,COLOUR.muted,1,'center');
      this.text(scene[30]?'SAVE FAILED - PRESS FIRE TO RETRY':'PRESS FIRE TO SAVE',WIDTH/2,181,scene[30]?COLOUR.hot:COLOUR.cyan,1,'center');
    } else {
      for(let i=0;i<5;i++) {
        const offset=486+i*5;
        const initials=i<scene[31]?String.fromCharCode(...scene.subarray(offset+1,offset+4)):'---';
        const score=i<scene[31]?String(scene[offset]).padStart(6,' '):'     -';
        this.text(`${i+1}  ${initials}   ${score}`,WIDTH/2,92+i*20,i===scene[29]?COLOUR.cyan:COLOUR.muted,1,'center');
      }
      this.text('RELEASE FIRE, THEN PRESS TO RETRY',WIDTH/2,219,COLOUR.cyan,1,'center');
    }
  }
  render(scene) {
    this.observe(scene);
    this.background(scene[37]);
    if (scene[0]===0) this.menu(scene);
    else if (scene[0]===5 || scene[0]===6) this.summary(scene);
    else {
      if (scene[0]!==1) {
        this.context.save();
        const offset=scene[61]>31?scene[61]-64:scene[61];
        if(scene[0]!==3)this.context.translate(0,Math.round(offset*this.shake*2));
        this.world(scene);
        this.context.restore();
      }
      if (scene[0]===1) {
        const count=3-Math.floor(scene[3]/500);
        this.text(count>0?count:'GO',WIDTH/2,111,COLOUR.ink,4,'center');
      }
      if (scene[0]===3) this.overlay('PAUSED','TAKE A BREATHER',scene);
    }
  }
  comparison() {
    this.background(0);
    this.text('FLIGHT ASSETS',16,15,COLOUR.ink,2);
    this.text('NATIVE PIXELS / 480 X 270',16,39,COLOUR.muted);
    const xs=[44,136,220,296,366,430];
    const names=['ship','rock-0-0-0','rock-1-1-0','rock-2-2-0','multishot','shield'];
    const labels=['24X16','32X32','20X20','12X12','12X12','12X12'];
    names.forEach((name,i)=>{
      const {w,h}=this.art.sprites[name];
      this.sprite(name,xs[i]-w/2,96-h/2);
      this.text(labels[i],xs[i],125,COLOUR.muted,1,'center');
    });
    this.text('SHIP / ROCKS / MULTISHOT / SHIELD',16,164,COLOUR.muted);
    for (let frame=0;frame<8;frame++) this.sprite(`explosion-${frame}`,17+frame*55,190);
    this.text('EXPLOSION  /  8 FRAMES, 320 MS',16,239,COLOUR.muted);
  }
}
