/**
 * main.js
 * ThreadLab — App entry point. Orchestrates all modules.
 */

import { initScene, setSceneTheme } from './scene.js';
import { loadModel }                from './modelLoader.js';
import * as TextureManager          from './textureManager.js';
import { initUI, setLoadingProgress, hideLoadingOverlay, showToast, restoreState } from './uiController.js';
import * as StateManager            from './stateManager.js';

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  // 1. Apply saved theme early (before scene) to avoid flash
  const savedTheme = localStorage.getItem('threadlab_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // 2. Get canvas container
  const container = document.getElementById('canvas-container');
  if (!container) {
    console.error('[Main] #canvas-container not found');
    return;
  }

  // 3. Init Three.js scene
  setLoadingProgress(5, 'Setting up 3D scene…');
  const { scene, camera, renderer } = initScene(container);
  setSceneTheme(savedTheme);

  // 4. Init canvas texture
  setLoadingProgress(15, 'Preparing texture engine…');
  const canvasTexture = TextureManager.init();

  // 5. Load GLTF model
  setLoadingProgress(20, 'Loading T-Shirt model…');
  try {
    await loadModel(
      scene,
      '../assets/models/oversized_t-shirt.glb',
      canvasTexture,
      (pct) => {
        // Map 0-100 model load → 20-90 overall
        const overall = 20 + Math.round(pct * 0.70);
        setLoadingProgress(overall, `Loading model… ${pct}%`);
      },
    );
  } catch (err) {
    setLoadingProgress(100, 'Failed to load model.');
    showToast('Could not load the T-Shirt model.', 'error');
    console.error('[Main] Model load error:', err);
    // Still hide loader so user sees the UI
    setTimeout(hideLoadingOverlay, 1500);
    return;
  }

  // 6. Init UI (wire up all event listeners)
  setLoadingProgress(92, 'Initialising UI…');
  initUI();

  // 7. Check for auto-save to restore
  setLoadingProgress(97, 'Checking saved state…');
  const autoSaved = StateManager.loadAutoSave();
  if (autoSaved) {
    // Silently restore auto-save (no prompt – just restores seamlessly)
    try {
      await restoreState(autoSaved, true);
    } catch (e) {
      console.warn('[Main] Auto-save restore failed:', e);
    }
  }

  // 8. Set up auto-save every 30 seconds
  setInterval(() => {
    StateManager.autoSave(TextureManager.getState());
  }, 30_000);

  // 9. Done — hide loading overlay
  setLoadingProgress(100, 'Ready!');
  setTimeout(hideLoadingOverlay, 400);
}

// ─── Start ────────────────────────────────────────────────────────────────────

boot().catch((err) => {
  console.error('[Main] Boot failed:', err);
});
