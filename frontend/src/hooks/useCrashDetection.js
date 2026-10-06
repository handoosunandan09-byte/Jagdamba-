import { useState, useRef, useCallback, useEffect } from "react";

// Crash / hard-fall detection using the browser DeviceMotion (accelerometer) API.
// Best-effort: web sensors are less reliable than native crash detection.
const GRAVITY = 9.81;

export const useCrashDetection = ({ threshold = 30, onImpact }) => {
  const [armed, setArmed] = useState(false);
  const [supported, setSupported] = useState(true);
  const [peakG, setPeakG] = useState(1); // resting ~1g
  const lastTrigger = useRef(0);
  const onImpactRef = useRef(onImpact);

  useEffect(() => { onImpactRef.current = onImpact; }, [onImpact]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.DeviceMotionEvent === "undefined") {
      setSupported(false);
    }
  }, []);

  const onMotion = useCallback((e) => {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a) return;
    const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
    const g = mag / GRAVITY;
    setPeakG((prev) => Math.max(prev * 0.9, g)); // decaying live peak
    if (mag >= threshold && Date.now() - lastTrigger.current > 5000) {
      lastTrigger.current = Date.now();
      if (onImpactRef.current) onImpactRef.current(g);
    }
  }, [threshold]);

  const arm = useCallback(async () => {
    // iOS 13+ requires explicit permission, triggered from a user gesture
    try {
      if (
        typeof window.DeviceMotionEvent !== "undefined" &&
        typeof window.DeviceMotionEvent.requestPermission === "function"
      ) {
        const res = await window.DeviceMotionEvent.requestPermission();
        if (res !== "granted") return false;
      }
    } catch (err) {
      return false;
    }
    window.addEventListener("devicemotion", onMotion);
    setArmed(true);
    return true;
  }, [onMotion]);

  const disarm = useCallback(() => {
    window.removeEventListener("devicemotion", onMotion);
    setArmed(false);
    setPeakG(1);
  }, [onMotion]);

  const simulate = useCallback(() => {
    lastTrigger.current = Date.now();
    if (onImpactRef.current) onImpactRef.current(8.5);
  }, []);

  useEffect(() => () => window.removeEventListener("devicemotion", onMotion), [onMotion]);

  return { armed, supported, peakG, arm, disarm, simulate };
};
