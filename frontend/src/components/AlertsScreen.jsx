import React from "react";
import { communityAlerts } from "../mock";
import { AlertTriangle, MapPin } from "lucide-react";

const levelStyle = {
  high: { dot: "bg-[#E5603C]", chip: "bg-[#FBEAE3] text-[#C1452A]", label: "High" },
  medium: { dot: "bg-[#E0A13C]", chip: "bg-[#FBF1DE] text-[#B07A1E]", label: "Medium" },
  low: { dot: "bg-[#2F6B4A]", chip: "bg-[#E4EEE2] text-[#2F6B4A]", label: "Info" },
};

const AlertsScreen = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-2">
        <h2 className="text-[26px] font-extrabold tracking-tight text-[#1B2A28]">Community Alerts</h2>
        <p className="text-[13px] text-[#6B7A77] mt-1">Real-time safety updates near you</p>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-3 float-up">
        {communityAlerts.map((a) => {
          const s = levelStyle[a.level];
          return (
            <div key={a.id} className="bg-white rounded-2xl border border-[#EFE7DB] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ${s.chip}`}><AlertTriangle className="h-4 w-4" /></span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.chip}`}>{s.label}</span>
                </div>
                <span className="text-[11px] text-[#9AA7A3]">{a.time}</span>
              </div>
              <p className="text-[15px] font-bold text-[#1B2A28] mt-2.5">{a.title}</p>
              <p className="text-[13px] text-[#6B7A77] mt-1 leading-snug">{a.desc}</p>
              <div className="flex items-center gap-1 mt-2.5 text-[12px] font-medium text-[#2F6B4A]">
                <MapPin className="h-3.5 w-3.5" /> {a.area}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlertsScreen;
