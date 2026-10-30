"""Build original, palette-limited pixel sprites. No image dependencies.

References for visual direction: Ansimuz Warped Space Shooter, Kenney Pixel
Shmup, Gustavo Vituri Space Shooter, and Deep-Fold Pixel Planets. No artwork
from those packs is copied. Font pixels remain under the Adafruit notice.
"""
from pathlib import Path
import json
import math
import re
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
PALETTE = {
    'outline': '#111b27', 'rock0': '#263341', 'rock1': '#3d4d5b',
    'rock2': '#61717e', 'rock3': '#8b999f', 'rock4': '#bdc6c5',
    'hull0': '#536976', 'hull1': '#9cafb6', 'hull2': '#dae4e1',
    'white': '#f2f1df', 'cyan0': '#205d78', 'cyan': '#70d9ed',
    'amber0': '#9d502e', 'amber': '#efb963', 'hot': '#ed7659',
    'red0': '#7a1f33', 'red': '#e0424f', 'red1': '#ff8a85',
    'wood0': '#6b3a24', 'wood': '#a85d34', 'wood1': '#c98a4e',
}

def rgba(value):
    value = value.lstrip('#')
    return tuple(int(value[i:i+2], 16) for i in (0,2,4)) + (255,)

def png(path, width, height, pixels):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind+data) & 0xffffffff)
    raw = b''.join(b'\0'+bytes(sum(pixels[y*width:(y+1)*width], ())) for y in range(height))
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))

class Sprite:
    def __init__(self,w,h):
        self.w,self.h=w,h
        self.p=[(0,0,0,0)]*(w*h)
    def put(self,x,y,color):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.p[y*self.w+x]=rgba(PALETTE.get(color,color))
    def rect(self,x,y,w,h,color):
        for j in range(y,y+h):
            for i in range(x,x+w): self.put(i,j,color)

sprites=[]
def add(name,sprite): sprites.append((name,sprite))

def inside(x,y,polygon):
    result=False
    previous=polygon[-1]
    for current in polygon:
        a,b=previous,current
        if (a[1]>y)!=(b[1]>y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: result=not result
        previous=current
    return result

ship=Sprite(24,16)
shape=[(0,5),(6,5),(4,0),(10,1),(15,5),(21,6),(24,7),(24,9),(21,10),(15,11),(10,15),(4,16),(6,11),(0,11)]
mask={(x,y) for y in range(16) for x in range(24) if inside(x+.5,y+.5,shape)}
for x,y in mask:
    edge=any((x+dx,y+dy) not in mask for dx,dy in [(0,-1),(0,1),(-1,0),(1,0)])
    ship.put(x,y,'outline' if edge else ('hull2' if y<8 else 'hull1'))
ship.rect(3,6,3,4,'hull0');ship.rect(7,3,2,3,'hull0');ship.rect(7,11,2,2,'hull0')
ship.rect(11,6,6,3,'cyan0');ship.rect(12,6,4,1,'cyan');ship.rect(13,7,4,1,'cyan')
ship.rect(17,8,4,1,'white');ship.rect(8,7,2,2,'hull0');ship.put(9,4,'amber');ship.put(9,12,'amber')
add('ship',ship)
# Sixteen hand-pixelled nearest-neighbour orientations, without resampling blur.
for direction in range(16):
    rotated=Sprite(32,32)
    angle=direction*math.tau/16
    for y in range(32):
        for x in range(32):
            dx=x+.5-16;dy=y+.5-16
            sx=math.floor(dx*math.cos(angle)+dy*math.sin(angle)+12)
            sy=math.floor(-dx*math.sin(angle)+dy*math.cos(angle)+8)
            if 0<=sx<24 and 0<=sy<16: rotated.p[y*32+x]=ship.p[sy*24+sx]
    add(f'ship-aim-{direction}',rotated)

for size,diameter in enumerate([32,20,12]):
    for variant in range(3):
        for frame in range(8):
            s=Sprite(diameter,diameter);r=diameter/2;rotation=frame*math.tau/8
            craters=[(-.30,-.18,.21),(.26,.24,.25),(.38,-.40,.13)]
            for y in range(diameter):
                for x in range(diameter):
                    nx=(x+.5-r)/r;ny=(y+.5-r)/r;distance=math.hypot(nx,ny)
                    angle=math.atan2(ny,nx)-rotation
                    edge=.91+.045*math.sin(angle*5+variant*2)+.035*math.cos(angle*3+variant)
                    if distance>edge: continue
                    light=(-nx-ny)*.36+math.sqrt(max(0,1-distance*distance))*.45
                    tone=min(4,max(0,int((light+.35)*3.6)))
                    if distance>edge-.085: tone=max(0,tone-2)
                    rx=nx*math.cos(rotation)+ny*math.sin(rotation)
                    ry=-nx*math.sin(rotation)+ny*math.cos(rotation)
                    for cx,cy,cr in craters:
                        cx+=variant*.065;cy-=variant*.035
                        d=math.hypot(rx-cx,ry-cy)
                        if d<cr:
                            tone=max(0,tone-2)
                            if ry<cy-cr*.45: tone=min(4,tone+1)
                        elif cr<=d<cr+.06 and ny<cy: tone=min(4,tone+1)
                    if (x*19+y*31+variant*7)%23==0: tone=max(0,tone-1)
                    s.put(x,y,f'rock{tone}')
            add(f'rock-{size}-{variant}-{frame}',s)

for kind in ['multishot','shield','health']:
    if kind=='shield':
        # A round shield, drawn without the pickup frame so it reads as a disc rather than a heart:
        # dark outline, riveted metal rim, wooden planks and a bright iron boss.
        s=Sprite(12,12)
        for y in range(12):
            for x in range(12):
                d=math.hypot(x-5.5,y-5.5)
                if d>6: continue
                if d>5: c='outline'
                elif d>3.9: c='hull2' if (x+y)<9 else 'hull1' if (x+y)<13 else 'hull0'
                else: c='wood1' if x in (3,4) and y<6 else 'wood0' if x in (5,6) and False else 'wood'
                if d<=3.9 and x==5 and d>1.9: c='wood0'
                if d<=1.9: c='white' if (x,y)==(5,5) else 'hull1' if x+y<11 else 'hull0'
                s.put(x,y,c)
        for x,y in [(5,1),(10,5),(1,5),(5,10)]: s.put(x,y,'hull0')
        add(kind,s)
        continue
    s=Sprite(12,12)
    s.rect(2,0,8,1,'outline');s.rect(2,11,8,1,'outline')
    s.rect(0,2,1,8,'outline');s.rect(11,2,1,8,'outline')
    s.rect(1,1,10,10,'red0' if kind=='health' else 'amber0')
    s.rect(2,2,8,8,'outline')
    if kind=='multishot':
        for y in [3,5,7]: s.rect(4,y,4,1,'amber')
        s.put(8,2,'amber');s.put(8,8,'amber');s.put(8,5,'white')
    else:
        # A red heart: the health pickup a defeated boss leaves behind.
        rows=['.##..##.','########','########','########','.######.','..####..','...##...']
        for y,row in enumerate(rows):
            for x,c in enumerate(row):
                if c=='#': s.put(2+x,3+y,'red')
        s.put(3,4,'red1');s.put(4,4,'red1');s.put(3,5,'red1');s.put(6,4,'white')
    add(kind,s)

for frame in range(8):
    s=Sprite(32,32)
    radius=[3,6,10,14,15,13,10,6][frame]
    for y in range(32):
        for x in range(32):
            dx=x-15.5;dy=y-15.5;d=math.hypot(dx,dy)
            noisy=radius*(.82+.12*math.sin(math.atan2(dy,dx)*7+frame))
            if d>noisy: continue
            if frame>3 and d<noisy*(frame-3)/5: continue
            if frame>5 and (x*13+y*7)%4: continue
            s.put(x,y,'white' if d<noisy*.35 and frame<3 else ('amber' if d<noisy*.7 else 'amber0'))
    add(f'explosion-{frame}',s)

columns=8;cell=32;rows=math.ceil(len(sprites)/columns)
atlas=Sprite(columns*cell,rows*cell);manifest={}
for i,(name,s) in enumerate(sprites):
    ax=(i%columns)*cell;ay=(i//columns)*cell
    manifest[name]={'x':ax,'y':ay,'w':s.w,'h':s.h}
    for y in range(s.h):
        for x in range(s.w): atlas.p[(ay+y)*atlas.w+ax+x]=s.p[y*s.w+x]
png(ROOT/'assets/sprites.png',atlas.w,atlas.h,atlas.p)
(ROOT/'assets/sprites.json').write_text(json.dumps(manifest,indent=2)+'\n')
font_source=(ROOT/'vendor/glcdfont.c').read_text().split('= {',1)[1].split('};',1)[0]
font_bytes=[int(value,16) for value in re.findall(r'0x([0-9A-Fa-f]{2})',font_source)]
font=Sprite(96,128)
for ch in range(256):
    for x in range(5):
        for y in range(8):
            if font_bytes[ch*5+x] & (1<<y): font.put(ch%16*6+x,ch//16*8+y,'white')
png(ROOT/'assets/font.png',font.w,font.h,font.p)
print(f'Wrote {len(sprites)} original sprites and the attributed bitmap font.')
