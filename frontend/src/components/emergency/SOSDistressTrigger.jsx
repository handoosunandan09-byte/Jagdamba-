import React, { useRef, useState, useCallback } from "react";
import { useEmergency } from "../../context/EmergencyContext";
import { ShieldAlert } from "lucide-react";

const LONG_PRESS_MS = 1500;

// Persistent floating distress trigger. Default: long-press (1.5s) to avoid mis-clicks.
const SOSDistressTrigger = () => {
  const { phase, trigger } = useEmergency();
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  // user-configurable; default long-press on
  const longPress = (typeof localStorage !== "undefined" && localStorage.getItem("saathi_sos_longpress")) !== "false";

  const begin = useCallback((e) => {
    if (phase !== "idle") return;
    firedRef.current = false;
    if (!longPress) {
      firedRef.current = true;
      trigger();
      return;
    }
    setPressing(true);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      setPressing(false);
      trigger();
    }, LONG_PRESS_MS);
  }, [phase, longPress, trigger]);

  const end = useCallback(() => {
    clearTimeout(timerRef.current);
    setPressing(false);
  }, []);

  if (phase !== "idle") return null;

  return (
    <button
      onMouseDown={begin}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={begin}
      onTouchEnd={end}
      aria-label="Emergency SOS"
      className="absolute bottom-32 right-4 z-30 h-[68px] w-[68px] rounded-full bg-[#DC2626] text-white flex flex-col items-center justify-center shadow-[0_12px_28px_-6px_rgba(220,38,38,0.7)] active:scale-95 transition-transform select-none ring-4 ring-[#DC2626]/25"
    >
      {/* gentle always-on pulse so the safety button is easy to spot */}
      <span className="absolute inset-0 rounded-full bg-[#DC2626]/40 pulse-ring" />
      {pressing && (
        <span className="absolute inset-0 rounded-full border-[3px] border-white/80 animate-ping" />
      )}
      <ShieldAlert className="relative h-7 w-7" strokeWidth={2.4} />
      <span className="relative text-[10px] font-extrabold tracking-wide mt-0.5">SOS</span>
    </button>
  );
};

export default SOSDistressTrigger;
