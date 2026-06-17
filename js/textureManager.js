/**
 * textureManager.js
 * Manages a dynamic CanvasTexture applied to the shirt mesh.
 * Composites: base color → uploaded images → text layers.
 */

import * as THREE from 'three';

const CANVAS_SIZE = 2048;

let canvas, ctx, texture;
let baseColor = '#ffffff';
const imageLayers = [];
const textLayers  = [];
let _idCounter = 0;

function nextId() {
  return `layer_${++_idCounter}`;
}

/**
 * Initialises the offscreen canvas and Three.js CanvasTexture.
 * Call this once after the scene is ready.
 * @returns {THREE.CanvasTexture}
 */
export function init() {
  canvas = document.createElement('canvas');
  canvas.width  = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  ctx = canvas.getContext('2d');

  texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  render();
  return texture;
}

/**
 * Re-draws the entire canvas and flags the texture for GPU update.
 */
export function render() {
  if (!ctx) return;

  // 1. Base color fill
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // 2. Draw image layers (bottom-to-top order)
  for (const img of imageLayers) {
    if (!img.element) continue;
    ctx.save();
    ctx.globalAlpha = img.opacity ?? 1.0;

    // Convert normalised [-0.5, 0.5] coords → pixel coords centred on canvas
    const px = (img.posX + 0.5) * CANVAS_SIZE;
    const py = (0.5 - img.posY) * CANVAS_SIZE;   // y is inverted

    const aspect = img.element.naturalWidth / img.element.naturalHeight;
    const drawW = img.scale * CANVAS_SIZE;
    const drawH = drawW / aspect;

    ctx.drawImage(img.element, px - drawW / 2, py - drawH / 2, drawW, drawH);
    ctx.restore();
  }

  // 3. Draw text layers
  for (const txt of textLayers) {
    ctx.save();
    ctx.globalAlpha = 1.0;

    const weight = txt.bold   ? 'bold '   : '';
    const style  = txt.italic ? 'italic ' : '';
    const px = (txt.posX + 0.5) * CANVAS_SIZE;
    const py = (0.5 - txt.posY) * CANVAS_SIZE;

    // Scale font size proportionally to canvas
    const fontSize = Math.round(txt.size * (CANVAS_SIZE / 512));
    ctx.font = `${style}${weight}${fontSize}px "${txt.font}", sans-serif`;
    ctx.fillStyle   = txt.color;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';

    // Optional: shadow for legibility
    ctx.shadowColor   = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetY = 3;

    ctx.fillText(txt.value, px, py);
    ctx.restore();
  }

  if (texture) {
    texture.needsUpdate = true;
  }
}

// ─── Color ───────────────────────────────────────────────────────────────────

/**
 * Sets the base shirt color and re-renders.
 * @param {string} hex - CSS color string
 */
export function setColor(hex) {
  baseColor = hex;
  render();
}

export function getColor() {
  return baseColor;
}

// ─── Images ──────────────────────────────────────────────────────────────────

/**
 * Adds an image from a DataURL.
 * @param {string} dataURL
 * @param {object} opts
 * @returns {string} layer id
 */
export function addImage(dataURL, opts = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const layer = {
        id:      opts.id   || nextId(),
        element: img,
        src:     dataURL,
        name:    opts.name || 'Image',
        posX:    opts.posX   ?? 0,
        posY:    opts.posY   ?? 0,
        scale:   opts.scale  ?? 0.3,
        opacity: opts.opacity ?? 1.0,
      };
      imageLayers.push(layer);
      render();
      resolve(layer.id);
    };
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });
}

/**
 * Updates position/scale/opacity of an image layer.
 * @param {string} id
 * @param {object} updates
 */
export function updateImage(id, updates) {
  const layer = imageLayers.find(l => l.id === id);
  if (!layer) return;
  Object.assign(layer, updates);
  render();
}

/**
 * Removes an image layer.
 * @param {string} id
 */
export function removeImage(id) {
  const idx = imageLayers.findIndex(l => l.id === id);
  if (idx !== -1) imageLayers.splice(idx, 1);
  render();
}

export function getImages() {
  return imageLayers.map(l => ({ ...l, element: undefined }));
}

export function getImageById(id) {
  return imageLayers.find(l => l.id === id) || null;
}

// ─── Text ─────────────────────────────────────────────────────────────────────

/**
 * Adds a text layer.
 * @param {object} config
 * @returns {string} layer id
 */
export function addText(config) {
  const layer = {
    id:     config.id     || nextId(),
    value:  config.value  || 'Text',
    font:   config.font   || 'Inter',
    size:   config.size   || 48,
    color:  config.color  || '#111111',
    bold:   config.bold   ?? false,
    italic: config.italic ?? false,
    posX:   config.posX   ?? 0,
    posY:   config.posY   ?? 0.1,
  };
  textLayers.push(layer);
  render();
  return layer.id;
}

/**
 * Updates a text layer.
 * @param {string} id
 * @param {object} updates
 */
export function updateText(id, updates) {
  const layer = textLayers.find(l => l.id === id);
  if (!layer) return;
  Object.assign(layer, updates);
  render();
}

/**
 * Removes a text layer.
 * @param {string} id
 */
export function removeText(id) {
  const idx = textLayers.findIndex(l => l.id === id);
  if (idx !== -1) textLayers.splice(idx, 1);
  render();
}

export function getTexts() {
  return textLayers.map(l => ({ ...l }));
}

export function getTextById(id) {
  return textLayers.find(l => l.id === id) || null;
}

/**
 * Returns the current Three.js texture object.
 */
export function getTexture() {
  return texture;
}

/**
 * Clears all layers and resets to defaults.
 */
export function reset() {
  baseColor = '#ffffff';
  imageLayers.length = 0;
  textLayers.length  = 0;
  render();
}

/**
 * Returns snapshot of all state for saving.
 */
export function getState() {
  return {
    color: baseColor,
    images: getImages(),
    texts:  getTexts(),
  };
}
