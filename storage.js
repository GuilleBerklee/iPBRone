// storage.js - Gestión de IndexedDB y Archivos de Proyecto (.pbrproj)

const DB_NAME = 'PBRScannerDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

// Inicializar IndexedDB
export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Guardar proyecto en IndexedDB interno
export async function saveProjectToDB(projectData) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(projectData);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

// Obtener todos los proyectos guardados
export async function getAllProjectsFromDB() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

// Eliminar un proyecto de la base de datos
export async function deleteProjectFromDB(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

// Exportar proyecto como archivo local (.pbrproj) en carpetas del teléfono
export function exportProjectAsFile(projectData) {
  const jsonStr = JSON.stringify(projectData);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (projectData.name || 'Proyecto').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `${safeName}.pbrproj`;
  a.click();
  URL.revokeObjectURL(url);
}

// Cargar proyecto desde un archivo (.pbrproj) subido desde el teléfono
export function readProjectFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (err) {
        reject(new Error('El archivo no es un proyecto válido (.pbrproj)'));
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}