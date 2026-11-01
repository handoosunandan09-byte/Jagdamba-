// IndexedDB store for evidence recordings (video and voice). Chunks are written
// every 2 seconds while recording, so footage survives the tab being killed.
// Everything stays on this phone; nothing is uploaded.

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

const run = async (stores, mode, fn) => {
  const db = await openDB();
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction(stores, mode);
      let out;
      Promise.resolve(fn(tx)).then((v) => { out = v; });
      tx.oncomplete = () => res(out);
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
};

const reqP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const saveChunk = async (evidenceId, blob, seq) => {
  try {
    await run(STORE, "readwrite", (tx) => { tx.objectStore(STORE).add({ evidenceId, seq, blob, at: Date.now() }); });
  } catch (e) { /* best-effort; never block the SOS flow */ }
};

export const saveMeta = async (evidenceId, meta) => {
  try {
    await run(META, "readwrite", async (tx) => {
      const store = tx.objectStore(META);
      const prev = (await reqP(store.get(evidenceId))) || {};
      store.put({ ...prev, evidenceId, ...meta });
    });
  } catch (e) { /* noop */ }
};

const allChunks = () => run(STORE, "readonly", (tx) => reqP(tx.objectStore(STORE).getAll()));

export const getChunks = async (evidenceId) => {
  try {
    const all = await allChunks();
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

// All recordings, newest first, with their size
export const listEvidence = async () => {
  try {
    const [metas, chunks] = await Promise.all([
      run(META, "readonly", (tx) => reqP(tx.objectStore(META).getAll())),
      allChunks(),
    ]);
    const sizes = {};
    chunks.forEach((c) => { sizes[c.evidenceId] = (sizes[c.evidenceId] || 0) + (c.blob?.size || 0); });
    return metas
      .map((m) => ({
        ...m,
        kind: m.kind || (String(m.mimeType || "").startsWith("audio") ? "audio" : "video"),
        size: sizes[m.evidenceId] || 0,
        durationS: m.stoppedAt && m.startedAt ? Math.round((m.stoppedAt - m.startedAt) / 1000) : null,
      }))
      .filter((m) => m.size > 0)
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  } catch (e) {
    return [];
  }
};

export const deleteEvidence = async (evidenceId) => {
  const db = await openDB();
  try {
    await new Promise((res, rej) => {
      const tx = db.transaction([STORE, META], "readwrite");
      tx.objectStore(META).delete(evidenceId);
      const cur = tx.objectStore(STORE).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return;
        if (c.value.evidenceId === evidenceId) c.delete();
        c.continue();
      };
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
};

const extFor = (mime = "") => (mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.startsWith("audio") ? "webm" : "webm");

export const evidenceFileName = (meta) => {
  const d = new Date(meta.startedAt || Date.now());
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  return `jagdamba-${meta.kind === "audio" ? "voice" : "video"}-${stamp}.${extFor(meta.mimeType)}`;
};

// Saves a copy into the phone's Downloads folder
export const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
};
