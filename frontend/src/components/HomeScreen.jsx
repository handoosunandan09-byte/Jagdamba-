import React from "react";
import { quickActions, emergencyContacts } from "../mock";
import { Phone, Navigation, Radar, ChevronRight, Box } from "lucide-react";

const HomeScreen = ({ onNavigate }) => {
  return (
    <div className="px-5 pb-6 float-up">
      <div className="mt-1 mb-4">
        <h2 className="text-[30px] leading-[1.12] font-extrabold tracking-tight text-[#2A2A22]">
          How can <span className="text-[#2F6B4A]">Jagdamba</span><br />help you?
        </h2>
        <p className="mt-2.5 text-[14px] text-[#6E6A5E] max-w-[300px]">
          Just tell us what happened and we&apos;ll find you the best help.
        </p>
      </div>

      {/* Guardian City 3D map entry */}
      <button
        onClick={() => onNavigate("guardianmap")}
        className="w-full mb-5 text-left rounded-2xl bg-[#0D9488] text-white p-4 flex items-center gap-3.5 shadow-[0_10px_24px_-10px_rgba(13,148,136,0.6)] hover:bg-[#0B827B] transition-colors"
      >
        <span className="h-11 w-11 shrink-0 rounded-full bg-white/20 flex items-center justify-center">
          <Box className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold leading-tight">Guardian City · 3D Map</p>
          <p className="text-[12px] text-white/85 mt-0.5 leading-snug">Explore the live 3D safety map of Bengaluru</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0" />
      </button>

      {/* Map card with the help button */}
      <div className="relative rounded-[26px] map-card border border-[#DED6C2] overflow-hidden shadow-[0_8px_24px_-12px_rgba(42,42,34,0.25)]">
        {/* route accent line */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 260" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-10 70 L120 120 L200 60 L320 110" stroke="#C9A24B" strokeWidth="4" fill="none" opacity="0.5" strokeLinecap="round" />
          <path d="M40 -10 L90 110 L60 260" stroke="#8FA67E" strokeWidth="3" fill="none" opacity="0.4" strokeLinecap="round" />
        </svg>

        <div className="relative flex items-center justify-center py-8">
          <span className="absolute h-[196px] w-[196px] rounded-full bg-[#2F6B4A]/12 pulse-ring" />
          <button
            onClick={() => onNavigate("sos")}
            className="relative h-[188px] w-[188px] rounded-full flex flex-col items-center justify-center bg-[#FBF8F1] border border-[#E6DFCF] shadow-[0_14px_34px_-12px_rgba(42,42,34,0.35)] active:scale-95 transition-transform duration-200"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-white mb-2 shadow-[0_6px_14px_-4px_rgba(229,96,60,0.7)]"
              style={{ background: "radial-gradient(circle at 50% 35%, #F0734E 0%, #E5603C 70%)" }}
            >
              <Navigation className="h-5 w-5 -rotate-45" strokeWidth={2.3} />
            </span>
            <span className="text-[24px] font-extrabold leading-[1.05] tracking-tight text-[#2E2E22] text-center">
              I NEED<br />HELP
            </span>
            <span className="mt-1.5 text-[11.5px] font-medium text-[#8A8575]">Tap and tell Jagdamba</span>
          </button>
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 gap-3.5 mt-5">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => onNavigate(a.route)}
              className="group text-left bg-white rounded-2xl border border-[#E7E0D1] p-4 shadow-[0_4px_16px_-8px_rgba(42,42,34,0.12)] hover:shadow-[0_10px_24px_-10px_rgba(42,42,34,0.22)] hover:-translate-y-0.5 transition-all duration-200"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#2F6B4A] text-white mb-3 group-hover:bg-[#285C40] transition-colors">
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </span>
              <p className="text-[15px] font-bold text-[#2A2A22] leading-tight">{a.title}</p>
              <p className="text-[11.5px] text-[#6E6A5E] mt-1 leading-snug">{a.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* Guardian Mode banner */}
      <button
        onClick={() => onNavigate("guardian")}
        className="w-full mt-5 text-left rounded-2xl border border-[#2F6B4A]/25 bg-[#E4EEE2] p-4 flex items-center gap-3.5 hover:bg-[#dbe9d8] transition-colors"
      >
        <span className="relative h-11 w-11 shrink-0 rounded-full bg-[#2F6B4A] text-white flex items-center justify-center">
          <Radar className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#E5603C] border-2 border-[#E4EEE2]" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#28503B] leading-tight">Guardian Mode</p>
          <p className="text-[12px] text-[#4B6B59] mt-0.5 leading-snug">Auto-detects a crash or hard fall and alerts your circle — even if you can&apos;t</p>
        </div>
        <ChevronRight className="h-5 w-5 text-[#2F6B4A] shrink-0" />
      </button>

      {/* Emergency quick dial */}
      <div className="mt-6">
        <p className="text-[13px] font-semibold text-[#6E6A5E] mb-3 px-1">Emergency quick dial</p>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {emergencyContacts.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.id}
                href={`tel:${c.number}`}
                className="shrink-0 w-[108px] bg-white rounded-2xl border border-[#E7E0D1] p-3 flex flex-col items-center text-center hover:border-[#E5603C]/40 transition-colors"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FBEAE3] text-[#E5603C] mb-2">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
                </span>
                <span className="text-[12.5px] font-semibold text-[#2A2A22] leading-tight">{c.label}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-[#E5603C]">
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
