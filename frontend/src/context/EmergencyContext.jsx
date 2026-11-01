import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useEmergencyMediaRecorder } from "../hooks/useEmergencyMediaRecorder";
import { useSOSDispatch } from "../hooks/useSOSDispatch";
import { downloadBlob, evidenceFileName } from "../lib/emergencyDB";
import { toast } from "sonner";

const EmergencyContext = createContext(null);
export const useEmergency = () => useContext(EmergencyContext);

const ABORT_SECONDS = 3;
const readPin = () => { try { return localStorage.getItem("saathi_sos_pin") || null; } catch (e) { return null; } };

const vibrate = (pattern) => {
  try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) { /* noop */ }
};

export const EmergencyProvider = ({ children }) => {
  const [phase, setPhase] = useState("idle"); // idle | countdown | active
  const [countdown, setCountdown] = useState(ABORT_SECONDS);
  const [discreet, setDiscreet] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatching, setDispatching] = useState(false);

  const countdownTimer = useRef(null);
  const evidenceIdRef = useRef(null);

  const recorder = useEmergencyMediaRecorder();
  const { dispatch } = useSOSDispatch();

  const pin = readPin(); // set by the user in their profile; null = no PIN required

  const activate = useCallback(async () => {
    setPhase("active");
    vibrate([300, 120, 300, 120, 300]);
    const evidenceId = `ev-${Date.now()}`;
    evidenceIdRef.current = evidenceId;
    // Start evidence capture (best-effort, non-blocking)
    recorder.start(evidenceId, { label: "SOS" });
    // Dispatch alerts (fires even if media failed)
    setDispatching(true);
    try {
      const res = await dispatch({ evidenceId });
      setDispatchResult(res);
    } finally {
      setDispatching(false);
    }
  }, [dispatch, recorder]);

  const trigger = useCallback(() => {
    if (phase !== "idle") return;
    vibrate([200, 100, 200]);
    setPhase("countdown");
    setCountdown(ABORT_SECONDS);
    countdownTimer.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownTimer.current);
          activate();
          return 0;
        }
        vibrate(80);
        return c - 1;
      });
    }, 1000);
  }, [phase, activate]);

  const abort = useCallback(() => {
    clearInterval(countdownTimer.current);
    setPhase("idle");
    setCountdown(ABORT_SECONDS);
    vibrate(0);
  }, []);

  const cancelWithPin = useCallback(async (entered) => {
    if (pin && entered !== pin) return false;
    clearInterval(countdownTimer.current);
    const saved = await recorder.stop();
    if (saved?.blob) {
      // Keep a copy in the phone's Downloads as well as in the app's Recordings
      try { downloadBlob(saved.blob, evidenceFileName({ ...saved.meta, startedAt: Number(String(evidenceIdRef.current).replace("ev-", "")) })); } catch (e) { /* noop */ }
      toast.success("Recording saved", { description: "In Profile → SOS recordings, and a copy in your phone's Downloads." });
    }
    setPhase("idle");
    setDiscreet(false);
    setDispatchResult(null);
    setCountdown(ABORT_SECONDS);
    vibrate(0);
    return true;
  }, [pin, recorder]);

  useEffect(() => () => clearInterval(countdownTimer.current), []);

  const value = {
    phase,
    countdown,
    discreet,
    setDiscreet,
    dispatchResult,
    dispatching,
    recording: recorder.recording,
    recordingKind: recorder.kind,
    mediaError: recorder.mediaError,
    stream: recorder.stream,
    pin,
    trigger,
    abort,
    cancelWithPin,
  };

  return <EmergencyContext.Provider value={value}>{children}</EmergencyContext.Provider>;
};
