import React from "react";
import { navItems } from "../mock";
import { currentUser } from "../mock";

const BottomNav = ({ active, onNavigate }) => {
  return (
    <nav className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[#E7E0D1] px-2 pt-2 pb-3">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex flex-col items-center gap-1 px-3 py-1 min-w-[64px]"
            >
              {Icon ? (
                <Icon
                  className={`h-[22px] w-[22px] transition-colors ${isActive ? "text-[#2F6B4A]" : "text-[#A3A090]"}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              ) : (
                <span
                  className={`h-[22px] w-[22px] rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    isActive ? "bg-[#2F6B4A] text-white" : "bg-[#E9E6DA] text-[#A3A090]"
                  }`}
                >
                  {currentUser.initials}
                </span>
              )}
              <span className={`text-[10.5px] font-semibold transition-colors ${isActive ? "text-[#2F6B4A]" : "text-[#A3A090]"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
