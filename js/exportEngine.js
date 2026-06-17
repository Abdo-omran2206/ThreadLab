/**
 * exportEngine.js
 * Handles exporting the current 3D view as PNG (multi-quality), WebM Video, and GLB.
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// --- Helpers ---

function setupBackground(scene, renderer, background) {
  const originalBackground = scene.background;
  const originalAlpha = renderer.getClearAlpha();

  if (background === 'white') {
    scene.background = new THREE.Color(0xffffff);
    renderer.setClearAlpha(1);
  } else if (background === 'transparent') {
    scene.background = null;
    renderer.setClearAlpha(0);
  }

  return { originalBackground, originalAlpha };
}

function restoreBackground(scene, renderer, state) {
  scene.background = state.originalBackground;
  renderer.setClearAlpha(state.originalAlpha);
}

function triggerDownload(blobOrUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// --- Exporters ---

/**
 * Exports the rendered scene as a PNG.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {object} options - { background: 'scene' | 'white' | 'transparent', quality: number }
 */
export function exportAsPNG(renderer, scene, camera, options = {}) {
  const { background = 'scene', quality = 1 } = options;
  
  const bgState = setupBackground(scene, renderer, background);

  // Handle scaling for high-res
  const currentSize = renderer.getSize(new THREE.Vector2());
  const currentPixelRatio = renderer.getPixelRatio();
  
  if (quality > 1) {
    renderer.setPixelRatio(currentPixelRatio * quality);
  }

  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL('image/png');

  // Restore sizes
  if (quality > 1) {
    renderer.setPixelRatio(currentPixelRatio);
    renderer.setSize(currentSize.width, currentSize.height);
  }

  restoreBackground(scene, renderer, bgState);

  const filename = `threadlab-design-${getTimestamp()}.png`;
  triggerDownload(dataURL, filename);
  return filename;
}

/**
 * Records the canvas to a WebM video using MediaRecorder.
 */
export async function exportAsVideo(renderer, scene, camera, durationMs = 5000, options = {}) {
  const { background = 'scene' } = options;
  
  return new Promise((resolve) => {
    const bgState = setupBackground(scene, renderer, background);
    
    // We must ensure frames are being rendered. `scene.js` handles requestAnimationFrame.
    const canvas = renderer.domElement;
    const stream = canvas.captureStream(60); // 60fps
    
    // Try codecs. VP9 is great if available.
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const filename = `threadlab-turntable-${getTimestamp()}.webm`;
      triggerDownload(blob, filename);
      restoreBackground(scene, renderer, bgState);
      resolve(filename);
    };

    recorder.start();
    
    // Stop recording after durationMs
    setTimeout(() => {
      recorder.stop();
    }, durationMs);
  });
}

/**
 * Exports the scene as a GLB 3D Model.
 */
export async function exportAsGLB(scene) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    
    // Temporarily remove scene background for clean model export
    const originalBg = scene.background;
    scene.background = null;

    exporter.parse(
      scene,
      function (gltfBuffer) {
        scene.background = originalBg;
        const blob = new Blob([gltfBuffer], { type: 'model/gltf-binary' });
        const filename = `threadlab-model-${getTimestamp()}.glb`;
        triggerDownload(blob, filename);
        resolve(filename);
      },
      function (error) {
        scene.background = originalBg;
        console.error('GLTF Export Error:', error);
        reject(error);
      },
      { binary: true } // binary=true outputs .glb instead of .gltf
    );
  });
}
