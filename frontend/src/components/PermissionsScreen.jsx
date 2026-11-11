import React, { useCallback, useEffect, useState } from "react";
import { MapPin, Mic, Camera, Bell, Activity, Check, X, Loader2, ShieldCheck, ChevronLeft } from "lucide-react";
import { useUser } from "../context/UserContext";
import { markPermsDone as markDone } from "../lib/perms";

// One place to grant everything Jagdamba needs, asked once at first run
// (and reachable later from Profile → App permissions).


const ITEMS = [
  { id: "location", icon: MapPin, title: "Location", why: "Share where you are in an SOS and find help nearby" },
  { id: "microphone", icon: Mic, title: "Microphone", why: "Voice SOS (“Jagdamba, I need help”) and audio evidence" },
  { id: "camera", icon: Camera, title: "Camera", why: "Record video evidence during an emergency" },
  { id: "notifications", icon: Bell, title: "Notifications", why: "Alerts for missed check-ins and nearby reports" },
  { id: "motion", icon: Activity, title: "Motion sensors", why: "Detect a crash or hard fall in Guardian Mode" },
];

const queryPermission = async (name) => {
  try {
    if (!navigator.permissions?.query) return "prompt";
    const r = await navigator.permissions.query({ name });
    return r.state; // granted | denied | prompt
  } catch (e) {
    return "prompt";
  }
};

const readStates = async () => {
  const motionSupported = typeof window.DeviceMotionEvent !== "undefined";
  const motionNeedsAsk = motionSupported && typeof window.DeviceMotionEvent.requestPermission === "function";
  return {
    location: navigator.geolocation ? await queryPermission("geolocation") : "unsupported",
    microphone: navigator.mediaDevices?.getUserMedia ? await queryPermission("microphone") : "unsupported",
    camera: navigator.mediaDevices?.getUserMedia ? await queryPermission("camera") : "unsupported",
    notifications: !("Notification" in window) ? "unsupported"
      : ({ granted: "granted", denied: "denied" }[Notification.permission] || "prompt"),
    // Android/desktop Chrome allow motion sensors without asking; iOS asks
    motion: !motionSupported ? "unsupported" : motionNeedsAsk ? "prompt" : "granted",
  };
};

const requestOne = async (id) => {
  switch (id) {
    case "location":
      return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
        () => resolve("granted"), (e) => resolve(e.code === 1 ? "denied" : "prompt"), { timeout: 15000 }
      ));
    case "microphone":
    case "camera": {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(id === "camera" ? { video: true } : { audio: true });
        stream.getTracks().forEach((t) => t.stop());
        return "granted";
      } catch (e) {
        return e.name === "NotAllowedError" ? "denied" : "unsupported";
      }
    }
    case "notifications": {
      const r = await Notification.requestPermission();
      return r === "default" ? "prompt" : r;
    }
    case "motion": {
      try {
        const r = await window.DeviceMotionEvent.requestPermission();
        return r === "granted" ? "granted" : "denied";
      } catch (e) {
        return "denied";
      }
    }
    default:
      return "prompt";
  }
};

const PermissionsScreen = ({ onDone, onBack }) => {
  const { retryLocation } = useUser();
  const [states, setStates] = useState({});
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(async () => setStates(await readStates()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const ask = async (id) => {
    if (states[id] === "granted" || states[id] === "unsupported") return;
    setBusy(id);
    const result = await requestOne(id);
    setStates((s) => ({ ...s, [id]: result }));
    if (id === "location" && result === "granted") retryLocation();
    setBusy(null);
  };

  const allowAll = async () => {
    // Prompts that need a fresh tap (notifications, iOS motion) go first
    for (const id of ["notifications", "motion", "location", "microphone", "camera"]) {
      if (states[id] === "prompt") {
        // eslint-disable-next-line no-await-in-loop
        await ask(id);
      }
    }
    await refresh();
  };

  const finish = () => { markDone(); onDone?.(); };
  const pending = ITEMS.filter((i) => states[i.id] === "prompt").length;

  return (
    <div className="flex flex-col h-full saathi-shell">
      {onBack && (
        <div className="p-4 pb-0">
          <button onClick={onBack} className="h-9 w-9 rounded-full bg-[#0E1A3A] border border-[#78BEFF]/20 flex items-center justify-center text-[#EEF4FF]" aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6 float-up">
        <span className="h-14 w-14 rounded-2xl bg-[#56E6FF]/10 flex items-center justify-center mb-4">
          <ShieldCheck className="h-7 w-7 text-[#56E6FF]" strokeWidth={2.4} />
        </span>
        <h2 className="text-[24px] font-extrabold tracking-tight text-[#EEF4FF]">Give Jagdamba access</h2>
        <p className="text-[13.5px] text-[#93A3CC] mt-1.5">
          Allow these now so nothing stops an alert in an emergency. Your browser will ask you to confirm each one.
        </p>

        <div className="mt-5 bg-[#0E1A3A] rounded-2xl border border-[#78BEFF]/20 divide-y divide-[#78BEFF]/15">
          {ITEMS.map((it) => {
            const I = it.icon;
            const st = states[it.id];
            return (
              <button key={it.id} onClick={() => ask(it.id)} disabled={busy !== null}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-[#13234D] transition-colors disabled:cursor-wait">
                <span className="h-9 w-9 shrink-0 rounded-full bg-[#56E6FF]/10 text-[#56E6FF] flex items-center justify-center"><I className="h-4.5 w-4.5" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-bold text-[#EEF4FF]">{it.title}</span>
                  <span className="block text-[11.5px] text-[#93A3CC] leading-snug">{it.why}</span>
                </span>
                {busy === it.id ? <Loader2 className="h-4.5 w-4.5 animate-spin text-[#93A3CC]" />
                  : st === "granted" ? <span className="flex items-center gap-1 text-[11.5px] font-bold text-[#56E6FF]"><Check className="h-4 w-4" /> Allowed</span>
                  : st === "denied" ? <span className="flex items-center gap-1 text-[11.5px] font-bold text-[#FFB066]"><X className="h-4 w-4" /> Blocked</span>
                  : st === "unsupported" ? <span className="text-[11px] text-[#7484AE]">Not available</span>
                  : <span className="text-[12px] font-bold text-[#FFB066]">Allow</span>}
              </button>
            );
          })}
        </div>

        {ITEMS.some((i) => states[i.id] === "denied") && (
          <p className="text-[12px] text-[#FFB066] mt-3 leading-snug">
            Blocked items can only be turned back on from your browser: tap the icon left of the address bar, then Permissions (or Site settings).
          </p>
        )}

        <button onClick={pending ? allowAll : finish} disabled={busy !== null}
          className="mt-6 w-full rounded-2xl bg-[#E5603C] text-white py-4 text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-[#d9542f] disabled:opacity-70 transition-colors">
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}
          {pending ? "Allow all" : "Continue"}
        </button>
        {pending > 0 && (
          <button onClick={finish} className="w-full mt-3 text-[13px] font-semibold text-[#93A3CC] py-2">Skip for now</button>
        )}
      </div>
    </div>
  );
};

export default PermissionsScreen;
