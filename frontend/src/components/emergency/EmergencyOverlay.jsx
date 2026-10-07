import React, { useEffect, useRef, useState } from "react";
import { useEmergency } from "../../context/EmergencyContext";
import {
  ShieldAlert, X, Phone, MapPin, Video, VideoOff, EyeOff, Eye,
  BatteryMedium, Signal, Loader2, Share2, Check,
} from "lucide-react";

// ---- Abort countdown (false-alarm window before alerts fire) ----
const AbortSheet = () => {
  const { countdown, abort } = useEmergency();
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#1A1A1A]/90 backdrop-blur px-8 text-center">
      <div className="relative flex items-center justify-center mb-6" style={{ height: 180 }}>
        <span className="absolute h-[150px] w-[150px] rounded-full bg-[#DC2626]/40 pulse-ring" />
        <div className="h-[150px] w-[150px] rounded-full bg-[#DC2626] flex flex-col items-center justify-center text-white">
          <span className="text-[60px] font-extrabold leading-none">{countdown}</span>
        </div>
      </div>
      <h2 className="text-[22px] font-extrabold text-white">Sending SOS…</h2>
      <p className="text-[14px] text-white/70 mt-2 max-w-[260px]">Alerts &amp; evidence capture start in {countdown}s. Tap cancel if this is a false alarm.</p>
      <button onClick={abort} className="mt-7 w-full max-w-[280px] rounded-2xl bg-white text-[#1A1A1A] py-4 text-[16px] font-bold hover:bg-white/90 transition-colors">
        Cancel — I&apos;m safe
      </button>
    </div>
  );
};

// ---- PIN cancel dialog ----
const PinDialog = ({ onClose }) => {
  const { cancelWithPin, pin } = useEmergency();
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);
  const submit = async () => {
    const ok = await cancelWithPin(val);
    if (!ok) { setErr(true); setVal(""); }
  };
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 px-8">
      <div className="w-full bg-white rounded-2xl p-5 pop-in">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[16px] font-extrabold text-[#1E293B]">Enter PIN to cancel</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B]"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-[12px] text-[#64748B] mb-3">This stops recording &amp; closes the alert. (Demo PIN: {pin})</p>
        <input
          value={val}
          onChange={(e) => { setVal(e.target.value); setErr(false); }}
          type="password"
          inputMode="numeric"
          placeholder="••••"
          className={`w-full text-center tracking-[0.5em] text-[20px] font-bold rounded-xl border py-3 outline-none ${err ? "border-[#DC2626] bg-[#FEF2F2]" : "border-[#E2E8F0]"}`}
        />
        {err && <p className="text-[12px] text-[#DC2626] mt-1.5 text-center">Incorrect PIN</p>}
        <button onClick={submit} className="w-full mt-4 rounded-xl bg-[#1E293B] text-white py-3 text-[15px] font-bold hover:bg-[#0F172A] transition-colors">Confirm cancel</button>
      </div>
    </div>
  );
};

// ---- Discreet (fake utility) screen ----
const DiscreetScreen = ({ onExit }) => (
  <div className="absolute inset-0 z-50 bg-black flex flex-col">
    <div className="flex-1 flex items-center justify-end px-6 pb-4">
      <span className="text-white/90 text-[52px] font-light tabular-nums">0</span>
    </div>
    <div className="grid grid-cols-4 gap-px bg-white/10 pb-6">
      {["AC","±","%","÷","7","8","9","×","4","5","6","−","1","2","3","+","0",".","=",""].map((k, i) => (
        <button
          key={i}
          onClick={k === "AC" ? onExit : undefined}
          className={`h-16 flex items-center justify-center text-[22px] ${k === "÷" || k === "×" || k === "−" || k === "+" || k === "=" ? "bg-[#FF9500] text-white" : "bg-[#333] text-white"}`}
        >
          {k}
        </button>
      ))}
    </div>
    <p className="absolute top-2 left-0 right-0 text-center text-[9px] text-white/25">Jagdamba recording quietly · tap AC to exit</p>
  </div>
);

// ---- Live recording PiP ----
const RecordingPiP = () => {
  const { stream, recording, mediaError } = useEmergency();
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  if (mediaError) {
    return (
      <div className="rounded-xl bg-[#1A1A1A] border border-white/10 p-3 flex items-center gap-2 w-[150px]">
        <VideoOff className="h-4 w-4 text-[#F59E0B]" />
        <span className="text-[10px] text-white/80 leading-tight">Camera blocked — alerts still sent</span>
      </div>
    );
  }
  return (
    <div className="relative rounded-xl overflow-hidden w-[132px] h-[176px] bg-black border border-white/20 shadow-lg">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      <span className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
        <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
        <span className="text-[9px] font-bold text-white">REC</span>
      </span>
      {!recording && <span className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-5 w-5 text-white animate-spin" /></span>}
    </div>
  );
};

// ---- Active crisis mode ----
const CrisisMode = () => {
  const { dispatchResult, dispatching, discreet, setDiscreet, recording } = useEmergency();
  const [showPin, setShowPin] = useState(false);

  if (discreet) return <DiscreetScreen onExit={() => setDiscreet(false)} />;

  const r = dispatchResult;
  const police = r?.nearest_police;
  const recipientCount = r?.recipients?.length ?? 0;

  const shareNow = async () => {
    if (!r) return;
    if (navigator.share) {
      try { await navigator.share({ title: "Jagdamba Emergency", text: r.message, url: r.maps_link }); return; } catch (e) { /* fall through */ }
    }
    if (r.smsUri) window.location.href = r.smsUri;
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#2A0A0A]">
      {/* Status banner */}
      <div className="bg-[#DC2626] px-4 pt-5 pb-3 text-white">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          <span className="text-[15px] font-extrabold tracking-wide">HIGH ALERT · SHIELD MODE</span>
        </div>
        <div className="mt-2.5 space-y-1.5 text-[12.5px] font-semibold">
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            {recording ? "RECORDING LIVE EVIDENCE" : "EVIDENCE CAPTURE STARTING…"}
          </p>
          <p className="flex items-center gap-2">
            🚨 {dispatching ? "SENDING ALERTS…" : `ALERTS SENT TO ${recipientCount} TRUSTED CONTACT${recipientCount !== 1 ? "S" : ""} & 112 DISPATCH`}
          </p>
          {police && (
            <p className="flex items-center gap-2">
              📍 NEAREST POLICE: {police.name} ({police.distance_m}m)
            </p>
          )}
        </div>
      </div>

      {/* Location pulse + PiP */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: "linear-gradient(0deg,#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }}
        />
        <div className="relative flex items-center justify-center">
          <span className="absolute h-40 w-40 rounded-full bg-[#DC2626]/40 pulse-ring" />
          <span className="absolute h-28 w-28 rounded-full bg-[#DC2626]/30 pulse-ring" style={{ animationDelay: "0.6s" }} />
          <span className="relative h-14 w-14 rounded-full bg-[#DC2626] border-4 border-white flex items-center justify-center">
            <MapPin className="h-6 w-6 text-white" />
          </span>
        </div>
        <div className="absolute top-3 right-3"><RecordingPiP /></div>

        {/* Live payload chips */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
          <span className="text-[11px] font-semibold text-white/90 bg-black/40 rounded-full px-2.5 py-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> {r?.landmark || "Locating…"}</span>
          {r?.battery != null && <span className="text-[11px] font-semibold text-white/90 bg-black/40 rounded-full px-2.5 py-1 flex items-center gap-1"><BatteryMedium className="h-3 w-3" /> {r.battery}%</span>}
          {r?.network && <span className="text-[11px] font-semibold text-white/90 bg-black/40 rounded-full px-2.5 py-1 flex items-center gap-1"><Signal className="h-3 w-3" /> {r.network}</span>}
        </div>
      </div>

      {/* Action bar */}
      <div className="bg-[#1A0606] p-4 space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <a href="tel:112" className="rounded-xl bg-[#DC2626] text-white py-3.5 text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-[#B91C1C] transition-colors">
            <Phone className="h-4 w-4" /> Call 112
          </a>
          {police ? (
            <a href={`tel:${police.phone || "100"}`} className="rounded-xl bg-white/10 text-white py-3.5 text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
              <Phone className="h-4 w-4" /> Call Police
            </a>
          ) : (
            <a href="tel:100" className="rounded-xl bg-white/10 text-white py-3.5 text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
              <Phone className="h-4 w-4" /> Call 100
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={shareNow} className="rounded-xl bg-white/10 text-white py-3 text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
            <Share2 className="h-4 w-4" /> Share location
          </button>
          <button onClick={() => setDiscreet(true)} className="rounded-xl bg-white/10 text-white py-3 text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
            <EyeOff className="h-4 w-4" /> Discreet mode
          </button>
        </div>
        <button onClick={() => setShowPin(true)} className="w-full rounded-xl bg-white text-[#1A0606] py-3.5 text-[15px] font-bold hover:bg-white/90 transition-colors">
          Safe now / Enter PIN to cancel
        </button>
      </div>

      {showPin && <PinDialog onClose={() => setShowPin(false)} />}
    </div>
  );
};

const EmergencyOverlay = () => {
  const { phase } = useEmergency();
  if (phase === "countdown") return <AbortSheet />;
  if (phase === "active") return <CrisisMode />;
  return null;
};

export default EmergencyOverlay;
