import React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import LocationGate from "./LocationGate";
import { useUser } from "../context/UserContext";
import { getAlerts, formatDistance } from "../lib/api";
import { AlertTriangle, MapPin, Loader2, Megaphone, RefreshCw } from "lucide-react";

const levelStyle = {
  high: { chip: "bg-[#FBEAE3] text-[#C1452A]", label: "High" },
  medium: { chip: "bg-[#FBF1DE] text-[#B07A1E]", label: "Medium" },
  low: { chip: "bg-[#E4EEE2] text-[#2F6B4A]", label: "Info" },
};

const AlertsScreen = ({ onReport }) => {
  const { coords, place } = useUser();
  const key = coords ? [coords.lat.toFixed(3), coords.lng.toFixed(3)] : null;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["alerts", key],
    queryFn: () => getAlerts({ lat: coords.lat, lng: coords.lng, radius: 5000, days: 14 }),
    enabled: !!coords,
    refetchInterval: 60_000, // keep the feed live
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-2 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#1B2A28]">Community Alerts</h2>
          <p className="text-[13px] text-[#6B7A77] mt-1">
            Reports from people within 5 km{place?.area ? ` of ${place.area}` : ""}, last 14 days
          </p>
        </div>
        {coords && (
          <button onClick={() => refetch()} aria-label="Refresh" className="h-9 w-9 shrink-0 rounded-full bg-[#E4EEE2] text-[#2F6B4A] flex items-center justify-center">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-3 float-up">
        <LocationGate>
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-[#6B7A77] text-[13px]">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading alerts near you…
            </div>
          )}
          {isError && <p className="text-center text-[13px] text-[#C1452A] py-8">Couldn&apos;t load alerts. Tap refresh to try again.</p>}
          {data && data.length === 0 && (
            <div className="text-center py-10 px-6">
              <span className="mx-auto h-12 w-12 rounded-full bg-[#E4EEE2] text-[#2F6B4A] flex items-center justify-center mb-3"><Megaphone className="h-6 w-6" /></span>
              <p className="text-[15px] font-bold text-[#1B2A28]">No reports near you</p>
              <p className="text-[13px] text-[#6B7A77] mt-1">Seen a broken light or an unsafe spot? Your report alerts others nearby.</p>
              <button onClick={onReport} className="mt-4 rounded-2xl bg-[#E5603C] text-white py-2.5 px-6 text-[13px] font-bold">Report an issue</button>
            </div>
          )}
          {(data || []).map((a) => {
            const s = levelStyle[a.level] || levelStyle.low;
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-[#EFE7DB] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ${s.chip}`}><AlertTriangle className="h-4 w-4" /></span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.chip}`}>{s.label}</span>
                  </div>
                  <span className="text-[11px] text-[#9AA7A3]">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                </div>
                <p className="text-[15px] font-bold text-[#1B2A28] mt-2.5">{a.title}</p>
                <p className="text-[13px] text-[#6B7A77] mt-1 leading-snug">{a.desc}</p>
                <div className="flex items-center gap-1 mt-2.5 text-[12px] font-medium text-[#2F6B4A]">
                  <MapPin className="h-3.5 w-3.5" /> {a.area} · {formatDistance(a.distance_m)} away
                </div>
              </div>
            );
          })}
        </LocationGate>
      </div>
    </div>
  );
};

export default AlertsScreen;
