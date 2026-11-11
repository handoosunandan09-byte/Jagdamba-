import React from "react";
import { useUser } from "../context/UserContext";

const Header = ({ onProfile }) => {
  const { profile } = useUser();
  return (
    <header className="flex items-center justify-between px-5 pt-4 pb-2">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 200 232" width="26" height="30" aria-hidden="true">
          <path d="M100 10 L180 38 C180 122 158 182 100 222 C42 182 20 122 20 38 Z" fill="rgba(86,230,255,0.12)" stroke="#56E6FF" strokeWidth="12" />
          <path d="M100 64 L138 130 L62 130 Z M100 152 L62 86 L138 86 Z" fill="none" stroke="#F4C26B" strokeWidth="10" strokeLinejoin="round" />
        </svg>
        <h1 className="font-holo-script holo-wordmark text-[42px] leading-none pr-2 pt-1">Jagdamba</h1>
      </div>
      <button
        className="h-11 w-11 rounded-full border border-[#78BEFF]/30 bg-[#3D7BFF]/20 text-[#EEF4FF] text-[12px] font-semibold flex items-center justify-center hover:bg-[#3D7BFF]/30 transition-colors"
        aria-label="Open profile"
        onClick={onProfile}
      >
        {profile?.initials}
      </button>
    </header>
  );
};

export default Header;
