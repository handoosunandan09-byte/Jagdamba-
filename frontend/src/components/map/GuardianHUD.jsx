import React, { useState, useEffect, useRef, useCallback } from "react";
import { safeRoutes } from "../../mapData";
import { useSOSDispatch } from "../../hooks/useSOSDispatch";
import { Shield, Phone, X, Timer, Route, ShieldCheck, Check, Loader2, PhoneCall, BellRing } from "lucide-react";

const CHECK_IN_SECONDS = 60; // one-minute check-in

const WOMEN_CELL = { name: "Police Women Helpline", number: "1091" };

const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

const fireNotification = (title, body) => {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification(title, { body });
      });
    }
  } catch (e) { /* noop */ }
};

const GuardianHUD = ({ activeRoute, onRoute, onExit }) => {
  const [seconds, setSeconds] = useState(CHECK_IN_SECONDS);
  const [phase, setPhase] = useState("monitoring"); // monitoring | dispatching | alerted
  const [result, setResult] = useState(null);
  const ref = useRef(null);
  const deadlineRef = useRef(Date.now() + CHECK_IN_SECONDS * 1000);
  const { dispatch } = useSOSDispatch();

  const route = safeRoutes[activeRoute];

  const runDispatch = useCallback(async () => {
    clearInterval(ref.current);
    setPhase("dispatching");
    vibrate([400, 150, 400, 150, 400]);
    fireNotification(
      "Jagdamba — Missed check-in",
      "No safe confirmation received. Alerting your emergency contacts and the police women cell with your live location."
    );
    try {
      const res = await dispatch({});
      setResult(res);
    } catch (e) {
      setResult({ recipients: [], nearest_police: null });
    }
    setPhase("alerted");
    // Attempt to place the call to the women helpline via a hidden anchor.
    // (Using an anchor instead of window.location.href avoids aborting the 3D map's
    //  in-flight module fetches, which would otherwise crash the Cesium view.)
    try {
      const a = document.createElement("a");
      a.href = `tel:${WOMEN_CELL.number}`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { a.remove(); } catch (e) {} }, 1200);
    } catch (e) { /* noop */ }
  }, [dispatch]);

  // One-minute check-in countdown (wall-clock based so it's accurate even if the
  // timer is throttled by the browser); missing it triggers the emergency dispatch.
  useEffect(() => {
    if (phase !== "monitoring") return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining <= 6 && remaining > 0) vibrate(80);
      if (Date.now() >= deadlineRef.current) {
        clearInterval(ref.current);
        runDispatch();
      }
    };
    tick();
    ref.current = setInterval(tick, 500);
    return () => clearInterval(ref.current);
  }, [phase, runDispatch]);

  const imSafe = () => {
    deadlineRef.current = Date.now() + CHECK_IN_SECONDS * 1000;
    setSeconds(CHECK_IN_SECONDS);
    setPhase("monitoring");
    vibrate(0);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const urgent = seconds <= 10;
  const police = result?.nearest_police;
  const recipientCount = result?.recipients?.length ?? 0;

  // ---- Alerted / dispatched state ----
  if (phase === "dispatching" || phase === "alerted") {
    return (
      <>
        <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-10">
          <div className="bg-[#DC2626] text-white rounded-full px-4 py-1.5 shadow-md flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span className="text-[12px] font-bold">EMERGENCY DISPATCHED</span>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 p-4">
          <div className="bg-white rounded-2xl shadow-[0_-6px_28px_-10px_rgba(15,23,42,0.3)] p-4">
            {phase === "dispatching" ? (
              <div className="flex items-center gap-2 text-[#DC2626] py-3 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-[14px] font-bold">Missed check-in — sending alerts…</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <BellRing className="h-4 w-4 text-[#DC2626]" />
                  <p className="text-[14px] font-extrabold text-[#1E293B]">Alerts sent &amp; call started</p>
                </div>
                <div className="space-y-1.5 text-[12.5px] text-[#334155] mb-3">
                  <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#059669]" /> Notified {recipientCount} emergency contact{recipientCount !== 1 ? "s" : ""} with live location</p>
                  <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#059669]" /> {WOMEN_CELL.name} ({WOMEN_CELL.number}) call initiated</p>
                  {police && <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#059669]" /> Nearest police: {police.name} ({police.distance_m}m)</p>}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <a href={`tel:${WOMEN_CELL.number}`} className="rounded-xl bg-[#DC2626] text-white py-3 text-[13.5px] font-bold flex items-center justify-center gap-2 hover:bg-[#B91C1C] transition-colors">
                    <PhoneCall className="h-4 w-4" /> Call 1091
                  </a>
                  <a href="tel:112" className="rounded-xl bg-[#1E293B] text-white py-3 text-[13.5px] font-bold flex items-center justify-center gap-2 hover:bg-[#0F172A] transition-colors">
                    <Phone className="h-4 w-4" /> Call 112
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                  <button onClick={imSafe} className="rounded-xl bg-[#ECFDF5] text-[#059669] py-3 text-[13.5px] font-bold flex items-center justify-center gap-2 hover:bg-[#d7f7ea] transition-colors">
                    <ShieldCheck className="h-4 w-4" /> I&apos;m safe now
                  </button>
                  <button onClick={onExit} className="rounded-xl bg-[#F1F5F9] text-[#334155] py-3 text-[13.5px] font-bold flex items-center justify-center gap-2 hover:bg-[#E2E8F0] transition-colors">
                    <X className="h-4 w-4" /> Exit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // ---- Monitoring state ----
  return (
    <>
      <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-10">
        <div className={`${urgent ? "bg-[#DC2626]" : "bg-[#059669]"} text-white rounded-full px-4 py-1.5 shadow-md flex items-center gap-2 transition-colors`}>
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <span className="text-[12px] font-bold">{urgent ? "Confirm you're safe!" : "Guardian Mode active"}</span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 p-4">
        <div className="bg-white/97 backdrop-blur rounded-2xl shadow-[0_-6px_28px_-10px_rgba(15,23,42,0.3)] p-4">
          {/* Route selector */}
          <div className="flex gap-2 mb-3">
            {Object.values(safeRoutes).map((r) => (
              <button
                key={r.id}
                onClick={() => onRoute(r.id)}
                className={`flex-1 rounded-xl border px-3 py-2 text-left transition-colors ${
                  activeRoute === r.id ? "border-[#059669] bg-[#ECFDF5]" : "border-[#E2E8F0] bg-white"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Route className="h-3.5 w-3.5" style={{ color: r.color }} />
                  <span className="text-[12px] font-bold text-[#1E293B]">{r.name}</span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5">{r.etaMin} min · {r.distanceKm} km · {r.lighting} light</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className={`rounded-xl p-3 ${urgent ? "bg-[#FEF2F2]" : "bg-[#F8FAFC]"}`}>
              <div className={`flex items-center gap-1.5 mb-0.5 ${urgent ? "text-[#DC2626]" : "text-[#64748B]"}`}><Timer className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold">Auto-alert in</span></div>
              <p className={`text-[20px] font-extrabold tabular-nums ${urgent ? "text-[#DC2626]" : "text-[#1E293B]"}`}>{fmt(seconds)}</p>
            </div>
            <div className="rounded-xl bg-[#F0FDFA] p-3">
              <div className="flex items-center gap-1.5 text-[#0D9488] mb-0.5"><Shield className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold">Police response</span></div>
              <p className="text-[20px] font-extrabold text-[#0D9488]">240 m</p>
            </div>
          </div>

          <p className="text-[11px] text-[#64748B] mb-2.5 text-center">If you don&apos;t confirm in time, Jagdamba calls {WOMEN_CELL.number} &amp; alerts your contacts.</p>

          <button onClick={imSafe} className="w-full rounded-xl bg-[#059669] text-white py-3 text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-[#047857] transition-colors mb-2.5">
            <ShieldCheck className="h-4 w-4" /> I&apos;m safe — reset timer
          </button>

          <div className="flex gap-3">
            <a href="tel:112" className="flex-1 rounded-xl bg-[#DC2626] text-white py-3 text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-[#B91C1C] transition-colors">
              <Phone className="h-4 w-4" /> Call 112
            </a>
            <button onClick={onExit} className="rounded-xl bg-[#F1F5F9] text-[#334155] px-4 py-3 text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-[#E2E8F0] transition-colors">
              <X className="h-4 w-4" /> Exit
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuardianHUD;
