import React, { useState, useEffect, useRef } from "react";
import { safeRoutes } from "../../mapData";
import { ShieldCheck, Shield, Phone, X, Timer, Route } from "lucide-react";

const GuardianHUD = ({ activeRoute, onRoute, onExit }) => {
  const [seconds, setSeconds] = useState(5 * 60); // 5 min check-in
  const ref = useRef(null);

  useEffect(() => {
    ref.current = setInterval(() => {
      setSeconds((s) => (s <= 1 ? 5 * 60 : s - 1));
    }, 1000);
    return () => clearInterval(ref.current);
  }, []);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const route = safeRoutes[activeRoute];

  return (
    <>
      {/* Active monitoring badge (top) */}
      <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-10">
        <div className="bg-[#059669] text-white rounded-full px-4 py-1.5 shadow-md flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <span className="text-[12px] font-bold">Guardian Mode active</span>
        </div>
      </div>

      {/* Bottom HUD card */}
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
            <div className="rounded-xl bg-[#F8FAFC] p-3">
              <div className="flex items-center gap-1.5 text-[#64748B] mb-0.5"><Timer className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold">Next check-in</span></div>
              <p className="text-[20px] font-extrabold text-[#1E293B] tabular-nums">{fmt(seconds)}</p>
            </div>
            <div className="rounded-xl bg-[#F0FDFA] p-3">
              <div className="flex items-center gap-1.5 text-[#0D9488] mb-0.5"><Shield className="h-3.5 w-3.5" /><span className="text-[11px] font-semibold">Police response</span></div>
              <p className="text-[20px] font-extrabold text-[#0D9488]">240 m</p>
            </div>
          </div>

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
