import React from "react";
import ScreenHeader from "./ScreenHeader";
import { nearbyHelp } from "../mock";
import { Phone, Navigation, Box, ChevronRight } from "lucide-react";

const NearbyScreen = ({ onBack, onOpenMap }) => {
  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="Nearby Help" subtitle="Koramangala, Bengaluru" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 float-up">
        <button onClick={onOpenMap} className="relative w-full text-left rounded-2xl overflow-hidden border border-[#EFE7DB] mb-2 h-36 bg-[#E7EEEC] group">
          <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(0deg,#dfeae6,#eef4f1)", backgroundSize: "cover" }} />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle,#cdddd7 1px,transparent 1px)", backgroundSize: "18px 18px" }} />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="block h-4 w-4 rounded-full bg-[#0D9488] ring-4 ring-[#0D9488]/25" />
          </span>
          <span className="absolute top-2 left-2 text-[10px] font-bold text-white bg-[#0D9488] rounded-full px-2 py-0.5 flex items-center gap-1"><Box className="h-3 w-3" /> 3D Guardian City</span>
          <span className="absolute bottom-2 right-2 text-[11px] font-semibold text-[#0D9488] bg-white/90 rounded-full px-2.5 py-1 flex items-center gap-1 group-hover:bg-white transition-colors">Open map <ChevronRight className="h-3 w-3" /></span>
        </button>
        <button onClick={onOpenMap} className="w-full mb-4 rounded-xl bg-[#0D9488] text-white py-2.5 text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-[#0B827B] transition-colors">
          <Box className="h-4 w-4" /> Explore 3D spatial safety map
        </button>

        <div className="space-y-3">
          {nearbyHelp.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-[#EFE7DB] p-4 flex items-center gap-3">
                <span className="h-11 w-11 shrink-0 rounded-full bg-[#E4EEE2] text-[#2F6B4A] flex items-center justify-center"><Icon className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-bold text-[#1B2A28] truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[12px] text-[#6B7A77]">
                    <span>{p.type}</span>
                    <span className="h-1 w-1 rounded-full bg-[#CBD4D1]" />
                    <span>{p.distance}</span>
                    <span className={`font-semibold ${p.open ? "text-[#2F6B4A]" : "text-[#C15B3C]"}`}>{p.open ? "Open" : "Closed"}</span>
                  </div>
                </div>
                <a href={`tel:${p.phone}`} className="h-9 w-9 rounded-full bg-[#E5603C] text-white flex items-center justify-center hover:bg-[#d9542f] transition-colors" aria-label="Call">
                  <Phone className="h-4 w-4" />
                </a>
                <button className="h-9 w-9 rounded-full bg-[#E4EEE2] text-[#2F6B4A] flex items-center justify-center hover:bg-[#d7e6d4] transition-colors" aria-label="Directions">
                  <Navigation className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NearbyScreen;
