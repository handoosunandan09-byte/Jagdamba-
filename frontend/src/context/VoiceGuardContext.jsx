import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useEmergency } from "./EmergencyContext";
import { isWakePhrase, hasName, hasHelp, isDismiss, normalise } from "../lib/wakePhrase";
import { useUser } from "./UserContext";
import { sendChat, getSessionId } from "../lib/api";

// Hands-free SOS: while enabled, keeps the browser's speech recogniser running and
// starts the SOS countdown when it hears "Jagdamba, I need help".
// Works only while the app is open on screen (browsers don't allow background
// listening), so we also hold a screen wake lock while it's on.

const STORAGE_KEY = "jagdamba_voice_sos";
const AWAKE_MS = 10000; // how long the orb keeps listening after hearing "Jagdamba" or answering

// Speaks out loud (Siri-style). While the phone is talking we ignore what the
// microphone hears, so Jagdamba can't trigger SOS by hearing her own voice.
const speakingUntil = { t: 0 };
const isSpeaking = () => Date.now() < speakingUntil.t || !!window.speechSynthesis?.speaking;
const say = (text) => new Promise((resolve) => {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) { resolve(); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 1.02;
    const voice = synth.getVoices().find((v) => v.lang === "en-IN") || synth.getVoices().find((v) => v.lang?.startsWith("en"));
    if (voice) u.voice = voice;
    // Rough upper bound in case "end" never fires
    speakingUntil.t = Date.now() + 1500 + text.length * 90;
    const done = () => { speakingUntil.t = Date.now() + 700; resolve(); };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  } catch (e) { resolve(); }
});

// Text spoken after the name, e.g. "Jagdamba where is the nearest hospital"
const afterName = (text) => normalise(text).replace(/^.*?jag\s*a?\s*d?\s*h?\s*amb\S*\s*/, "").trim();
const VoiceGuardContext = createContext(null);

const readEnabled = () => { try { return localStorage.getItem(STORAGE_KEY) === "on"; } catch (e) { return false; } };
const writeEnabled = (on) => { try { localStorage.setItem(STORAGE_KEY, on ? "on" : "off"); } catch (e) { /* noop */ } };

export const VoiceGuardProvider = ({ paused = false, children }) => {
  const { phase, trigger } = useEmergency();
  const { coords } = useUser();
  const coordsRef = useRef(coords);
  coordsRef.current = coords;
  const sessionId = useRef(getSessionId()).current;
  // Conversation with the assistant: idle | thinking | speaking
  const [chat, setChat] = useState({ status: "idle", you: "", reply: "" });
  const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const supported = !!SR;

  const [enabled, setEnabledState] = useState(() => supported && readEnabled());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [heard, setHeard] = useState("");
  const [awake, setAwake] = useState(false);
  const awakeRef = useRef(false);
  const awakeTimer = useRef(null);

  const recRef = useRef(null);
  const wakeLockRef = useRef(null);
  const restartTimer = useRef(null);
  const failures = useRef(0);
  const triggerRef = useRef(trigger);
  triggerRef.current = trigger;
  const wakeRef = useRef(() => {});
  const sleepRef = useRef(() => {});

  const active = supported && enabled && !paused && phase === "idle";

  const sleep = useCallback(() => {
    clearTimeout(awakeTimer.current);
    awakeRef.current = false;
    setAwake(false);
    setChat({ status: "idle", you: "", reply: "" });
    try { window.speechSynthesis?.cancel(); } catch (e) { /* noop */ }
  }, []);

  const keepAwake = useCallback(() => {
    clearTimeout(awakeTimer.current);
    awakeTimer.current = setTimeout(() => sleepRef.current(), AWAKE_MS);
  }, []);

  // Ask Jagdamba (Gemini) and speak the answer, then keep listening for a follow-up
  const ask = useCallback(async (question) => {
    if (!question) return;
    clearTimeout(awakeTimer.current);
    setChat({ status: "thinking", you: question, reply: "" });
    let reply;
    try {
      reply = await sendChat(sessionId, question, coordsRef.current);
    } catch (e) {
      reply = "I couldn't reach the internet just now. If you're in danger, say bachao and I'll alert your contacts.";
    }
    if (!awakeRef.current) return; // closed while thinking
    setChat({ status: "speaking", you: question, reply });
    await say(reply);
    if (!awakeRef.current) return;
    setChat((c) => ({ ...c, status: "idle" }));
    keepAwake();
  }, [sessionId, keepAwake]);
  const askRef = useRef(ask);
  askRef.current = ask;
  const keepAwakeRef = useRef(keepAwake);
  keepAwakeRef.current = keepAwake;

  // "Jagdamba" heard (or orb tapped): open a short listening window
  const wake = useCallback((speak = true) => {
    clearTimeout(awakeTimer.current);
    awakeRef.current = true;
    setAwake(true);
    try { navigator.vibrate && navigator.vibrate(60); } catch (e) { /* noop */ }
    setChat({ status: "idle", you: "", reply: "" });
    if (speak) say("I'm here. Tell me what happened.");
    awakeTimer.current = setTimeout(sleep, AWAKE_MS);
  }, [sleep]);

  const fireSos = useCallback(() => {
    sleep();
    triggerRef.current();
  }, [sleep]);

  wakeRef.current = wake;
  sleepRef.current = sleep;
  useEffect(() => { if (!active) sleep(); }, [active, sleep]);
  useEffect(() => () => clearTimeout(awakeTimer.current), []);

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
        // Ignore the phone's own voice
        if (isSpeaking()) return;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          for (let a = 0; a < res.length; a++) {
            const text = res[a].transcript;
            // Full phrase, or a help word while the orb is awake → SOS
            if (isWakePhrase(text) || (awakeRef.current && hasHelp(text))) {
              setHeard(text);
              stopped = true;
              try { rec.abort(); } catch (err) { /* noop */ }
              fireSos();
              return;
            }
          }
          const best = res[0].transcript;
          if (res.isFinal && awakeRef.current && isDismiss(best)) {
            say("Okay. I'm still here if you need me.");
            sleepRef.current();
          } else if (!awakeRef.current && hasName(best)) {
            // Show the orb as soon as the name is heard; reply once they finish speaking
            wakeRef.current(false);
            if (res.isFinal) {
              const rest = afterName(best);
              if (rest) askRef.current(rest);
              else { say("I'm here. Tell me what happened."); keepAwakeRef.current(); }
            }
          } else if (awakeRef.current && res.isFinal && best.trim()) {
            // Anything said while the orb is open is a question for Jagdamba
            const rest = hasName(best) ? afterName(best) : best.trim();
            if (rest) askRef.current(rest);
            else { say("I'm here. Tell me what happened."); keepAwakeRef.current(); }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, SR]);

  return (
    <VoiceGuardContext.Provider value={{ supported, enabled, setEnabled, listening, active, error, heard, awake, wake, sleep, fireSos, chat, ask }}>
      {children}
    </VoiceGuardContext.Provider>
  );
};

export const useVoiceGuard = () => useContext(VoiceGuardContext);
