import React from "react";
import { X, MapPin, Building2, Hospital, Shield, Pill, Navigation, Share2, Loader2, TriangleAlert, Activity } from "lucide-react";

const zoneStyle = {
  Normal: { chip: "bg-[#DCFCE7] text-[#15803D]", label: "Normal" },
  "High Footfall": { chip: "bg-[#DBEAFE] text-[#1D4ED8]", label: "High Footfall" },
  Caution: { chip: "bg-[#FEE2E2] text-[#B91C1C]", label: "Caution" },
};

const metRow = (Icon, label, value, color) => (
  <div className="flex items-center gap-3 py-2.5">
    <span className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}1A`, color }}>
      <Icon className="h-4 w-4" />
    </span>
    <span className="flex-1 text-[13px] text-[#475569]">{label}</span>
    <span className="text-[13px] font-semibold text-[#1E293B] text-right">{value}</span>
  </div>
);

const BuildingIntelligence = ({ selected, onClose }) => {
  const { loading, data, poi, error } = selected;
  const title = poi ? poi.name : "Building Intelligence";

  const share = () => {
    const coord = data ? data.address : (selected.lat && `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`);
    const text = `Saathi coordinate: ${coord} — https://www.google.com/maps?q=${selected.lat},${selected.lng}`;
    if (navigator.share) {
      navigator.share({ title: "Saathi location", text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
    }
  };

  const zone = data && zoneStyle[data.zone_status] ? zoneStyle[data.zone_status] : zoneStyle.Normal;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20">
      <div className="absolute inset-0 -top-[100vh]" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-[0_-10px_40px_-10px_rgba(15,23,42,0.3)] p-5 pop-in max-h-[70vh] overflow-y-auto no-scrollbar">
        <div className="mx-auto h-1 w-10 rounded-full bg-[#E2E8F0] mb-4" />
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-9 w-9 rounded-xl bg-[#EFF2F7] text-[#0D9488] flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Building Intelligence</p>
              <h3 className="text-[16px] font-extrabold text-[#1E293B] truncate">{title}</h3>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-[#F1F5F9] text-[#64748B] flex items-center justify-center shrink-0 hover:bg-[#E2E8F0] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-[#64748B] py-8 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-[13px]">Analysing zone…</span>
          </div>
        )}

        {error && <p className="text-[13px] text-[#B91C1C] py-6 text-center">Couldn&apos;t load spatial summary.</p>}

        {data && !loading && (
          <>
            <div className="flex items-center gap-2 mt-3 mb-1">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${zone.chip}`}>
                {data.zone_status === "Caution" ? <TriangleAlert className="h-3 w-3" /> : <Activity className="h-3 w-3" />} {zone.label}
              </span>
              <span className="text-[11px] text-[#64748B] flex items-center gap-1"><MapPin className="h-3 w-3" /> {data.ward}</span>
            </div>

            <div className="divide-y divide-[#F1F5F9] mt-2">
              {metRow(Building2, "Type", data.building_type, "#0D9488")}
              {metRow(Activity, "Levels / height", `${data.levels} floors · ${data.height_m} m`, "#7C3AED")}
              {metRow(Navigation, "Distance from you", `${data.distance_from_user_m} m`, "#0EA5E9")}
            </div>

            <p className="text-[12px] font-bold text-[#64748B] uppercase tracking-wide mt-4 mb-1">Nearest emergency infrastructure</p>
            <div className="divide-y divide-[#F1F5F9]">
              {metRow(Hospital, data.nearest.hospital.name, `${data.nearest.hospital.distance_m} m`, "#2563EB")}
              {metRow(Shield, data.nearest.police.name, `${data.nearest.police.distance_m} m`, "#0D9488")}
              {metRow(Pill, data.nearest.pharmacy.name, `${data.nearest.pharmacy.distance_m} m`, "#F59E0B")}
            </div>

            <div className="flex gap-3 mt-5">
              <button className="flex-1 rounded-xl bg-[#0D9488] text-white py-3 text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-[#0B827B] transition-colors">
                <Navigation className="h-4 w-4" /> Route past here
              </button>
              <button onClick={share} className="flex-1 rounded-xl bg-[#F1F5F9] text-[#334155] py-3 text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-[#E2E8F0] transition-colors">
                <Share2 className="h-4 w-4" /> Share coordinate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BuildingIntelligence;
