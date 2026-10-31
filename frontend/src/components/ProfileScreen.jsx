import React, { useEffect, useState } from "react";
import { emergencyContacts } from "../config";
import { useUser } from "../context/UserContext";
import { getContacts } from "../lib/api";
import { MapPin, Phone, Bell, Users, ChevronRight, Pencil, LocateFixed, KeyRound } from "lucide-react";
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
    { icon: Users, label: "Trusted contacts", value: contactCount == null ? "Manage" : `${contactCount}`, onClick: () => onNavigate("contacts") },
    { icon: LocateFixed, label: "Location access", value: locValue, onClick: retryLocation },
    { icon: Bell, label: "Alert notifications", value: notif, onClick: enableNotifications },
    { icon: KeyRound, label: "App permissions", value: "Review", onClick: () => onNavigate("apppermissions") },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar float-up">
        <div className="px-5 pt-8 pb-6 flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-full bg-[#E4EEE2] text-[#2F6B4A] text-[26px] font-extrabold flex items-center justify-center mb-3">
            {profile?.initials}
          </div>
          <h2 className="text-[20px] font-extrabold text-[#1B2A28]">{profile?.name}</h2>
          <div className="flex items-center gap-1 text-[13px] text-[#6B7A77] mt-1">
            <MapPin className="h-3.5 w-3.5" /> {locationLabel || (locStatus === "denied" ? "Location access blocked" : "Locating…")}
          </div>
        </div>

        <div className="px-4 space-y-3 pb-6">
          <div className="bg-white rounded-2xl border border-[#EFE7DB] divide-y divide-[#F1EADF]">
            {rows.map((r) => {
              const Icon = r.icon;
              return (
                <button key={r.label} onClick={r.onClick} className="w-full flex items-center gap-3 p-4 hover:bg-[#FBF7F1] transition-colors">
                  <span className="h-9 w-9 rounded-full bg-[#E4EEE2] text-[#2F6B4A] flex items-center justify-center"><Icon className="h-4.5 w-4.5" /></span>
                  <span className="flex-1 text-left text-[14px] font-semibold text-[#1B2A28]">{r.label}</span>
                  <span className="text-[13px] text-[#6B7A77]">{r.value}</span>
                  <ChevronRight className="h-4 w-4 text-[#C3CCC9]" />
                </button>
              );
            })}
          </div>

          <div>
            <p className="text-[13px] font-semibold text-[#6B7A77] px-1 mb-2 mt-4">Emergency numbers</p>
            <div className="bg-white rounded-2xl border border-[#EFE7DB] divide-y divide-[#F1EADF]">
              {emergencyContacts.map((c) => {
                const Icon = c.icon;
                return (
                  <a key={c.id} href={`tel:${c.number}`} className="flex items-center gap-3 p-4 hover:bg-[#FBF7F1] transition-colors">
                    <span className="h-9 w-9 rounded-full bg-[#FBEAE3] text-[#E5603C] flex items-center justify-center"><Icon className="h-4.5 w-4.5" /></span>
                    <span className="flex-1 text-[14px] font-semibold text-[#1B2A28]">{c.label}</span>
                    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[#E5603C]"><Phone className="h-3.5 w-3.5" />{c.number}</span>
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
