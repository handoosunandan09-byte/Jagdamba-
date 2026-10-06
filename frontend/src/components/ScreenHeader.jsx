import React from "react";
import { ChevronLeft } from "lucide-react";

const ScreenHeader = ({ title, subtitle, onBack }) => {
  return (
    <div className="sticky top-0 z-10 bg-[#FBF7F1]/90 backdrop-blur px-4 pt-5 pb-3 flex items-center gap-3">
      <button
        onClick={onBack}
        className="h-9 w-9 rounded-full bg-white border border-[#EFE7DB] flex items-center justify-center text-[#1B2A28] hover:bg-[#F3ECE1] transition-colors"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="leading-tight">
        <h2 className="text-[18px] font-extrabold text-[#1B2A28]">{title}</h2>
        {subtitle && <p className="text-[12px] text-[#6B7A77]">{subtitle}</p>}
      </div>
    </div>
  );
};

export default ScreenHeader;
