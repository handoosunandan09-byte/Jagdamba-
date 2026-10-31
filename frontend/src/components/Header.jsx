import React from "react";
import { useUser } from "../context/UserContext";
import { ShieldCheck, Mic } from "lucide-react";
import { useVoiceGuard } from "../context/VoiceGuardContext";

const Header = ({ onProfile }) => {
  const { profile } = useUser();
  const vg = useVoiceGuard();
  return (
    <header className="flex items-center justify-between px-5 pt-5 pb-3">
      <div className="flex items-center gap-2.5">
        <div className="relative h-9 w-9 shrink-0 rounded-xl bg-[#E4EEE2] flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-[#2F6B4A]" strokeWidth={2.4} />
        </div>
        <h1 className="text-[20px] font-extrabold tracking-tight text-[#2F6B4A]">Jagdamba</h1>
      </div>
      <div className="flex items-center gap-2">
      {vg?.listening && (
        <span className="flex items-center gap-1 rounded-full bg-[#FBEAE3] text-[#C1452A] px-2.5 py-1 text-[11px] font-bold" title="Voice SOS is listening">
          <Mic className="h-3.5 w-3.5" /> <span className="h-1.5 w-1.5 rounded-full bg-[#E5603C] animate-pulse" />
        </span>
      )}
      <button
        className="h-9 w-9 rounded-full bg-[#E4EEE2] text-[#2F6B4A] text-[12px] font-bold flex items-center justify-center hover:bg-[#d7e6d4] transition-colors"
        aria-label="Profile avatar"
        onClick={onProfile}
      >
        {profile?.initials}
      </button>
      </div>
    </header>
  );
};

export default Header;
