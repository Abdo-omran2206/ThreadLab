/**
 * uiController.js
 * Wires up all DOM interactions to textureManager, scene, export, and state modules.
 */

import * as TextureManager from './textureManager.js';
import * as ExportEngine   from './exportEngine.js';
import * as StateManager   from './stateManager.js';
import {
  setCameraFront,
  setCameraBack,
  resetCamera,
  setSceneTheme,
  setAutoRotate,
  getAutoRotate,
  setAnimationMode,
  setAnimationSpeed,
  scene,
  camera,
  renderer,
} from './scene.js';

// ─── Internal state ───────────────────────────────────────────────────────────
let selectedImageId = null;
let selectedTextId  = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Bootstraps all UI event listeners.
 * Call once after the scene + model are ready.
 */
export function initUI() {
  initTheme();
  initColorPicker();
  initImageUpload();
  initTextTool();
  initCameraButtons();
  initCanvasControls();
  initExportButtons();
  initSaveLoad();
  initPropertySliders();
  initAnimationControls();
}

// ─── Animation ────────────────────────────────────────────────────────────────

function initAnimationControls() {
  const modeSelect = document.getElementById('animation-mode');
  const speedGroup = document.getElementById('group-anim-speed');
  const speedInput = document.getElementById('animation-speed');
  const speedVal   = document.getElementById('animation-speed-val');

  if (!modeSelect) return;

  modeSelect.addEventListener('change', (e) => {
    const mode = e.target.value;
    setAnimationMode(mode);
    if (mode === 'none') {
      speedGroup.style.display = 'none';
    } else {
      speedGroup.style.display = 'block';
    }
  });

  speedInput.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (speedVal) speedVal.textContent = v.toFixed(2);
    setAnimationSpeed(v);
  });
}

// ─── Theme ────────────────────────────────────────────────────────────────────

function initTheme() {
  const btn   = document.getElementById('btn-theme');
  const saved = localStorage.getItem('threadlab_theme') || 'light';
  applyTheme(saved);

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('threadlab_theme', theme);
  setSceneTheme(theme);
}

// ─── Color Picker ─────────────────────────────────────────────────────────────

function initColorPicker() {
  const input    = document.getElementById('shirt-color');
  const swatches = document.querySelectorAll('.swatch');

  input.addEventListener('input', (e) => {
    TextureManager.setColor(e.target.value);
  });

  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      input.value = color;
      TextureManager.setColor(color);
      // highlight active swatch
      swatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    });
  });
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

function initImageUpload() {
  const dropzone = document.getElementById('image-dropzone');
  const fileInput = document.getElementById('image-upload');

  // Click on dropzone triggers file picker
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });

  // Drag-and-drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
    fileInput.value = '';
  });
}

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please upload a PNG, JPG, or WEBP image.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataURL = e.target.result;
    const id = await TextureManager.addImage(dataURL);
    if (id) {
      addImageListItem(id, file.name, dataURL);
      selectImage(id);
      showToast('Image added to shirt!', 'success');
    }
  };
  reader.readAsDataURL(file);
}

function addImageListItem(id, name, dataURL) {
  const list = document.getElementById('image-list');
  const item = document.createElement('div');
  item.className = 'layer-item';
  item.dataset.id = id;
  item.innerHTML = `
    <img src="${dataURL}" alt="${name}" class="layer-thumb" />
    <span class="layer-name">${name.length > 20 ? name.slice(0, 18) + '…' : name}</span>
    <button class="layer-delete" data-id="${id}" title="Remove">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  item.addEventListener('click', (e) => {
    if (!e.target.closest('.layer-delete')) selectImage(id);
  });
  item.querySelector('.layer-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    removeImage(id);
  });
  list.appendChild(item);
}

function selectImage(id) {
  selectedImageId = id;
  selectedTextId  = null;

  // Highlight in list
  document.querySelectorAll('#image-list .layer-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === id);
  });

  // Show image props, hide text props
  showPropsPanel('image');

  // Sync sliders to current layer data
  const layer = TextureManager.getImageById(id);
  if (layer) {
    setSlider('img-pos-x',  layer.posX,    'img-pos-x-val');
    setSlider('img-pos-y',  layer.posY,    'img-pos-y-val');
    setSlider('img-scale',  layer.scale,   'img-scale-val');
    setSlider('img-opacity',layer.opacity, 'img-opacity-val');
  }
}

function removeImage(id) {
  TextureManager.removeImage(id);
  const item = document.querySelector(`#image-list .layer-item[data-id="${id}"]`);
  if (item) item.remove();
  if (selectedImageId === id) {
    selectedImageId = null;
    showPropsPanel('empty');
  }
  showToast('Image removed.', 'info');
}

// ─── Text Tool ────────────────────────────────────────────────────────────────

function initTextTool() {
  const btnBold   = document.getElementById('btn-bold');
  const btnItalic = document.getElementById('btn-italic');
  const colorInp  = document.getElementById('text-color');
  const colorVal  = document.getElementById('text-color-val');

  btnBold.addEventListener('click', () => {
    btnBold.classList.toggle('active');
    btnBold.setAttribute('aria-pressed', btnBold.classList.contains('active'));
  });
  btnItalic.addEventListener('click', () => {
    btnItalic.classList.toggle('active');
    btnItalic.setAttribute('aria-pressed', btnItalic.classList.contains('active'));
  });

  colorInp.addEventListener('input', (e) => {
    colorVal.textContent = e.target.value;
  });

  document.getElementById('btn-add-text').addEventListener('click', handleAddText);
}

function handleAddText() {
  const value = document.getElementById('text-input').value.trim();
  if (!value) {
    showToast('Please enter some text first.', 'error');
    return;
  }

  const config = {
    value,
    font:   document.getElementById('text-font').value,
    size:   parseInt(document.getElementById('text-size').value, 10) || 48,
    color:  document.getElementById('text-color').value,
    bold:   document.getElementById('btn-bold').classList.contains('active'),
    italic: document.getElementById('btn-italic').classList.contains('active'),
  };

  const id = TextureManager.addText(config);
  addTextListItem(id, config.value);
  selectText(id);
  document.getElementById('text-input').value = '';
  showToast('Text added to shirt!', 'success');
}

function addTextListItem(id, value) {
  const list = document.getElementById('text-list');
  const item = document.createElement('div');
  item.className = 'layer-item';
  item.dataset.id = id;
  item.innerHTML = `
    <div class="layer-text-icon">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4,7 4,4 20,4 20,7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
    </div>
    <span class="layer-name">${value.length > 22 ? value.slice(0, 20) + '…' : value}</span>
    <button class="layer-delete" data-id="${id}" title="Remove">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  item.addEventListener('click', (e) => {
    if (!e.target.closest('.layer-delete')) selectText(id);
  });
  item.querySelector('.layer-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    removeText(id);
  });
  list.appendChild(item);
}

function selectText(id) {
  selectedTextId  = id;
  selectedImageId = null;

  document.querySelectorAll('#text-list .layer-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === id);
  });

  showPropsPanel('text');

  const layer = TextureManager.getTextById(id);
  if (layer) {
    document.getElementById('prop-text-value').value      = layer.value;
    document.getElementById('prop-text-font').value       = layer.font;
    document.getElementById('prop-text-size').value       = layer.size;
    document.getElementById('prop-text-color').value      = layer.color;
    document.getElementById('prop-text-color-val').textContent = layer.color;
    setSlider('txt-pos-x', layer.posX, 'txt-pos-x-val');
    setSlider('txt-pos-y', layer.posY, 'txt-pos-y-val');
  }
}

function removeText(id) {
  TextureManager.removeText(id);
  const item = document.querySelector(`#text-list .layer-item[data-id="${id}"]`);
  if (item) item.remove();
  if (selectedTextId === id) {
    selectedTextId = null;
    showPropsPanel('empty');
  }
  showToast('Text removed.', 'info');
}

// ─── Properties Panel ─────────────────────────────────────────────────────────

function initPropertySliders() {
  // Image sliders
  bindSlider('img-pos-x',   'img-pos-x-val',   (v) => {
    if (selectedImageId) TextureManager.updateImage(selectedImageId, { posX: v });
  });
  bindSlider('img-pos-y',   'img-pos-y-val',   (v) => {
    if (selectedImageId) TextureManager.updateImage(selectedImageId, { posY: v });
  });
  bindSlider('img-scale',   'img-scale-val',   (v) => {
    if (selectedImageId) TextureManager.updateImage(selectedImageId, { scale: v });
  });
  bindSlider('img-opacity', 'img-opacity-val', (v) => {
    if (selectedImageId) TextureManager.updateImage(selectedImageId, { opacity: v });
  });

  // Text position sliders
  bindSlider('txt-pos-x', 'txt-pos-x-val', (v) => {
    if (selectedTextId) TextureManager.updateText(selectedTextId, { posX: v });
  });
  bindSlider('txt-pos-y', 'txt-pos-y-val', (v) => {
    if (selectedTextId) TextureManager.updateText(selectedTextId, { posY: v });
  });

  // Text live-edit props
  bindInput('prop-text-value', (v) => {
    if (selectedTextId) { TextureManager.updateText(selectedTextId, { value: v }); refreshTextLabel(selectedTextId, v); }
  });
  bindInput('prop-text-font', (v) => {
    if (selectedTextId) TextureManager.updateText(selectedTextId, { font: v });
  });
  bindInput('prop-text-size', (v) => {
    if (selectedTextId) TextureManager.updateText(selectedTextId, { size: parseInt(v, 10) || 48 });
  });

  const propTextColor    = document.getElementById('prop-text-color');
  const propTextColorVal = document.getElementById('prop-text-color-val');
  propTextColor.addEventListener('input', (e) => {
    propTextColorVal.textContent = e.target.value;
    if (selectedTextId) TextureManager.updateText(selectedTextId, { color: e.target.value });
  });

  // Delete buttons
  document.getElementById('btn-delete-image').addEventListener('click', () => {
    if (selectedImageId) removeImage(selectedImageId);
  });
  document.getElementById('btn-delete-text').addEventListener('click', () => {
    if (selectedTextId) removeText(selectedTextId);
  });
}

function showPropsPanel(which) {
  document.getElementById('props-empty').style.display    = which === 'empty' ? 'flex' : 'none';
  document.getElementById('props-image').style.display   = which === 'image' ? 'block' : 'none';
  document.getElementById('props-text').style.display    = which === 'text'  ? 'block' : 'none';
}

function refreshTextLabel(id, newValue) {
  const item = document.querySelector(`#text-list .layer-item[data-id="${id}"] .layer-name`);
  if (item) item.textContent = newValue.length > 22 ? newValue.slice(0, 20) + '…' : newValue;
}

// ─── Camera Buttons ───────────────────────────────────────────────────────────

function initCameraButtons() {
  const btnFront = document.getElementById('btn-view-front');
  const btnBack  = document.getElementById('btn-view-back');
  const btnFree  = document.getElementById('btn-view-free');

  const allView = [btnFront, btnBack, btnFree];
  function setActive(btn) {
    allView.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  btnFront.addEventListener('click', () => { setCameraFront(); setActive(btnFront); });
  btnBack.addEventListener('click',  () => { setCameraBack();  setActive(btnBack);  });
  btnFree.addEventListener('click',  () => { setActive(btnFree); }); // Free = just orbit freely
}

// ─── Canvas Controls ──────────────────────────────────────────────────────────

function initCanvasControls() {
  const btnReset  = document.getElementById('btn-reset-camera');
  const btnRotate = document.getElementById('btn-toggle-rotate');

  btnReset.addEventListener('click', () => {
    resetCamera();
    // Snap active button back to Front
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-view-front').classList.add('active');
  });

  btnRotate.addEventListener('click', () => {
    const nowOn = !getAutoRotate();
    setAutoRotate(nowOn);
    btnRotate.classList.toggle('active', nowOn);
    btnRotate.setAttribute('aria-pressed', nowOn);
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

function initExportButtons() {
  const getBackground = () => {
    const sel = document.querySelector('input[name="export-bg"]:checked');
    return sel ? sel.value : 'scene';
  };

  const formatSelect = document.getElementById('export-format');
  const qualityGroup = document.getElementById('export-quality-group');
  const qualitySelect = document.getElementById('export-quality');

  if (formatSelect) {
    formatSelect.addEventListener('change', (e) => {
      const isPNG = e.target.value === 'png';
      if (qualityGroup) qualityGroup.style.display = isPNG ? 'block' : 'none';
      
      const bgGroup = document.getElementById('export-bg-group');
      if (bgGroup) {
        bgGroup.style.opacity = e.target.value === 'glb' ? '0.3' : '1';
        bgGroup.style.pointerEvents = e.target.value === 'glb' ? 'none' : 'auto';
      }
    });
  }

  const doExport = async () => {
    const format = formatSelect ? formatSelect.value : 'png';
    const bg = getBackground();
    const quality = qualitySelect ? parseInt(qualitySelect.value, 10) : 1;

    try {
      if (format === 'png') {
        ExportEngine.exportAsPNG(renderer, scene, camera, { background: bg, quality });
        showToast('Design exported as PNG!', 'success');
      } else if (format === 'video') {
        showToast('Recording video... Please wait 5 seconds.', 'info');
        setLoadingProgress(50, 'Recording WebM Video...');
        await ExportEngine.exportAsVideo(renderer, scene, camera, 5000, { background: bg });
        hideLoadingOverlay();
        showToast('Video exported successfully!', 'success');
      } else if (format === 'glb') {
        showToast('Processing 3D Model export...', 'info');
        setLoadingProgress(50, 'Exporting GLB Model...');
        await ExportEngine.exportAsGLB(scene);
        hideLoadingOverlay();
        showToast('3D Model exported!', 'success');
      }
    } catch (e) {
      hideLoadingOverlay();
      showToast('Export failed. Check console for details.', 'error');
      console.error('[ExportEngine Error]', e);
    }
  };

  const btnNavExport = document.getElementById('btn-export');
  const btnPropExport = document.getElementById('btn-export-props');
  if (btnNavExport) btnNavExport.addEventListener('click', doExport);
  if (btnPropExport) btnPropExport.addEventListener('click', doExport);
}

// ─── Save / Load ──────────────────────────────────────────────────────────────

function initSaveLoad() {
  const btnSave    = document.getElementById('btn-save');
  const btnLoad    = document.getElementById('btn-load');
  const backdrop   = document.getElementById('modal-backdrop');
  const modal      = document.getElementById('modal-projects');
  const btnClose   = document.getElementById('modal-close');
  const btnSaveNew = document.getElementById('btn-save-new');
  const btnNew     = document.getElementById('btn-new');

  if (btnNew) {
    btnNew.addEventListener('click', () => {
      if (confirm('Are you sure you want to start a new project? Unsaved changes will be lost.')) {
        TextureManager.reset();
        document.getElementById('image-list').innerHTML = '';
        document.getElementById('text-list').innerHTML = '';
        document.getElementById('shirt-color').value = '#ffffff';
        const swatches = document.querySelectorAll('.swatch');
        swatches.forEach(s => s.classList.remove('active'));
        const whiteSwatch = document.querySelector('.swatch[data-color="#ffffff"]');
        if (whiteSwatch) whiteSwatch.classList.add('active');
        showPropsPanel('empty');
        StateManager.clearAutoSave();
        showToast('New project started.', 'info');
      }
    });
  }

  const openModal = () => {
    backdrop.style.display = 'block';
    modal.style.display    = 'block';
    renderProjectList();
  };
  const closeModal = () => {
    backdrop.style.display = 'none';
    modal.style.display    = 'none';
  };

  btnSave.addEventListener('click', () => {
    // Quick save to autosave + named save
    const name = prompt('Project name:', `Design ${new Date().toLocaleDateString()}`);
    if (name) {
      const ok = StateManager.saveProject(name, TextureManager.getState());
      showToast(ok ? `Project "${name}" saved!` : 'Save failed (storage full?)', ok ? 'success' : 'error');
    }
  });

  btnLoad.addEventListener('click', openModal);
  backdrop.addEventListener('click', closeModal);
  btnClose.addEventListener('click', closeModal);

  btnSaveNew.addEventListener('click', () => {
    const name = prompt('Project name:', `Design ${new Date().toLocaleDateString()}`);
    if (name) {
      const ok = StateManager.saveProject(name, TextureManager.getState());
      showToast(ok ? `Saved "${name}"!` : 'Save failed.', ok ? 'success' : 'error');
      renderProjectList();
    }
  });
}

function renderProjectList() {
  const body     = document.getElementById('modal-body');
  const projects = StateManager.listProjects();
  const names    = Object.keys(projects);

  if (names.length === 0) {
    body.innerHTML = '<p class="empty-state">No saved projects yet.</p>';
    return;
  }

  body.innerHTML = '';
  names.forEach(name => {
    const proj = projects[name];
    const row  = document.createElement('div');
    row.className = 'project-row';
    row.innerHTML = `
      <div class="project-info">
        <strong>${name}</strong>
        <span>${new Date(proj.savedAt).toLocaleString()}</span>
      </div>
      <div class="project-actions">
        <button class="btn-accent-sm btn-load-proj" data-name="${name}">Load</button>
        <button class="btn-danger-sm btn-del-proj" data-name="${name}">Delete</button>
      </div>
    `;
    row.querySelector('.btn-load-proj').addEventListener('click', () => loadProject(name));
    row.querySelector('.btn-del-proj').addEventListener('click', () => {
      StateManager.deleteProject(name);
      renderProjectList();
    });
    body.appendChild(row);
  });
}

export async function restoreState(state, isAutoSave = false) {
  if (!state) return;

  TextureManager.reset();

  const color = state.color || '#ffffff';
  TextureManager.setColor(color);
  const colorInput = document.getElementById('shirt-color');
  if (colorInput) colorInput.value = color;
  const swatches = document.querySelectorAll('.swatch');
  swatches.forEach(s => s.classList.toggle('active', s.dataset.color === color));

  document.getElementById('image-list').innerHTML = '';
  for (const img of state.images || []) {
    const id = await TextureManager.addImage(img.src, {
      id: img.id, name: img.name, posX: img.posX, posY: img.posY, scale: img.scale, opacity: img.opacity,
    });
    if (id) addImageListItem(id, img.name || 'Image', img.src);
  }

  document.getElementById('text-list').innerHTML = '';
  for (const txt of state.texts || []) {
    const id = TextureManager.addText({ ...txt });
    addTextListItem(id, txt.value);
  }

  showPropsPanel('empty');
  if (!isAutoSave) {
    document.getElementById('modal-backdrop').style.display = 'none';
    document.getElementById('modal-projects').style.display = 'none';
  }
}

async function loadProject(name) {
  const proj = StateManager.loadProject(name);
  if (!proj) return;
  await restoreState(proj, false);
  showToast(`Project "${name}" loaded!`, 'success');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bindSlider(id, valId, onChange) {
  const slider = document.getElementById(id);
  const label  = document.getElementById(valId);
  if (!slider) return;
  slider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (label) label.textContent = v.toFixed(2);
    onChange(v);
  });
}

function bindInput(id, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', (e) => onChange(e.target.value));
}

function setSlider(id, value, valId) {
  const slider = document.getElementById(id);
  const label  = document.getElementById(valId);
  if (slider) slider.value = value;
  if (label)  label.textContent = parseFloat(value).toFixed(2);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Loading screen ───────────────────────────────────────────────────────────

export function setLoadingProgress(pct, status) {
  const bar    = document.getElementById('loading-bar');
  const pctEl  = document.getElementById('loading-pct');
  const statEl = document.getElementById('loading-status');
  if (bar)    bar.style.width   = `${pct}%`;
  if (pctEl)  pctEl.textContent = `${pct}%`;
  if (statEl && status) statEl.textContent = status;
}

export function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.style.display = 'none', 600);
  }
}
