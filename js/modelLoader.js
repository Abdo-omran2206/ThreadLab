/**
 * modelLoader.js
 * Loads the GLTF t-shirt model, centers it, and applies the canvas texture.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let shirtMesh  = null;   // The main mesh (or group of meshes)
export let shirtModel = null;   // The root Object3D

/**
 * Loads the t-shirt GLB model.
 * @param {THREE.Scene} scene
 * @param {string} url - path to .glb file
 * @param {THREE.Texture} canvasTexture - texture from textureManager
 * @param {function} onProgress - (percent: 0-100) => void
 * @returns {Promise<THREE.Object3D>}
 */
export function loadModel(scene, url, canvasTexture, onProgress) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      url,

      // ── onLoad ──────────────────────────────────────────────────────
      (gltf) => {
        const model = gltf.scene;

        // Scale so the shirt fits nicely in a ~2-unit tall space
        const box    = new THREE.Box3().setFromObject(model);
        const size   = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 1.8;
        if (maxDim > 0) model.scale.setScalar(targetSize / maxDim);

        // Re-compute bounds AFTER scaling, then centre at exact origin
        const scaledBox    = new THREE.Box3().setFromObject(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        model.position.sub(scaledCenter);

        // Apply the canvas texture to every mesh
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow    = true;
            child.receiveShadow = true;

            child.material = new THREE.MeshStandardMaterial({
              map:       canvasTexture,
              roughness: 0.85,
              metalness: 0.0,
              side:      THREE.DoubleSide,
            });

            if (!shirtMesh) shirtMesh = child;
          }
        });

        shirtModel = model;
        scene.add(model);
        resolve(model);
      },

      // ── onProgress ──────────────────────────────────────────────────
      (xhr) => {
        if (xhr.lengthComputable && onProgress) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          onProgress(pct);
        }
      },

      // ── onError ─────────────────────────────────────────────────────
      (err) => {
        console.error('[ModelLoader] Failed to load model:', err);
        reject(err);
      },
    );
  });
}

/**
 * Updates the map texture on all shirt meshes.
 * Useful after the texture is hot-swapped.
 * @param {THREE.Texture} newTexture
 */
export function applyTexture(newTexture) {
  if (!shirtModel) return;
  shirtModel.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.map = newTexture;
      child.material.needsUpdate = true;
    }
  });
}

/**
 * Updates the shirt material color directly (bypasses canvas texture).
 * Used only if needed; normally color is baked into canvas.
 * @param {string} hex
 */
export function setModelColor(hex) {
  if (!shirtModel) return;
  const color = new THREE.Color(hex);
  shirtModel.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.color.copy(color);
      child.material.needsUpdate = true;
    }
  });
}
