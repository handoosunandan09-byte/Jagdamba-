import React, { useState } from "react";
import { ShieldCheck, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "../context/UserContext";

// First-run setup (and "Edit profile"). Saves the user's name/phone to the backend.
const OnboardingScreen = ({ onDone, onBack }) => {
  const { profile, updateProfile } = useUser();
  const [name, setName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState(() => { try { return localStorage.getItem("saathi_sos_pin") || ""; } catch (e) { return ""; } });
  const editing = !!profile;

  const save = async (e) => {
    e?.preventDefault();
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (pin && !/^\d{4,6}$/.test(pin)) { toast.error("Cancel PIN must be 4–6 digits"); return; }
    setSaving(true);
    try {
      try { pin ? localStorage.setItem("saathi_sos_pin", pin) : localStorage.removeItem("saathi_sos_pin"); } catch (err) { /* noop */ }
      await updateProfile({ name: name.trim(), phone: phone.trim() || null });
      toast.success(editing ? "Profile updated" : "Welcome to Jagdamba");
      onDone?.();
    } catch (err) {
      toast.error("Couldn't save your profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full saathi-shell">
      {editing && onBack && (
        <div className="p-4">
          <button onClick={onBack} className="h-9 w-9 rounded-full bg-white border border-[#EFE7DB] flex items-center justify-center text-[#1B2A28]" aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      )}
      <form onSubmit={save} className="flex-1 flex flex-col justify-center px-7 py-6 overflow-y-auto no-scrollbar float-up">
        <span className="h-14 w-14 rounded-2xl bg-[#E4EEE2] flex items-center justify-center mb-5">
          <ShieldCheck className="h-7 w-7 text-[#2F6B4A]" strokeWidth={2.4} />
        </span>
        <h2 className="text-[26px] font-extrabold tracking-tight text-[#1B2A28]">
          {editing ? "Edit your profile" : "Welcome to Jagdamba"}
        </h2>
        <p className="text-[14px] text-[#6B7A77] mt-2">
          Your name is included in SOS messages so your trusted contacts know it&apos;s you.
        </p>

        <label className="text-[13px] font-semibold text-[#1B2A28] mt-6 mb-2 block" htmlFor="ob-name">Your name</label>
        <input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Full name"
          className="w-full bg-white border border-[#EFE7DB] rounded-2xl px-4 py-3.5 text-[15px] text-[#1B2A28] outline-none focus:border-[#2F6B4A]/50" />

        <label className="text-[13px] font-semibold text-[#1B2A28] mt-4 mb-2 block" htmlFor="ob-phone">Your phone (optional)</label>
        <input id="ob-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="+91 …"
          className="w-full bg-white border border-[#EFE7DB] rounded-2xl px-4 py-3.5 text-[15px] text-[#1B2A28] outline-none focus:border-[#2F6B4A]/50" />

        <label className="text-[13px] font-semibold text-[#1B2A28] mt-4 mb-2 block" htmlFor="ob-pin">SOS cancel PIN (optional)</label>
        <input id="ob-pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="4–6 digits"
          className="w-full bg-white border border-[#EFE7DB] rounded-2xl px-4 py-3.5 text-[15px] text-[#1B2A28] outline-none focus:border-[#2F6B4A]/50" />
        <p className="text-[11.5px] text-[#9AA7A3] mt-1.5">Needed to stop an active SOS, so no one else can cancel it. Stored only on this device.</p>

        <button type="submit" disabled={saving}
          className="mt-7 w-full rounded-2xl bg-[#E5603C] text-white py-4 text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-[#d9542f] disabled:opacity-70 transition-colors">
          {saving && <Loader2 className="h-5 w-5 animate-spin" />}
          {editing ? "Save" : "Continue"}
        </button>
        {!editing && (
          <p className="text-[12px] text-[#9AA7A3] mt-4 text-center">
            Next, allow location access so Jagdamba can find help near you.
          </p>
        )}
      </form>
    </div>
  );
};

export default OnboardingScreen;
