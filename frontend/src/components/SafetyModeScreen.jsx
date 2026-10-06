import React, { useState, useEffect, useRef } from "react";
import ScreenHeader from "./ScreenHeader";
import { ShieldCheck, Clock, UserPlus, Square } from "lucide-react";
import { toast } from "sonner";

const durations = [15, 30, 60];

const SafetyModeScreen = ({ onBack }) => {
  const [selected, setSelected] = useState(30);
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const start = () => {
    setActive(true);
    setRemaining(selected * 60);
    toast.success("Safety Mode started", { description: `We'll check in every ${selected} minutes.` });
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(timerRef.current); setActive(false); return 0; }
        return r - 1;
      });
    }, 1000);
  };

  const stop = () => {
    clearInterval(timerRef.current);
    setActive(false);
    setRemaining(0);
    toast("Safety Mode stopped", { description: "Your trusted contact has been notified you're safe." });
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="Safety Mode" subtitle="Timed check-ins with your circle" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 float-up">
        <div className="relative flex items-center justify-center my-4" style={{ height: 240 }}>
          {active && <span className="absolute h-[180px] w-[180px] rounded-full bg-[#1C8C78]/25 pulse-ring" />}
          <div
            className="h-[180px] w-[180px] rounded-full flex flex-col items-center justify-center text-white shadow-[0_18px_40px_-12px_rgba(28,140,120,0.6)]"
            style={{ background: active
              ? "radial-gradient(circle at 50% 35%, #2BA98F 0%, #1C8C78 60%, #167766 100%)"
              : "radial-gradient(circle at 50% 35%, #3a4f4a 0%, #27403b 60%, #17302B 100%)" }}
          >
            <ShieldCheck className="h-8 w-8 mb-1" />
            <span className="text-[26px] font-extrabold tracking-tight">{active ? fmt(remaining) : "Ready"}</span>
            <span className="text-[12px] text-white/80">{active ? "Next check-in" : "Safety Mode off"}</span>
          </div>
        </div>

        {!active && (
          <>
            <p className="text-[13px] font-semibold text-[#6B7A77] mb-3">Check-in interval</p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {durations.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelected(d)}
                  className={`rounded-2xl border py-4 flex flex-col items-center transition-all ${
                    selected === d
                      ? "border-[#E5603C] bg-[#FBEAE3] text-[#E5603C]"
                      : "border-[#EFE7DB] bg-white text-[#1B2A28] hover:border-[#E5603C]/40"
                  }`}
                >
                  <Clock className="h-5 w-5 mb-1" />
                  <span className="text-[16px] font-bold">{d}</span>
                  <span className="text-[11px] opacity-70">minutes</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="bg-white rounded-2xl border border-[#EFE7DB] p-4 flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-[#DCEEE9] text-[#1C8C78] flex items-center justify-center"><UserPlus className="h-4.5 w-4.5" /></span>
            <div>
              <p className="text-[14px] font-bold text-[#1B2A28]">Trusted contact</p>
              <p className="text-[12px] text-[#6B7A77]">Mom • +91 99887 76655</p>
            </div>
          </div>
          <button className="text-[12px] font-semibold text-[#1C8C78]">Change</button>
        </div>

        {!active ? (
          <button onClick={start} className="w-full rounded-2xl bg-[#E5603C] text-white py-4 text-[15px] font-bold shadow-[0_12px_28px_-10px_rgba(229,96,60,0.6)] hover:bg-[#d9542f] active:scale-[0.99] transition-all">
            Start Safety Mode
          </button>
        ) : (
          <button onClick={stop} className="w-full rounded-2xl bg-white border-2 border-[#E5603C] text-[#E5603C] py-4 text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-[#FBEAE3] transition-colors">
            <Square className="h-4 w-4 fill-current" /> Stop & mark me safe
          </button>
        )}
      </div>
    </div>
  );
};

export default SafetyModeScreen;
