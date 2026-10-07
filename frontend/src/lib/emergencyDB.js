// Minimal IndexedDB helper to persist emergency evidence chunks in real-time,
// so footage survives an abrupt tab/browser termination.

const DB_NAME = "saathi_evidence";
const STORE = "chunks";
const META = "meta";

const openDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "evidenceId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const saveChunk = async (evidenceId, blob, seq) => {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add({ evidenceId, seq, blob, at: Date.now() });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch (e) {
    /* best-effort; never block the SOS flow */
  }
};

export const saveMeta = async (evidenceId, meta) => {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(META, "readwrite");
      tx.objectStore(META).put({ evidenceId, ...meta });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch (e) { /* noop */ }
};

export const getChunks = async (evidenceId) => {
  try {
    const db = await openDB();
    const all = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return all.filter((c) => c.evidenceId === evidenceId).sort((a, b) => a.seq - b.seq);
  } catch (e) {
    return [];
  }
};

export const buildEvidenceBlob = async (evidenceId, mimeType = "video/webm") => {
  const chunks = await getChunks(evidenceId);
  if (!chunks.length) return null;
  return new Blob(chunks.map((c) => c.blob), { type: mimeType });
};
