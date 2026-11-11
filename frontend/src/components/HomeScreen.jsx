import React from "react";
import { quickActions, emergencyContacts } from "../config";
import { useUser } from "../context/UserContext";
import VoiceSosCard from "./VoiceSosCard";
import { Phone, Navigation, Radar, ChevronRight, Box, MapPin } from "lucide-react";

// Ring geometry for the help button: 108 ticks (a mala's count) and 8 lotus petals
const TICKS = (() => {
  let d = "";
  for (let i = 0; i < 108; i++) {
    const a = (i / 108) * Math.PI * 2, r1 = i % 9 === 0 ? 108 : 111, r2 = 116;
    d += `M${(120 + Math.cos(a) * r1).toFixed(1)} ${(120 + Math.sin(a) * r1).toFixed(1)} L${(120 + Math.cos(a) * r2).toFixed(1)} ${(120 + Math.sin(a) * r2).toFixed(1)} `;
  }
  return d;
})();
const PETALS = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4 + Math.PI / 8, w = 0.12;
  const p = (ang, r) => `${(120 + Math.cos(ang) * r).toFixed(1)} ${(120 + Math.sin(ang) * r).toFixed(1)}`;
  return `M${p(a - w, 100)} Q${p(a - w * 0.6, 112)} ${p(a, 118)} Q${p(a + w * 0.6, 112)} ${p(a + w, 100)}`;
});

const Row = ({ icon: Icon, title, subtitle, onClick, accent }) => (
  <button
    onClick={onClick}
    className="w-full text-left flex items-center gap-3.5 min-h-[68px] px-3 py-3 rounded-[18px] border border-[#78BEFF]/20 holo-glass hover:border-[#56E6FF]/45 transition-colors"
  >
    <span className={`relative h-11 w-11 shrink-0 rounded-[13px] flex items-center justify-center border ${accent ? "bg-[#F4C26B]/10 border-[#F4C26B]/30 text-[#F4C26B]" : "bg-[#56E6FF]/[0.08] border-[#56E6FF]/25 text-[#56E6FF]"}`}>
      <Icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-[15.5px] font-medium text-[#EEF4FF] leading-tight">{title}</span>
      <span className="block text-[12px] font-light text-[#93A3CC] mt-0.5 leading-snug">{subtitle}</span>
    </span>
    <ChevronRight className="h-[18px] w-[18px] text-[#93A3CC] shrink-0" />
  </button>
);

const HomeScreen = ({ onNavigate }) => {
  const { firstName, place, locStatus } = useUser();
  const locLine = locStatus === "ok"
    ? `Location ready${place?.city ? ` · ${place.city}` : ""}`
    : locStatus === "denied" ? "Location access is blocked" : "Finding your location…";

  return (
    <div className="px-5 pb-6 float-up">
      <p className="mt-1 text-[15px] font-light text-[#B8C4E4]">
        {firstName ? `Hi ${firstName}, you're protected.` : "You're protected."}
      </p>

      {/* Help button inside the shield ring */}
      <div className="relative mx-auto mt-4 h-[240px] w-[240px]">
        <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="homeArc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#BFE9FF" /><stop offset="0.5" stopColor="#56E6FF" /><stop offset="1" stopColor="#3D7BFF" />
            </linearGradient>
          </defs>
          <path d={TICKS} stroke="#F4C26B" strokeOpacity="0.35" strokeWidth="1" />
          {PETALS.map((d, i) => <path key={i} d={d} fill="none" stroke="#F4C26B" strokeOpacity="0.3" strokeWidth="1" />)}
          <circle cx="120" cy="120" r="94" fill="none" stroke="#56E6FF" strokeOpacity="0.12" strokeWidth="10" />
          <g className="holo-spin" style={{ transformOrigin: "120px 120px", animationDuration: "18s" }}>
            <circle cx="120" cy="120" r="94" fill="none" stroke="url(#homeArc)" strokeWidth="10" strokeLinecap="round" strokeDasharray="420 171" style={{ filter: "drop-shadow(0 0 8px rgba(86,230,255,0.6))" }} />
          </g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
        <span className="absolute h-[156px] w-[156px] rounded-full bg-[#3D7BFF]/25 pulse-ring" />
        <button
          onClick={() => onNavigate("sos")}
          className="relative h-[156px] w-[156px] rounded-full flex flex-col items-center justify-center border border-[#BFE9FF]/35 active:scale-95 transition-transform"
          style={{ background: "radial-gradient(circle at 50% 35%, rgba(61,123,255,0.65), rgba(11,26,68,0.95) 75%)" }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-white mb-1.5 shadow-[0_0_18px_rgba(255,120,60,0.7)]" style={{ background: "radial-gradient(circle at 50% 35%, #FFB066, #FF6A2B 75%)" }}>
            <Navigation className="h-[18px] w-[18px] -rotate-45" strokeWidth={2.3} />
          </span>
          <span className="font-holo-label text-[15px] leading-[1.35] tracking-[0.12em] text-[#EEF4FF] text-center">I NEED<br />HELP</span>
          <span className="mt-1 text-[11px] font-light text-[#BFE9FF]">Tap and tell Jagdamba</span>
        </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-light text-[#93A3CC]">
        <MapPin className="h-3.5 w-3.5 text-[#56E6FF]" /> {locLine}
      </div>

      {/* Hands-free SOS */}
      <VoiceSosCard />

      <div className="mt-5 flex flex-col gap-2.5">
        <Row icon={Radar} title="Guardian Mode" subtitle="Detects a crash or hard fall and alerts your circle" onClick={() => onNavigate("guardian")} accent />
        {quickActions.map((a) => (
          <Row key={a.id} icon={a.icon} title={a.title} subtitle={a.subtitle} onClick={() => onNavigate(a.route)} />
        ))}
        <Row icon={Box} title="Guardian City · 3D Map" subtitle={`Live 3D safety map around ${place?.city || "you"}`} onClick={() => onNavigate("guardianmap")} />
      </div>

      {/* Emergency quick dial */}
      <div className="mt-6">
        <p className="font-holo-label text-[10px] tracking-[0.35em] text-[#93A3CC] mb-3 px-1">EMERGENCY QUICK DIAL</p>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {emergencyContacts.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.id}
                href={`tel:${c.number}`}
                className="shrink-0 w-[108px] rounded-2xl border border-[#78BEFF]/20 holo-glass p-3 flex flex-col items-center text-center hover:border-[#FF9933]/50 transition-colors"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FF9933]/15 text-[#FFB066] mb-2">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span className="text-[12.5px] font-medium text-[#EEF4FF] leading-tight">{c.label}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-[#FFB066] tabular-nums">
                  <Phone className="h-3 w-3" /> {c.number}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
