import React, { useEffect, useState, useCallback } from "react";
import { MapPin, ShieldCheck, Check, MessageCircle, X, Loader2, ExternalLink, UserPlus } from "lucide-react";
import { shareSos, getContacts } from "../lib/api";

const SosScreen = ({ onCancel, onTalk, onManageContacts }) => {
  const [stage, setStage] = useState("locating"); // locating | sharing | shared | error | nocontacts
  const [result, setResult] = useState(null);

  const run = useCallback(async () => {
    setStage("locating");
    // First make sure there's someone to alert
    let contacts = [];
    try {
      contacts = await getContacts();
    } catch (e) {
      /* ignore, backend may be down */
    }
    if (!contacts || contacts.length === 0) {
      setStage("nocontacts");
      return;
    }

    const finish = async (coords) => {
      setStage("sharing");
      try {
        const data = await shareSos({
          lat: coords?.latitude ?? null,
          lng: coords?.longitude ?? null,
          accuracy: coords?.accuracy ?? null,
          channel: "sms",
        });
        setResult(data);
        setStage("shared");
      } catch (e) {
        setStage("error");
      }
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => finish(pos.coords),
        () => finish(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      finish(null);
    }
  }, []);

  useEffect(() => { run(); }, [run]);

  const busy = stage === "locating" || stage === "sharing";
  const recipients = result?.recipients || [];

  return (
    <div className="flex flex-col h-full saathi-shell">
      <div className="flex justify-end p-4">
        <button onClick={onCancel} className="h-9 w-9 rounded-full bg-white border border-[#EFE7DB] flex items-center justify-center text-[#1B2A28] hover:bg-[#F3ECE1] transition-colors" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col items-center px-7 text-center">
        <div className="relative flex items-center justify-center mb-6 mt-2" style={{ height: 170 }}>
          {busy && <span className="absolute h-[150px] w-[150px] rounded-full bg-[#E5603C]/30 pulse-ring" />}
          <div
            className="h-[150px] w-[150px] rounded-full flex items-center justify-center text-white shadow-[0_18px_40px_-10px_rgba(229,96,60,0.6)]"
            style={{ background: "radial-gradient(circle at 50% 35%, #F0734E 0%, #E5603C 55%, #D9542F 100%)" }}
          >
            {stage === "shared" ? <Check className="h-14 w-14" strokeWidth={2.4} /> : <ShieldCheck className="h-14 w-14" strokeWidth={2} />}
          </div>
        </div>

        {busy && (
          <>
            <h2 className="text-[22px] font-extrabold text-[#1B2A28] flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-[#E5603C]" />
              {stage === "locating" ? "Getting your location…" : "Alerting your circle…"}
            </h2>
            <p className="text-[14px] text-[#6B7A77] mt-2 max-w-[280px]">Hang tight, Priya. We&apos;re sending your live location to your trusted contacts.</p>
          </>
        )}

        {stage === "nocontacts" && (
          <div className="float-up">
            <h2 className="text-[20px] font-extrabold text-[#1B2A28]">Add a trusted contact first</h2>
            <p className="text-[14px] text-[#6B7A77] mt-2 max-w-[280px] mx-auto">To send an SOS, add at least one person we can alert with your live location.</p>
            <button onClick={onManageContacts} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#E5603C] text-white py-3.5 px-7 text-[15px] font-bold hover:bg-[#d9542f] transition-colors">
              <UserPlus className="h-5 w-5" /> Add contact
            </button>
          </div>
        )}

        {stage === "shared" && (
          <div className="float-up w-full">
            <h2 className="text-[22px] font-extrabold text-[#1B2A28]">Alert sent</h2>
            <p className="text-[14px] text-[#6B7A77] mt-2">Your live location was shared with {recipients.length} trusted contact{recipients.length !== 1 ? "s" : ""}.</p>

            {/* Recipients */}
            <div className="mt-4 bg-white rounded-2xl border border-[#EFE7DB] divide-y divide-[#F1EADF] text-left">
              {recipients.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <span className="h-9 w-9 rounded-full bg-[#DCEEE9] text-[#1C8C78] flex items-center justify-center font-bold text-[13px]">{r.name.trim().charAt(0).toUpperCase()}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-[#1B2A28] truncate">{r.name}</p>
                    <p className="text-[11.5px] text-[#6B7A77]">{r.phone}</p>
                  </div>
                  <span className="text-[11px] font-bold text-[#1C8C78] bg-[#DCEEE9] rounded-full px-2.5 py-1 flex items-center gap-1"><Check className="h-3 w-3" /> Sent</span>
                </div>
              ))}
            </div>

            {/* Message preview */}
            <div className="mt-3 text-left">
              <p className="text-[12px] font-semibold text-[#6B7A77] mb-1.5 px-1">Message sent</p>
              <div className="bg-[#DCEEE9] rounded-2xl rounded-bl-md p-3.5 text-[13px] text-[#14433A] leading-snug">
                {result?.message}
              </div>
              <a href={result?.maps_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-[13px] font-semibold text-[#1C8C78] bg-white border border-[#EFE7DB] rounded-full px-4 py-2 hover:bg-[#F3ECE1] transition-colors">
                <MapPin className="h-4 w-4" /> Open shared location <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <p className="text-[11px] text-[#9AA7A3] mt-3">Demo mode — delivery is simulated. Connect Twilio to send real SMS/WhatsApp.</p>

            <div className="mt-6 space-y-3 pb-4">
              <button onClick={onTalk} className="w-full rounded-2xl bg-[#E5603C] text-white py-4 text-[15px] font-bold flex items-center justify-center gap-2 shadow-[0_12px_28px_-10px_rgba(229,96,60,0.6)] hover:bg-[#d9542f] transition-colors">
                <MessageCircle className="h-5 w-5" /> Talk to Saathi now
              </button>
              <button onClick={onCancel} className="w-full rounded-2xl bg-white border border-[#EFE7DB] text-[#1B2A28] py-3.5 text-[15px] font-semibold hover:bg-[#F3ECE1] transition-colors">
                I&apos;m safe now
              </button>
            </div>
          </div>
        )}

        {stage === "error" && (
          <div className="float-up">
            <h2 className="text-[20px] font-extrabold text-[#1B2A28]">Couldn&apos;t send alert</h2>
            <p className="text-[14px] text-[#6B7A77] mt-2">Please check your connection and try again.</p>
            <button onClick={run} className="mt-6 rounded-2xl bg-[#E5603C] text-white py-3 px-8 text-[15px] font-bold hover:bg-[#d9542f] transition-colors">Retry</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SosScreen;
