import React from "react";
import { MapPin, Loader2 } from "lucide-react";
import { useUser } from "../context/UserContext";

// Renders children once a live GPS fix is available; otherwise explains what's needed.
const LocationGate = ({ children }) => {
  const { coords, locStatus, retryLocation } = useUser();
  if (coords) return children;

  if (locStatus === "locating") {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-[#6B7A77] text-[13px]">
        <Loader2 className="h-5 w-5 animate-spin" /> Getting your location…
      </div>
    );
  }
  const msg = {
    denied: "Location access is blocked. Allow it in your browser's site settings to see what's near you.",
    unsupported: "This browser can't share your location.",
    error: "Couldn't get your location. Make sure GPS is on.",
  }[locStatus];
  return (
    <div className="text-center py-8 px-4">
      <span className="mx-auto h-12 w-12 rounded-full bg-[#FBEAE3] text-[#E5603C] flex items-center justify-center mb-3"><MapPin className="h-6 w-6" /></span>
      <p className="text-[13.5px] text-[#1B2A28]">{msg}</p>
      {locStatus !== "unsupported" && (
        <button onClick={retryLocation} className="mt-4 rounded-2xl bg-[#2F6B4A] text-white py-2.5 px-6 text-[13px] font-bold">Try again</button>
      )}
    </div>
  );
};

export default LocationGate;
