import { useRef, useState, useCallback } from "react";
import { saveChunk, saveMeta, buildEvidenceBlob } from "../lib/emergencyDB";

// Captures camera + audio to MediaRecorder, persisting chunks to IndexedDB in real-time.
// Fails gracefully: if camera/mic denied, returns mediaError but never throws to caller.
export const useEmergencyMediaRecorder = () => {
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const evidenceIdRef = useRef(null);
  const seqRef = useRef(0);
  const mimeRef = useRef("video/webm");
  const [recording, setRecording] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [stream, setStream] = useState(null);

  const pickMime = () => {
    const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
    }
    return "video/webm";
  };

  const start = useCallback(async (evidenceId) => {
    evidenceIdRef.current = evidenceId;
    seqRef.current = 0;
    setMediaError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      streamRef.current = s;
      setStream(s);

      const mime = pickMime();
      mimeRef.current = mime;
      await saveMeta(evidenceId, { mimeType: mime, startedAt: Date.now() });

      const rec = new MediaRecorder(s, { mimeType: mime });
      recorderRef.current = rec;
      rec.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          seqRef.current += 1;
          await saveChunk(evidenceId, e.data, seqRef.current);
        }
      };
      rec.start(2000); // flush a chunk every 2s so nothing is lost on a crash
      setRecording(true);
      return { ok: true };
    } catch (err) {
      setMediaError(err.name || "MediaError");
      setRecording(false);
      return { ok: false, error: err.name || "MediaError" };
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch (e) { /* noop */ }
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch (e) { /* noop */ }
    streamRef.current = null;
    recorderRef.current = null;
    setStream(null);
    setRecording(false);
    const id = evidenceIdRef.current;
    if (!id) return null;
    const blob = await buildEvidenceBlob(id, mimeRef.current);
    return blob ? URL.createObjectURL(blob) : null;
  }, []);

  return { start, stop, recording, mediaError, stream };
};
