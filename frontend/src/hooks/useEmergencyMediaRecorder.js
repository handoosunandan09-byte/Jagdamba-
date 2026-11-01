import { useRef, useState, useCallback } from "react";
import { saveChunk, saveMeta, buildEvidenceBlob } from "../lib/emergencyDB";

// Records the front camera + microphone during an SOS (voice only if the camera is blocked) with MediaRecorder, writing a
// chunk to IndexedDB every 2 s so nothing is lost if the phone or tab dies.
// If the camera is blocked it falls back to a voice-only recording.
// Never throws to the caller.

const pickMime = (audioOnly) => {
  const candidates = audioOnly
    ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
    : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return audioOnly ? "audio/webm" : "video/webm";
};

export const useEmergencyMediaRecorder = () => {
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const evidenceIdRef = useRef(null);
  const seqRef = useRef(0);
  const mimeRef = useRef("video/webm");
  const kindRef = useRef("video");
  const [recording, setRecording] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [stream, setStream] = useState(null);
  const [kind, setKind] = useState(null); // video | audio

  const start = useCallback(async (evidenceId, { audioOnly = false, label = "SOS" } = {}) => {
    evidenceIdRef.current = evidenceId;
    seqRef.current = 0;
    setMediaError(null);
    let s = null;
    let isAudio = audioOnly;
    try {
      if (!audioOnly) {
        try {
          s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true }); // front camera + voice
        } catch (camErr) {
          // Camera blocked or missing — still capture the voice
          setMediaError(camErr.name || "CameraError");
          isAudio = true;
        }
      }
      if (!s) s = await navigator.mediaDevices.getUserMedia({ audio: true });

      streamRef.current = s;
      setStream(isAudio ? null : s);
      kindRef.current = isAudio ? "audio" : "video";
      setKind(kindRef.current);

      const mime = pickMime(isAudio);
      mimeRef.current = mime;
      await saveMeta(evidenceId, { mimeType: mime, kind: kindRef.current, label, startedAt: Date.now() });

      const rec = new MediaRecorder(s, { mimeType: mime });
      recorderRef.current = rec;
      rec.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          seqRef.current += 1;
          await saveChunk(evidenceId, e.data, seqRef.current);
          saveMeta(evidenceId, { stoppedAt: Date.now() }); // keeps duration right even if the app is killed
        }
      };
      rec.start(2000);
      setRecording(true);
      return { ok: true, kind: kindRef.current };
    } catch (err) {
      setMediaError(err.name || "MediaError");
      setRecording(false);
      return { ok: false, error: err.name || "MediaError" };
    }
  }, []);

  // Stops and returns { blob, meta } for the finished recording (or null)
  const stop = useCallback(async () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      // Wait for the final chunk to be written before reading it back
      await new Promise((resolve) => {
        const done = () => setTimeout(resolve, 300);
        rec.addEventListener("stop", done, { once: true });
        try { rec.stop(); } catch (e) { resolve(); }
      });
    }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch (e) { /* noop */ }
    streamRef.current = null;
    recorderRef.current = null;
    setStream(null);
    setRecording(false);
    const id = evidenceIdRef.current;
    if (!id) return null;
    const stoppedAt = Date.now();
    await saveMeta(id, { stoppedAt });
    const blob = await buildEvidenceBlob(id, mimeRef.current);
    if (!blob) return null;
    return { blob, meta: { evidenceId: id, kind: kindRef.current, mimeType: mimeRef.current, stoppedAt } };
  }, []);

  return { start, stop, recording, mediaError, stream, kind };
};
