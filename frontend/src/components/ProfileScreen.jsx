import React, { useEffect, useState } from "react";
import { emergencyContacts } from "../config";
import { useUser } from "../context/UserContext";
import { getContacts } from "../lib/api";
import { MapPin, Phone, Bell, Users, ChevronRight, Pencil, LocateFixed, KeyRound, Film, Fingerprint } from "lucide-react";
import { bioEnrolled } from "../lib/biometric";
import { toast } from "sonner";

const notifState = () => {
  if (!("Notification" in window)) return "Unsupported";
  return { granted: "On", denied: "Blocked", default: "Off" }[Notification.permission] || "Off";
};

const ProfileScreen = ({ onNavigate }) => {
  const { profile, locationLabel, locStatus, retryLocation } = useUser();
  const [contactCount, setContactCount] = useState(null);
  const [notif, setNotif] = useState(notifState());

  useEffect(() => {
    getContacts().then((c) => setContactCount(c.length)).catch(() => setContactCount(null));
  }, []);

  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "denied") {
      toast("Notifications are blocked", { description: "Allow them in your browser's site settings." });
      return;
    }
    await Notification.requestPermission();
    setNotif(notifState());
  };

  const locValue = { ok: "On", denied: "Blocked", unsupported: "Unsupported", error: "Unavailable", locating: "…" }[locStatus];

  const rows = [
    { icon: Pencil, label: "Edit profile", value: profile?.phone || "", onClick: () => onNavigate("editprofile") },
    { icon: Fingerprint, label: "Fingerprint lock", value: bioEnrolled() ? "On" : "Off", onClick: () => onNavigate("fingerprint") },
    { icon: Users, label: "Trusted contacts", value: contactCount == null ? "Manage" : `${contactCount}`, onClick: () => onNavigate("contacts") },
    { icon: LocateFixed, label: "Location access", value: locValue, onClick: retryLocation },
    { icon: Bell, label: "Alert notifications", value: notif, onClick: enableNotifications },
    { icon: Film, label: "SOS recordings", value: "Video + voice", onClick: () => onNavigate("recordings") },
    { icon: KeyRound, label: "App permissions", value: "Review", onClick: () => onNavigate("apppermissions") },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar float-up">
        <div className="px-5 pt-8 pb-6 flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-full bg-[#56E6FF]/10 text-[#56E6FF] text-[26px] font-extrabold flex items-center justify-center mb-3">
            {profile?.initials}
          </div>
          <h2 className="text-[20px] font-extrabold text-[#EEF4FF]">{profile?.name}</h2>
          <div className="flex items-center gap-1 text-[13px] text-[#93A3CC] mt-1">
            <MapPin className="h-3.5 w-3.5" /> {locationLabel || (locStatus === "denied" ? "Location access blocked" : "Locating…")}
          </div>
        </div>

        <div className="px-4 space-y-3 pb-6">
          <div className="bg-[#0E1A3A] rounded-2xl border border-[#78BEFF]/20 divide-y divide-[#78BEFF]/15">
            {rows.map((r) => {
              const Icon = r.icon;
              return (
                <button key={r.label} onClick={r.onClick} className="w-full flex items-center gap-3 p-4 hover:bg-[#13234D] transition-colors">
                  <span className="h-9 w-9 rounded-full bg-[#56E6FF]/10 text-[#56E6FF] flex items-center justify-center"><Icon className="h-4.5 w-4.5" /></span>
                  <span className="flex-1 text-left text-[14px] font-semibold text-[#EEF4FF]">{r.label}</span>
                  <span className="text-[13px] text-[#93A3CC]">{r.value}</span>
                  <ChevronRight className="h-4 w-4 text-[#7484AE]" />
                </button>
              );
            })}
          </div>

          <div>
            <p className="text-[13px] font-semibold text-[#93A3CC] px-1 mb-2 mt-4">Emergency numbers</p>
            <div className="bg-[#0E1A3A] rounded-2xl border border-[#78BEFF]/20 divide-y divide-[#78BEFF]/15">
              {emergencyContacts.map((c) => {
                const Icon = c.icon;
                return (
                  <a key={c.id} href={`tel:${c.number}`} className="flex items-center gap-3 p-4 hover:bg-[#13234D] transition-colors">
                    <span className="h-9 w-9 rounded-full bg-[#FF9933]/15 text-[#FFB066] flex items-center justify-center"><Icon className="h-4.5 w-4.5" /></span>
                    <span className="flex-1 text-[14px] font-semibold text-[#EEF4FF]">{c.label}</span>
                    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[#FFB066]"><Phone className="h-3.5 w-3.5" />{c.number}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
