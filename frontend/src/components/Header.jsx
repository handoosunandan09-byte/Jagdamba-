import React from "react";
import { currentUser } from "../mock";
import { ShieldCheck } from "lucide-react";

const Header = () => {
  return (
    <header className="flex items-center justify-between px-5 pt-5 pb-3">
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 rounded-full bg-[#17302B] flex items-center justify-center shadow-sm">
          <ShieldCheck className="h-5 w-5 text-[#E5603C]" strokeWidth={2.4} />
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#1C8C78] border-2 border-[#FBF7F1]" />
        </div>
        <div className="leading-tight">
          <h1 className="text-[19px] font-extrabold tracking-tight text-[#1B2A28]">Saathi</h1>
          <p className="text-[12px] font-medium text-[#6B7A77] -mt-0.5">Your AI Community Safety Assistant</p>
        </div>
      </div>
      <button
        className="h-10 w-10 rounded-full bg-[#DCEEE9] text-[#1C8C78] text-[13px] font-bold flex items-center justify-center hover:bg-[#cfe8e2] transition-colors"
        aria-label="Profile"
      >
        {currentUser.initials}
      </button>
    </header>
  );
};

export default Header;
