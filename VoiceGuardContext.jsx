import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useEmergency } from "./EmergencyContext";
import { isWakePhrase } from "../lib/wakePhrase";

// Hands-free SOS: while enabled, keeps the browser's speech recogniser running and
// starts the SOS countdown when it hears "Jagdamba, I need help".
// Works only while the app is open on screen (browsers don't allow background
// listening), so we also hold a screen wake lock while it's on.

const STORAGE_KEY = "jagdamba_voice_sos";
const VoiceGuardContext = createContext(null);

const readEnabled = () => { try { return localStorage.getItem(STORAGE_KEY) === "on"; } catch (e) { return false; } };
const writeEnabled = (on) => { try { localStorage.setItem(STORAGE_KEY, on ? "on" : "off"); } catch (e) { /* noop */ } };

export const VoiceGuardProvider = ({ paused = false, children }) => {
  const { phase, trigger } = useEmergency();
  const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const supported = !!SR;

  const [enabled, setEnabledState] = useState(() => supported && readEnabled());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [heard, setHeard] = useState("");

  const recRef = useRef(null);
  const wakeLockRef = useRef(null);
  const restartTimer = useRef(null);
  const failures = useRef(0);
  const triggerRef = useRef(trigger);
  triggerRef.current = trigger;

  const active = supported && enabled && !paused && phase === "idle";

  const setEnabled = useCallback((on) => {
    setError(null);
    failures.current = 0;
    setEnabledState(on);
    writeEnabled(on);
  }, []);

  // Keep the screen awake while listening (best-effort)
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return undefined;
    let cancelled = false;
    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) { lock.release().catch(() => {}); return; }
        wakeLockRef.current = lock;
      } catch (e) { /* not allowed right now */ }
    };
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [active]);

  // Recogniser lifecycle
  useEffect(() => {
    if (!active) return undefined;
    let stopped = false;

    const start = () => {
      if (stopped) return;
      const rec = new SR();
      rec.lang = "en-IN";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;

      rec.onstart = () => { setListening(true); };
      rec.onresult = (e) => {
        failures.current = 0;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          for (let a = 0; a < res.length; a++) {
            const text = res[a].transcript;
            if (isWakePhrase(text)) {
              setHeard(text);
              stopped = true;
              try { rec.abort(); } catch (err) { /* noop */ }
              triggerRef.current();
              return;
            }
          }
        }
        setHeard(e.results[e.results.length - 1][0].transcript);
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          stopped = true;
          setError("Microphone access is blocked. Allow it in your browser's site settings, then turn Voice SOS on again.");
          setEnabledState(false);
          writeEnabled(false);
        } else if (e.error === "audio-capture") {
          setError("No microphone was found.");
        }
        // no-speech / aborted / network: just restart in onend
      };
      rec.onend = () => {
        setListening(false);
        if (stopped) return;
        failures.current += 1;
        // Restart quickly; back off a little if it keeps ending immediately
        const delay = Math.min(250 * failures.current, 3000);
        restartTimer.current = setTimeout(start, delay);
      };

      recRef.current = rec;
      try { rec.start(); } catch (err) {
        restartTimer.current = setTimeout(start, 1000);
      }
    };

    start();
    return () => {
      stopped = true;
      clearTimeout(restartTimer.current);
      try { recRef.current?.abort(); } catch (e) { /* noop */ }
      recRef.current = null;
      setListening(false);
    };
  }, [active, SR]);

  return (
    <VoiceGuardContext.Provider value={{ supported, enabled, setEnabled, listening, active, error, heard }}>
      {children}
    </VoiceGuardContext.Provider>
  );
};

export const useVoiceGuard = () => useContext(VoiceGuardContext);
