import { gradeAtlas } from './art-grade.mjs';

export async function loadImage(url) {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
}
export async function loadArt() {
    const [atlas, font, response, hullImage, hullResponse] = await Promise.all([
        loadImage('./assets/sprites.png'),
        loadImage('./assets/font.png'),
        fetch('./assets/sprites.json'),
        loadImage('./assets/ships.png'),
        fetch('./assets/ships.json'),
    ]);
    if (!response.ok || !hullResponse.ok) throw new Error('Sprite manifest could not load');
    const sprites = await response.json(),
        { cells } = await hullResponse.json();
    // Hangar hulls ride below the stock atlas so one image serves every sprite.
    const sheet = document.createElement('canvas');
    sheet.width = Math.max(atlas.width, hullImage.width);
    sheet.height = atlas.height + hullImage.height;
    const ctx = sheet.getContext('2d');
    ctx.drawImage(atlas, 0, 0);
    ctx.drawImage(hullImage, 0, atlas.height);
    for (const [name, cell] of Object.entries(cells))
        sprites[name] = { ...cell, y: cell.y + atlas.height };
    // Region scenery (planets, moons, the black hole) is optional: without it the
    // backgrounds still draw their sky, nebulae and stars.
    let worlds = null;
    try {
        const [image, response] = await Promise.all([
            loadImage('./assets/worlds.png'),
            fetch('./assets/worlds.json'),
        ]);
        if (response.ok) worlds = { image, frames: await response.json() };
    } catch (error) {
        console.warn('World sprites unavailable', error);
    }
    return { atlas: gradeAtlas(sheet, sprites), font, sprites, worlds };
}
