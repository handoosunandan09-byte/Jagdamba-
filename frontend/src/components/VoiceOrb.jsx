import React from "react";
import { X } from "lucide-react";
import { useVoiceGuard } from "../context/VoiceGuardContext";

// Siri-style assistant orb. While Voice SOS is on, a small glowing orb floats on
// screen. Saying "Jagdamba" (or tapping the orb) wakes it: it grows, replies out
// loud and listens for "help" / "bachao" for a few seconds.

const ORB_CSS = `
@keyframes jg-orb-spin { to { transform: rotate(360deg); } }
@keyframes jg-orb-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@keyframes jg-orb-wave { 0% { transform: scale(.9); opacity: .55; } 100% { transform: scale(1.7); opacity: 0; } }
.jg-orb { position: relative; border-radius: 9999px; overflow: hidden;
  background: radial-gradient(circle at 30% 30%, #FFD3C2 0%, #F0734E 35%, #C2410C 70%, #7C2D12 100%);
  box-shadow: 0 0 24px rgba(240,115,78,.55), inset 0 0 18px rgba(255,255,255,.35); }
.jg-orb::before { content: ""; position: absolute; inset: -30%;
  background: conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,.55) 60deg, rgba(47,107,74,.45) 140deg, rgba(255,255,255,0) 220deg, rgba(234,179,8,.45) 300deg, rgba(255,255,255,0) 360deg);
  animation: jg-orb-spin 3.2s linear infinite; mix-blend-mode: soft-light; }
.jg-orb-idle { animation: jg-orb-breathe 3s ease-in-out infinite; }
.jg-orb-awake { animation: jg-orb-breathe 1.1s ease-in-out infinite; }
.jg-orb-awake::before { animation-duration: 1.1s; }
.jg-wave { position: absolute; inset: 0; border-radius: 9999px; border: 2px solid rgba(240,115,78,.6); animation: jg-orb-wave 1.6s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .jg-orb, .jg-orb::before, .jg-wave { animation: none !important; } }
`;

const VoiceOrb = () => {
  const vg = useVoiceGuard();
  if (!vg || !vg.enabled || !vg.active) return null;
  const { listening, awake, wake, sleep, fireSos, heard } = vg;

  return (
    <>
      <style>{ORB_CSS}</style>

      {/* Floating mini orb (always visible while Voice SOS is on) */}
      {!awake && (
        <button
          onClick={() => wake(true)}
          aria-label="Voice SOS is listening. Tap to talk to Jagdamba"
          className="absolute left-4 bottom-[92px] z-30 flex items-center justify-center"
        >
          <span className={`jg-orb jg-orb-idle block h-12 w-12 ${listening ? "" : "opacity-60"}`} />
        </button>
      )}

      {/* Awake: full assistant sheet */}
      {awake && (
        <div className="absolute inset-0 z-[45] flex flex-col justify-end">
          <div className="absolute inset-0 bg-[#1B1B16]/55 backdrop-blur-[2px]" onClick={sleep} />
          <div className="relative rounded-t-[28px] bg-[#1F1A17] text-white px-6 pt-7 pb-8 flex flex-col items-center text-center pop-in">
            <button onClick={sleep} aria-label="Close" className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
            <div className="relative h-28 w-28 mb-5">
              <span className="jg-wave" />
              <span className="jg-wave" style={{ animationDelay: ".55s" }} />
              <span className="jg-orb jg-orb-awake block h-28 w-28" />
            </div>
            <p className="text-[19px] font-extrabold">I&apos;m here. What happened?</p>
            <p className="text-[13px] text-white/70 mt-1.5">Say &ldquo;help&rdquo; or &ldquo;bachao&rdquo; to send SOS, or &ldquo;I&apos;m fine&rdquo; to close.</p>
            {heard && <p className="text-[13px] italic text-white/85 mt-3 max-w-[290px] truncate">&ldquo;{heard}&rdquo;</p>}
            <div className="grid grid-cols-2 gap-3 w-full mt-6">
              <button onClick={fireSos} className="rounded-2xl bg-[#DC2626] py-3.5 text-[15px] font-bold hover:bg-[#B91C1C] transition-colors">Send SOS</button>
              <button onClick={sleep} className="rounded-2xl bg-white/10 py-3.5 text-[15px] font-semibold hover:bg-white/20 transition-colors">I&apos;m fine</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceOrb;
