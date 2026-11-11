import React, { useId } from "react";
import { Check } from "lucide-react";

// Holographic glass shield with a hexagon grid, gold yantra and a saffron bindu.
const ShieldEmblem = ({ size = 150, check = false, className = "" }) => {
  const id = useId().replace(/:/g, "");
  const h = (size * 232) / 200;
  return (
    <div className={`relative ${className}`} style={{ width: size, height: h }}>
      <svg viewBox="0 0 200 232" width={size} height={h} role="img" aria-label="Jagdamba shield">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#BFE9FF" stopOpacity="0.35" /><stop offset="1" stopColor="#3D7BFF" stopOpacity="0.08" /></linearGradient>
          <linearGradient id={`e${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.5" stopColor="#56E6FF" /><stop offset="1" stopColor="#3D7BFF" /></linearGradient>
          <pattern id={`h${id}`} width="17.32" height="30" patternUnits="userSpaceOnUse"><path d="M8.66 0 L17.32 5 L17.32 15 L8.66 20 L0 15 L0 5 Z M8.66 20 L8.66 30" fill="none" stroke="#56E6FF" strokeOpacity="0.28" strokeWidth="0.7" /></pattern>
          <clipPath id={`c${id}`}><path d="M100 10 L180 38 C180 122 158 182 100 222 C42 182 20 122 20 38 Z" /></clipPath>
          <radialGradient id={`r${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.3" stopColor="#FFB45E" /><stop offset="1" stopColor="#FF9933" stopOpacity="0" /></radialGradient>
        </defs>
        <path d="M100 10 L180 38 C180 122 158 182 100 222 C42 182 20 122 20 38 Z" fill={`url(#g${id})`} stroke={`url(#e${id})`} strokeWidth="2.4" style={{ filter: "drop-shadow(0 0 14px rgba(86,230,255,0.55))" }} />
        <rect width="200" height="232" fill={`url(#h${id})`} clipPath={`url(#c${id})`} />
        <path d="M100 22 L168 46 C168 118 149 170 100 206 C51 170 32 118 32 46 Z" fill="none" stroke="#BFE9FF" strokeOpacity="0.35" strokeWidth="1" />
        <circle cx="100" cy="108" r="54" fill="#02050F" fillOpacity="0.55" stroke="#56E6FF" strokeWidth="1.4" />
        <circle cx="100" cy="108" r="47" fill="none" stroke="#F4C26B" strokeOpacity="0.55" strokeWidth="0.8" strokeDasharray="2 4" />
        <path d="M100 72 L131.2 126 L68.8 126 Z" fill="none" stroke="#F4C26B" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M100 144 L68.8 90 L131.2 90 Z" fill="none" stroke="#F4C26B" strokeOpacity="0.7" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="100" cy="108" r="18" fill={`url(#r${id})`} />
        <circle cx="100" cy="108" r="3" fill="#FFFFFF" />
      </svg>
      {check && (
        <span className="absolute right-[3%] bottom-[8%] h-[30%] w-[30%] max-h-[46px] max-w-[46px] rounded-full flex items-center justify-center bg-gradient-to-br from-[#56E6FF] to-[#3D7BFF] shadow-[0_0_0_4px_#0E1B44,0_0_20px_rgba(86,230,255,0.6)]">
          <Check className="h-1/2 w-1/2 text-[#02050F]" strokeWidth={3} />
        </span>
      )}
    </div>
  );
};

export default ShieldEmblem;
