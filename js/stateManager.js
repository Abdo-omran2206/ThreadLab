/**
 * stateManager.js
 * Handles saving and loading project state via localStorage.
 */

const STORAGE_KEY = 'threadlab_projects';
const AUTO_SAVE_KEY = 'threadlab_autosave';

/**
 * Serializes current design state to an object.
 * @param {object} state - { color, images, texts }
 * @returns {object}
 */
export function serializeState(state) {
  return {
    version: '1.0',
    savedAt: new Date().toISOString(),
    color: state.color,
    images: state.images.map(img => ({
      id: img.id,
      src: img.src,   // base64 DataURL
      name: img.name,
      posX: img.posX,
      posY: img.posY,
      scale: img.scale,
      opacity: img.opacity,
    })),
    texts: state.texts.map(txt => ({
      id: txt.id,
      value: txt.value,
      font: txt.font,
      size: txt.size,
      color: txt.color,
      bold: txt.bold,
      italic: txt.italic,
      posX: txt.posX,
      posY: txt.posY,
    })),
  };
}

/**
 * Saves a project to localStorage under the given name.
 * @param {string} name
 * @param {object} state
 */
export function saveProject(name, state) {
  const projects = listProjects();
  projects[name] = serializeState(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch (e) {
    console.error('[StateManager] Save failed:', e);
    return false;
  }
}

/**
 * Loads a project from localStorage.
 * @param {string} name
 * @returns {object|null}
 */
export function loadProject(name) {
  const projects = listProjects();
  return projects[name] || null;
}

/**
 * Returns an object mapping project names to their data.
 * @returns {object}
 */
export function listProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Deletes a saved project.
 * @param {string} name
 */
export function deleteProject(name) {
  const projects = listProjects();
  delete projects[name];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

/**
 * Auto-saves the current state to a dedicated auto-save slot.
 * @param {object} state
 */
export function autoSave(state) {
  try {
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(serializeState(state)));
  } catch (e) {
    console.warn('[StateManager] Auto-save failed:', e);
  }
}

/**
 * Loads the auto-saved state.
 * @returns {object|null}
 */
export function loadAutoSave() {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clears the auto-saved state.
 */
export function clearAutoSave() {
  localStorage.removeItem(AUTO_SAVE_KEY);
}
