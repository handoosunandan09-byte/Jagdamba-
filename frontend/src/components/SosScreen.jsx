import React, { useEffect, useState, useCallback } from "react";
import { MapPin, ShieldCheck, Check, MessageCircle, X, Loader2, ExternalLink } from "lucide-react";
import { shareSos } from "../lib/api";

const TRUSTED = { name: "Mom", phone: "+91 99887 76655" };

const SosScreen = ({ onCancel, onTalk }) => {
  const [stage, setStage] = useState("locating"); // locating | sharing | shared | error
  const [result, setResult] = useState(null);

  const run = useCallback(async () => {
    setStage("locating");
    const finish = async (coords) => {
      setStage("sharing");
      try {
        const data = await shareSos({
          lat: coords?.latitude ?? null,
          lng: coords?.longitude ?? null,
          accuracy: coords?.accuracy ?? null,
          contact_name: TRUSTED.name,
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

  return (
    <div className="flex flex-col h-full saathi-shell">
      <div className="flex justify-end p-4">
        <button onClick={onCancel} className="h-9 w-9 rounded-full bg-white border border-[#EFE7DB] flex items-center justify-center text-[#1B2A28] hover:bg-[#F3ECE1] transition-colors" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center -mt-6">
        <div className="relative flex items-center justify-center mb-7" style={{ height: 180 }}>
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
              {stage === "locating" ? "Getting your location…" : "Sharing with your circle…"}
            </h2>
            <p className="text-[14px] text-[#6B7A77] mt-2 max-w-[280px]">Hang tight, Priya. We&apos;re sending your live location to {TRUSTED.name}.</p>
          </>
        )}

        {stage === "shared" && (
          <div className="float-up w-full">
            <h2 className="text-[22px] font-extrabold text-[#1B2A28]">Location shared</h2>
            <p className="text-[14px] text-[#6B7A77] mt-2">Your live location was sent to <span className="font-semibold text-[#1B2A28]">{result?.contact_name} • {TRUSTED.phone}</span>. Stay where there are people around.</p>

            <a href={result?.maps_link} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-[#1C8C78] bg-[#DCEEE9] rounded-full px-4 py-2 hover:bg-[#cfe8e2] transition-colors">
              <MapPin className="h-4 w-4" /> View shared location <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <div className="mt-8 space-y-3">
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
            <h2 className="text-[20px] font-extrabold text-[#1B2A28]">Couldn&apos;t share location</h2>
            <p className="text-[14px] text-[#6B7A77] mt-2">Please check your connection and try again.</p>
            <button onClick={run} className="mt-6 rounded-2xl bg-[#E5603C] text-white py-3 px-8 text-[15px] font-bold hover:bg-[#d9542f] transition-colors">Retry</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SosScreen;
