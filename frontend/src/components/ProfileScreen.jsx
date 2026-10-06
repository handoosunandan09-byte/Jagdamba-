import React from "react";
import { currentUser, emergencyContacts } from "../mock";
import { MapPin, Phone, Bell, ShieldCheck, Users, ChevronRight, LogOut } from "lucide-react";

const rows = [
  { icon: Users, label: "Trusted contacts", value: "3 added" },
  { icon: ShieldCheck, label: "Safety Mode defaults", value: "30 min" },
  { icon: Bell, label: "Alert notifications", value: "On" },
];

const ProfileScreen = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar float-up">
        <div className="px-5 pt-8 pb-6 flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-full bg-[#DCEEE9] text-[#1C8C78] text-[26px] font-extrabold flex items-center justify-center mb-3">
            {currentUser.initials}
          </div>
          <h2 className="text-[20px] font-extrabold text-[#1B2A28]">{currentUser.name}</h2>
          <div className="flex items-center gap-1 text-[13px] text-[#6B7A77] mt-1">
            <MapPin className="h-3.5 w-3.5" /> {currentUser.location}
          </div>
        </div>

        <div className="px-4 space-y-3">
          <div className="bg-white rounded-2xl border border-[#EFE7DB] divide-y divide-[#F1EADF]">
            {rows.map((r) => {
              const Icon = r.icon;
              return (
                <button key={r.label} className="w-full flex items-center gap-3 p-4 hover:bg-[#FBF7F1] transition-colors">
                  <span className="h-9 w-9 rounded-full bg-[#DCEEE9] text-[#1C8C78] flex items-center justify-center"><Icon className="h-4.5 w-4.5" /></span>
                  <span className="flex-1 text-left text-[14px] font-semibold text-[#1B2A28]">{r.label}</span>
                  <span className="text-[13px] text-[#6B7A77]">{r.value}</span>
                  <ChevronRight className="h-4 w-4 text-[#C3CCC9]" />
                </button>
              );
            })}
          </div>

          <div>
            <p className="text-[13px] font-semibold text-[#6B7A77] px-1 mb-2 mt-4">Emergency numbers</p>
            <div className="bg-white rounded-2xl border border-[#EFE7DB] divide-y divide-[#F1EADF]">
              {emergencyContacts.map((c) => {
                const Icon = c.icon;
                return (
                  <a key={c.id} href={`tel:${c.number}`} className="flex items-center gap-3 p-4 hover:bg-[#FBF7F1] transition-colors">
                    <span className="h-9 w-9 rounded-full bg-[#FBEAE3] text-[#E5603C] flex items-center justify-center"><Icon className="h-4.5 w-4.5" /></span>
                    <span className="flex-1 text-[14px] font-semibold text-[#1B2A28]">{c.label}</span>
                    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[#E5603C]"><Phone className="h-3.5 w-3.5" />{c.number}</span>
                  </a>
                );
              })}
            </div>
          </div>

          <button className="w-full flex items-center justify-center gap-2 text-[14px] font-semibold text-[#6B7A77] py-4 mt-2 hover:text-[#E5603C] transition-colors">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
