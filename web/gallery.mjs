import { PixelRenderer, loadArt } from './renderer.mjs';
try {
  new PixelRenderer(document.querySelector('#comparison'), await loadArt()).comparison();
} catch (error) {
  document.querySelector('.description').textContent = 'Could not load pixel assets. Reload the page after rebuilding.';
  console.error(error);
}
