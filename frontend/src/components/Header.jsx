import React from "react";
import { currentUser } from "../mock";
import { ShieldCheck } from "lucide-react";

const Header = () => {
  return (
    <header className="flex items-center justify-between px-5 pt-5 pb-3">
      <div className="flex items-center gap-2.5">
        <div className="relative h-9 w-9 shrink-0 rounded-xl bg-[#E4EEE2] flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-[#2F6B4A]" strokeWidth={2.4} />
        </div>
        <h1 className="text-[20px] font-extrabold tracking-tight text-[#2F6B4A]">Jagdamba</h1>
      </div>
      <button
        className="h-9 w-9 rounded-full bg-[#E4EEE2] text-[#2F6B4A] text-[12px] font-bold flex items-center justify-center hover:bg-[#d7e6d4] transition-colors"
        aria-label="Profile avatar"
      >
        {currentUser.initials}
      </button>
    </header>
  );
};

export default Header;
