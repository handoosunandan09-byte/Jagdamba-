import React from "react";
import { Mic, MicOff } from "lucide-react";
import { useVoiceGuard } from "../context/VoiceGuardContext";

// Home-screen switch for hands-free SOS ("Jagdamba, I need help").
const VoiceSosCard = () => {
  const vg = useVoiceGuard();
  if (!vg) return null;
  const { supported, enabled, setEnabled, listening, error, heard } = vg;

  const status = !supported
    ? "Not supported in this browser. Use Chrome on Android or a computer."
    : error
      ? error
      : enabled
        ? (listening ? "Listening… say “Bachao” or “Jagdamba, I need help”" : "Starting microphone…")
        : "Say “Bachao” or “Jagdamba, I need help” to start SOS hands-free";

  return (
    <div className={`mt-5 rounded-2xl border p-4 transition-colors ${enabled ? "bg-[#FBEAE3] border-[#E5603C]/40" : "bg-white border-[#E7E0D1]"}`}>
      <div className="flex items-center gap-3.5">
        <span className={`relative h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-white ${enabled ? "bg-[#E5603C]" : "bg-[#A3A090]"}`}>
          {enabled && listening && <span className="absolute inset-0 rounded-full bg-[#E5603C]/40 pulse-ring" />}
          {enabled ? <Mic className="h-5 w-5 relative" /> : <MicOff className="h-5 w-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#2A2A22] leading-tight">Voice SOS</p>
          <p className={`text-[12px] mt-0.5 leading-snug ${error ? "text-[#C1452A]" : "text-[#6E6A5E]"}`}>{status}</p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Voice SOS"
          disabled={!supported}
          onClick={() => setEnabled(!enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${enabled ? "bg-[#E5603C]" : "bg-[#D6D1C4]"}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      {enabled && (
        <p className="text-[11px] text-[#8A8575] mt-2.5 leading-snug">
          Saying “Bachao” or the full phrase starts SOS straight away; saying just “Jagdamba” makes the orb answer. Works while Jagdamba is open on screen; a 3-second countdown lets you cancel a false alarm.
          {heard ? <> Last heard: <span className="italic">&ldquo;{heard.slice(0, 60)}&rdquo;</span></> : null}
        </p>
      )}
    </div>
  );
};

export default VoiceSosCard;
