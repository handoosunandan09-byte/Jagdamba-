import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useEmergencyMediaRecorder } from "../hooks/useEmergencyMediaRecorder";
import { useSOSDispatch } from "../hooks/useSOSDispatch";

const EmergencyContext = createContext(null);
export const useEmergency = () => useContext(EmergencyContext);

const ABORT_SECONDS = 3;
const DEFAULT_PIN = "1234";

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

  const pin = (typeof localStorage !== "undefined" && localStorage.getItem("saathi_sos_pin")) || DEFAULT_PIN;

  const activate = useCallback(async () => {
    setPhase("active");
    vibrate([300, 120, 300, 120, 300]);
    const evidenceId = `ev-${Date.now()}`;
    evidenceIdRef.current = evidenceId;
    // Start evidence capture (best-effort, non-blocking)
    recorder.start(evidenceId);
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
    if (entered !== pin) return false;
    clearInterval(countdownTimer.current);
    await recorder.stop();
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
    mediaError: recorder.mediaError,
    stream: recorder.stream,
    pin,
    trigger,
    abort,
    cancelWithPin,
  };

  return <EmergencyContext.Provider value={value}>{children}</EmergencyContext.Provider>;
};
