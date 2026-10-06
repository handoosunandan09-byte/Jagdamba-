import React from "react";
import { quickActions, emergencyContacts } from "../mock";
import { Phone } from "lucide-react";

const HomeScreen = ({ onNavigate }) => {
  return (
    <div className="px-5 pb-6 float-up">
      <div className="text-center mt-2 mb-6">
        <h2 className="text-[32px] leading-[1.1] font-extrabold tracking-tight text-[#1B2A28]">
          How can Saathi<br />help you?
        </h2>
        <p className="mt-3 text-[14px] text-[#6B7A77] max-w-[280px] mx-auto">
          Tell Saathi what happened. We&apos;ll help you find the right help.
        </p>
      </div>

      {/* I NEED HELP button */}
      <div className="relative flex items-center justify-center my-4" style={{ height: 300 }}>
        <div className="absolute inset-0 help-glow rounded-full" />
        <span className="absolute h-[220px] w-[220px] rounded-full bg-[#E5603C]/30 pulse-ring" />
        <button
          onClick={() => onNavigate("talk", { emergency: true })}
          className="relative h-[210px] w-[210px] rounded-full flex flex-col items-center justify-center text-white shadow-[0_18px_40px_-10px_rgba(229,96,60,0.65)] active:scale-95 transition-transform duration-200"
          style={{ background: "radial-gradient(circle at 50% 35%, #F0734E 0%, #E5603C 55%, #D9542F 100%)" }}
        >
          <span className="text-[30px] font-extrabold leading-[1.05] tracking-tight">I NEED<br />HELP</span>
          <span className="mt-2 text-[12px] font-medium text-white/85">Tap and tell Saathi</span>
        </button>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 gap-3.5 mt-2">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => onNavigate(a.route)}
              className="group text-left bg-white rounded-2xl border border-[#EFE7DB] p-4 shadow-[0_4px_16px_-8px_rgba(27,42,40,0.12)] hover:shadow-[0_10px_24px_-10px_rgba(27,42,40,0.22)] hover:-translate-y-0.5 transition-all duration-200"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#DCEEE9] text-[#1C8C78] mb-3 group-hover:bg-[#cfe8e2] transition-colors">
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </span>
              <p className="text-[15px] font-bold text-[#1B2A28] leading-tight">{a.title}</p>
              <p className="text-[12px] text-[#6B7A77] mt-1">{a.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* Emergency quick dial */}
      <div className="mt-6">
        <p className="text-[13px] font-semibold text-[#6B7A77] mb-3 px-1">Emergency quick dial</p>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {emergencyContacts.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.id}
                href={`tel:${c.number}`}
                className="shrink-0 w-[108px] bg-white rounded-2xl border border-[#EFE7DB] p-3 flex flex-col items-center text-center hover:border-[#E5603C]/40 transition-colors"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FBEAE3] text-[#E5603C] mb-2">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
                </span>
                <span className="text-[12.5px] font-semibold text-[#1B2A28] leading-tight">{c.label}</span>
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
