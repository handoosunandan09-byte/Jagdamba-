import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ScreenHeader from "./ScreenHeader";
import LocationGate from "./LocationGate";
import { useUser } from "../context/UserContext";
import { getNearby, directionsUrl, formatDistance } from "../lib/api";
import { Phone, Navigation, Box, ChevronRight, ShieldAlert, HeartPulse, Pill, Flame, HandHeart, Loader2, RefreshCw } from "lucide-react";

const typeIcon = { police: ShieldAlert, hospital: HeartPulse, pharmacy: Pill, fire: Flame, support: HandHeart };
const filters = [
  { id: "all", label: "All" },
  { id: "police", label: "Police" },
  { id: "hospital", label: "Hospitals" },
  { id: "pharmacy", label: "Pharmacies" },
  { id: "fire", label: "Fire" },
  { id: "support", label: "Support" },
];
// Fallback numbers when OpenStreetMap has no phone listed for a place
const fallbackPhone = { police: "100", hospital: "108", fire: "101", support: "1091" };

const NearbyScreen = ({ onBack, onOpenMap }) => {
  const { coords, locationLabel } = useUser();
  const [filter, setFilter] = useState("all");
  // Round so small GPS jitter doesn't refetch
  const key = coords ? [coords.lat.toFixed(3), coords.lng.toFixed(3)] : null;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["nearby", key],
    queryFn: () => getNearby({ lat: coords.lat, lng: coords.lng, radius: 3000 }),
    enabled: !!coords,
    staleTime: 10 * 60_000,
  });

  const places = useMemo(
    () => (data || []).filter((p) => filter === "all" || p.type === filter),
    [data, filter]
  );

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="Nearby Help" subtitle={locationLabel || "Finding your location…"} onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 float-up">
        <button onClick={onOpenMap} className="w-full mb-3 rounded-xl bg-[#0D9488] text-white py-2.5 text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-[#0B827B] transition-colors">
          <Box className="h-4 w-4" /> Explore 3D spatial safety map <ChevronRight className="h-4 w-4" />
        </button>

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
          {filters.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`shrink-0 text-[12px] font-semibold rounded-full px-3 py-1.5 transition-colors ${filter === f.id ? "bg-[#3D7BFF] text-white" : "bg-[#56E6FF]/10 text-[#56E6FF]"}`}>
              {f.label}
            </button>
          ))}
        </div>

        <LocationGate>
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-[#93A3CC] text-[13px]">
              <Loader2 className="h-5 w-5 animate-spin" /> Searching OpenStreetMap near you…
            </div>
          )}
          {isError && (
            <div className="text-center py-8">
              <p className="text-[14px] font-semibold text-[#EEF4FF]">Couldn&apos;t load nearby places</p>
              <button onClick={() => refetch()} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#56E6FF]"><RefreshCw className="h-4 w-4" /> Retry</button>
            </div>
          )}
          {data && places.length === 0 && (
            <p className="text-center text-[13px] text-[#93A3CC] py-8">No {filter === "all" ? "places" : filters.find((f) => f.id === filter).label.toLowerCase()} found within reach on OpenStreetMap.</p>
          )}

          <div className="space-y-3">
            {places.map((p) => {
              const Icon = typeIcon[p.type] || ShieldAlert;
              const phone = p.phone ? p.phone.split(";")[0].trim() : fallbackPhone[p.type];
              return (
                <div key={p.id} className="bg-[#0E1A3A] rounded-2xl border border-[#78BEFF]/20 p-4 flex items-center gap-3">
                  <span className="h-11 w-11 shrink-0 rounded-full bg-[#56E6FF]/10 text-[#56E6FF] flex items-center justify-center"><Icon className="h-5 w-5" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14.5px] font-bold text-[#EEF4FF] truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[12px] text-[#93A3CC]">
                      <span>{p.type_label}</span>
                      <span className="h-1 w-1 rounded-full bg-[#CBD4D1]" />
                      <span>{formatDistance(p.distance_m)}</span>
                      {p.open === true && <span className="font-semibold text-[#56E6FF]">{p.opening_hours === "24/7" ? "24/7" : "Open"}</span>}
                    </div>
                    {p.address && <p className="text-[11px] text-[#7484AE] truncate mt-0.5">{p.address}</p>}
                  </div>
                  {phone && (
                    <a href={`tel:${phone}`} className="h-9 w-9 rounded-full bg-[#E5603C] text-white flex items-center justify-center hover:bg-[#d9542f] transition-colors" aria-label={`Call ${phone}`} title={p.phone ? phone : `${phone} (helpline)`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  <a href={directionsUrl(p.lat, p.lng)} target="_blank" rel="noreferrer" className="h-9 w-9 rounded-full bg-[#56E6FF]/10 text-[#56E6FF] flex items-center justify-center hover:bg-[#56E6FF]/10 transition-colors" aria-label="Directions">
                    <Navigation className="h-4 w-4" />
                  </a>
                </div>
              );
            })}
          </div>
          {data && (
            <p className="text-[10.5px] text-[#7484AE] text-center mt-4">
              {isFetching ? "Refreshing…" : "Place data © OpenStreetMap contributors"}
            </p>
          )}
        </LocationGate>
      </div>
    </div>
  );
};

export default NearbyScreen;
