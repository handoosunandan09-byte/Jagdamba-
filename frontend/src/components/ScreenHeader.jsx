import React from "react";
import { ChevronLeft } from "lucide-react";

const ScreenHeader = ({ title, subtitle, onBack }) => {
  return (
    <div className="sticky top-0 z-10 bg-[#02050F]/85 backdrop-blur px-4 pt-5 pb-3 flex items-center gap-3">
      <button
        onClick={onBack}
        className="h-11 w-11 rounded-[14px] border border-[#78BEFF]/30 flex items-center justify-center text-[#EEF4FF] hover:bg-[#3D7BFF]/15 transition-colors"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="leading-tight">
        <h2 className="text-[18px] font-semibold text-[#EEF4FF]">{title}</h2>
        {subtitle && <p className="text-[12px] text-[#93A3CC]">{subtitle}</p>}
      </div>
    </div>
  );
};

export default ScreenHeader;
