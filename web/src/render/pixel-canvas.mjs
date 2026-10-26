import { WIDTH, HEIGHT, COLOUR } from './constants.mjs';

// Pixel-exact drawing helpers over a 2D context: sprites from the atlas, bitmap text in the
// 6x8 game font (recoloured once per colour), outline boxes and stepped rays.
export class PixelCanvas {
    constructor(context, art) {
        this.context = context;
        this.art = art;
        this.fonts = new Map(); // colour -> the font sheet tinted that colour
    }
    sprite(name, x, y, scale = 1, alpha = 1) {
        const sprite = this.art.sprites[name];
        if (!sprite) return;
        const ctx = this.context;
        ctx.globalAlpha = alpha;
        ctx.drawImage(
            this.art.atlas,
            sprite.x,
            sprite.y,
            sprite.w,
            sprite.h,
            Math.round(x),
            Math.round(y),
            sprite.w * scale,
            sprite.h * scale,
        );
        ctx.globalAlpha = 1;
    }
    text(value, x, y, colour = COLOUR.ink, scale = 1, align = 'left') {
        const text = String(value);
        let font = this.fonts.get(colour);
        if (!font) {
            font = document.createElement('canvas');
            font.width = 96;
            font.height = 128;
            const ctx = font.getContext('2d');
            ctx.drawImage(this.art.font, 0, 0);
            ctx.globalCompositeOperation = 'source-in';
            ctx.fillStyle = colour;
            ctx.fillRect(0, 0, 96, 128);
            this.fonts.set(colour, font);
        }
        if (align === 'center') x -= (text.length * 6 * scale) / 2;
        if (align === 'right') x -= text.length * 6 * scale;
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i) & 255;
            this.context.drawImage(
                font,
                (code % 16) * 6,
                Math.floor(code / 16) * 8,
                6,
                8,
                Math.round(x + i * 6 * scale),
                Math.round(y),
                6 * scale,
                8 * scale,
            );
        }
    }
    box(x, y, width, height, colour) {
        const ctx = this.context;
        ctx.fillStyle = colour;
        ctx.fillRect(x, y, width, 1);
        ctx.fillRect(x, y + height - 1, width, 1);
        ctx.fillRect(x, y, 1, height);
        ctx.fillRect(x + width - 1, y, 1, height);
    }
    // A line of `width`-pixel squares from (x, y) along (dx, dy), `step` pixels apart,
    // stopping at the playfield edge.
    ray(x, y, dx, dy, length, colour, width = 1, step = 1) {
        const ctx = this.context;
        ctx.fillStyle = colour;
        const offset = Math.floor(width / 2);
        for (let distance = 0; distance < length; distance += step) {
            const px = Math.round(x + dx * distance),
                py = Math.round(y + dy * distance);
            if (px < 0 || px >= WIDTH || py < 0 || py >= HEIGHT) break;
            ctx.fillRect(px - offset, py - offset, width, width);
        }
    }
}
