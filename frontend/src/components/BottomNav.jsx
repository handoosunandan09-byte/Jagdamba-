import React from "react";
import { Mic } from "lucide-react";
import { navItems } from "../config";
import { useUser } from "../context/UserContext";

// Glass tab bar with a raised "Talk to Jagdamba" button in the centre.
// (SOS stays on the long-press red button, so it can't be sent by a stray tap.)
const BottomNav = ({ active, onNavigate }) => {
  const { profile } = useUser();
  const left = navItems.slice(0, 2);
  const right = navItems.slice(2);

  const Tab = ({ item }) => {
    const Icon = item.icon;
    const isActive = active === item.id;
    const color = isActive ? "text-[#56E6FF]" : "text-[#8A9AC4]";
    return (
      <button onClick={() => onNavigate(item.id)} aria-current={isActive ? "page" : undefined}
        className={`flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[48px] ${color}`}>
        {Icon ? (
          <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.2 : 1.7} />
        ) : (
          <span className={`h-[22px] w-[22px] rounded-full flex items-center justify-center text-[9.5px] font-bold ${isActive ? "bg-[#56E6FF] text-[#02050F]" : "bg-[#1B2A55] text-[#B8C4E4]"}`}>
            {profile?.initials}
          </span>
        )}
        <span className="text-[10.5px] font-medium">{item.label}</span>
      </button>
    );
  };

  return (
    <nav aria-label="Main" className="absolute bottom-3 left-3 right-3 h-[72px] rounded-[26px] border border-[#78BEFF]/20 bg-[#0A122C]/90 backdrop-blur-md grid grid-cols-5 items-center justify-items-center">
      {left.map((item) => <Tab key={item.id} item={item} />)}
      <button
        onClick={() => onNavigate("talk")}
        aria-label="Talk to Jagdamba"
        className="-mt-8 h-[62px] w-[62px] rounded-full flex items-center justify-center text-[#02050F] shadow-[0_0_0_5px_#02050F,0_0_28px_rgba(86,230,255,0.6)] active:scale-95 transition-transform"
        style={{ background: "radial-gradient(circle at 35% 30%, #8FD8FF, #3D7BFF 70%)" }}
      >
        <Mic className="h-6 w-6" strokeWidth={2} />
      </button>
      {right.map((item) => <Tab key={item.id} item={item} />)}
    </nav>
  );
};

export default BottomNav;
