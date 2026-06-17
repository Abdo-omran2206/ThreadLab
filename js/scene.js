/**
 * scene.js
 * Three.js scene manager: renderer, camera, lights, OrbitControls, animation loop.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── Exports ──────────────────────────────────────────────────────────────────
export let scene, camera, renderer, controls;

// Internal
let _animFrameId = null;
let _autoRotate  = false;
let _animationMode = 'none';
let _animationSpeed = 1.0;
let _onRenderCallbacks = [];
let _lastInteract = 0;
const IDLE_ROTATE_DELAY = 4000; // ms before idle rotation kicks in

/**
 * Initialises the Three.js scene and attaches the renderer canvas
 * to the given container element.
 * @param {HTMLElement} container
 * @returns {{ scene, camera, renderer, controls }}
 */
export function initScene(container) {
  // ── Scene ────────────────────────────────────────────────────────────────
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // ── Camera ───────────────────────────────────────────────────────────────
  camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.01,
    100,
  );
  camera.position.set(0, 0, 2.8);

  // ── Renderer ─────────────────────────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,   // needed for export
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled  = true;
  renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
  renderer.toneMapping        = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace   = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // ── Lighting ─────────────────────────────────────────────────────────────
  // Hemisphere: sky/ground colour for ambient feel
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcccccc, 1.2);
  scene.add(hemi);

  // Key light
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(3, 5, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  // Fill light (soft, opposite side)
  const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.8);
  fillLight.position.set(-4, 2, -3);
  scene.add(fillLight);

  // Rim light (back edge highlight)
  const rimLight = new THREE.DirectionalLight(0xfff0e0, 0.6);
  rimLight.position.set(0, -3, -5);
  scene.add(rimLight);

  // ── OrbitControls ────────────────────────────────────────────────────────
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.06;
  controls.enableZoom     = true;
  controls.enablePan      = false;
  controls.minDistance    = 1.0;
  controls.maxDistance    = 6.0;
  controls.minPolarAngle  = Math.PI * 0.1;
  controls.maxPolarAngle  = Math.PI * 0.9;
  controls.target.set(0, 0, 0);

  // Track interaction to pause idle rotation
  controls.addEventListener('start', () => {
    _lastInteract = performance.now();
  });

  // ── Resize handler ───────────────────────────────────────────────────────
  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  // ── Animation loop ───────────────────────────────────────────────────────
  function animate() {
    _animFrameId = requestAnimationFrame(animate);
    controls.update();

    // Animation Modes
    const t = performance.now() * 0.001 * _animationSpeed;

    if (_animationMode === 'spin') {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 2.0 * _animationSpeed;
      scene.position.y = 0;
      scene.rotation.y = 0;
      scene.rotation.x = 0;
      scene.scale.setScalar(1);
    } else if (_animationMode === 'hover') {
      controls.autoRotate = false;
      scene.position.y = Math.sin(t * 2.5) * 0.06;
      scene.rotation.y = Math.sin(t * 1.5) * 0.08;
      scene.rotation.x = 0;
      scene.scale.setScalar(1);
    } else if (_animationMode === 'breathe') {
      controls.autoRotate = false;
      const breatheScale = 1 + Math.sin(t * 1.8) * 0.035;
      scene.scale.setScalar(breatheScale);
      scene.position.y = Math.sin(t * 1.8) * 0.02;
      scene.rotation.y = Math.sin(t * 0.4) * 0.03;
      scene.rotation.x = 0;
    } else if (_animationMode === 'swing') {
      controls.autoRotate = false;
      scene.rotation.y = Math.sin(t * 2.0) * 0.25;
      scene.rotation.x = Math.sin(t * 1.3) * 0.04;
      scene.position.y = Math.abs(Math.sin(t * 2.0)) * 0.03;
      scene.scale.setScalar(1);
    } else {
      // 'none' — reset everything
      scene.position.y = 0;
      scene.rotation.y = 0;
      scene.rotation.x = 0;
      scene.scale.setScalar(1);

      // Idle auto-rotation fallback
      if (_autoRotate) {
        const idled = performance.now() - _lastInteract > IDLE_ROTATE_DELAY;
        if (idled) {
          controls.autoRotate      = true;
          controls.autoRotateSpeed = 0.6;
        } else {
          controls.autoRotate = false;
        }
      } else {
        controls.autoRotate = false;
      }
    }

    // Custom per-frame callbacks
    for (const cb of _onRenderCallbacks) cb();

    renderer.render(scene, camera);
  }
  animate();

  return { scene, camera, renderer, controls };
}

// ─── Camera Presets ───────────────────────────────────────────────────────────

export function setCameraFront() {
  camera.position.set(0, 0, 2.8);
  controls.target.set(0, 0, 0);
  controls.update();
}

export function setCameraBack() {
  camera.position.set(0, 0, -2.8);
  controls.target.set(0, 0, 0);
  controls.update();
}

export function resetCamera() {
  setCameraFront();
}

// ─── Background ───────────────────────────────────────────────────────────────

/**
 * Sets the scene background. Pass null for transparent.
 * @param {string|null} theme - 'light' | 'dark'
 */
export function setSceneTheme(theme) {
  if (theme === 'dark') {
    scene.background = new THREE.Color(0x111111);
  } else {
    scene.background = new THREE.Color(0xeeeeee);
  }
}

// ─── Auto-rotate toggle ───────────────────────────────────────────────────────

export function setAutoRotate(enabled) {
  _autoRotate = enabled;
  _lastInteract = 0; // force immediate idle check
}

export function getAutoRotate() {
  return _autoRotate;
}

// ─── Register per-frame callback ──────────────────────────────────────────────

export function onRender(cb) {
  _onRenderCallbacks.push(cb);
}

// ─── Animation Modes ──────────────────────────────────────────────────────────

export function setAnimationMode(mode) {
  _animationMode = mode;
  // Reset interactions to let spin/hover take over smoothly
  _lastInteract = 0;
}

export function setAnimationSpeed(speed) {
  _animationSpeed = speed;
}
