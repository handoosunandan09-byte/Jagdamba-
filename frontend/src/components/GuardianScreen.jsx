import React, { useState, useEffect, useRef, useCallback } from "react";
import ScreenHeader from "./ScreenHeader";
import { useCrashDetection } from "../hooks/useCrashDetection";
import { shareSos, getContacts } from "../lib/api";
import { toast } from "sonner";
import { Radar, ShieldCheck, Zap, Check, MapPin, ExternalLink, TriangleAlert, Loader2, Car, Activity } from "lucide-react";

const COUNTDOWN = 15;

// small audible + haptic alarm
const useAlarm = () => {
  const ctxRef = useRef(null);
  const timerRef = useRef(null);
  const start = useCallback(() => {
    try {
      navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 400]);
    } catch (e) {}
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const beep = () => {
        const o = ctx.createOscillator();
        const gain = ctx.createGain();
        o.frequency.value = 880;
        o.type = "square";
        gain.gain.value = 0.08;
        o.connect(gain); gain.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.25);
      };
      beep();
      timerRef.current = setInterval(beep, 900);
    } catch (e) {}
  }, []);
  const stop = useCallback(() => {
    clearInterval(timerRef.current);
    try { navigator.vibrate && navigator.vibrate(0); } catch (e) {}
    try { ctxRef.current && ctxRef.current.close(); } catch (e) {}
    ctxRef.current = null;
  }, []);
  useEffect(() => () => stop(), [stop]);
  return { start, stop };
};

const GuardianScreen = ({ onBack }) => {
  const [phase, setPhase] = useState("idle"); // idle | armed | alert | sending | sent | error
  const [count, setCount] = useState(COUNTDOWN);
  const [impactG, setImpactG] = useState(0);
  const [result, setResult] = useState(null);
  const countdownRef = useRef(null);
  const alarm = useAlarm();

  const onImpact = useCallback((g) => {
    setImpactG(g);
    setPhase("alert");
  }, []);

  const { armed, supported, peakG, arm, disarm, simulate } = useCrashDetection({ threshold: 30, onImpact });

  const sendEmergency = useCallback(async () => {
    alarm.stop();
    clearInterval(countdownRef.current);
    setPhase("sending");
    const finish = async (coords) => {
      try {
        const contacts = await getContacts();
        if (!contacts || contacts.length === 0) {
          toast.error("No trusted contacts to alert");
        }
        const data = await shareSos({
          lat: coords?.latitude ?? null,
          lng: coords?.longitude ?? null,
          accuracy: coords?.accuracy ?? null,
          channel: "sms",
        });
        setResult(data);
        setPhase("sent");
        disarm();
      } catch (e) {
        setPhase("error");
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
  }, [alarm, disarm]);

  // Run the countdown when an impact alert starts
  useEffect(() => {
    if (phase !== "alert") return;
    setCount(COUNTDOWN);
    alarm.start();
    countdownRef.current = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          sendEmergency();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const imOk = () => {
    alarm.stop();
    clearInterval(countdownRef.current);
    setPhase("armed");
    toast.success("Glad you're okay. Guardian is still watching.");
  };

  const handleArm = async () => {
    const ok = await arm();
    if (!ok) {
      toast.error("Motion access was blocked", { description: "Allow motion sensors to use Guardian Mode." });
      return;
    }
    setPhase("armed");
    toast.success("Guardian Mode armed");
  };

  const handleDisarm = () => {
    disarm();
    setPhase("idle");
  };

  const peakPct = Math.min(100, Math.round((peakG / 4) * 100));
  const recipients = result?.recipients || [];

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="Guardian Mode" subtitle="Hands-free crash & fall detection" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 float-up">

        {(phase === "idle" || phase === "armed") && (
          <>
            <div className="relative flex items-center justify-center my-5" style={{ height: 220 }}>
              {phase === "armed" && <span className="absolute h-[170px] w-[170px] rounded-full bg-[#2F6B4A]/20 pulse-ring" />}
              <div
                className="h-[168px] w-[168px] rounded-full flex flex-col items-center justify-center text-white shadow-[0_18px_40px_-12px_rgba(47,107,74,0.5)]"
                style={{ background: phase === "armed"
                  ? "radial-gradient(circle at 50% 35%, #3C8A5E 0%, #2F6B4A 60%, #255539 100%)"
                  : "radial-gradient(circle at 50% 35%, #6E7A64 0%, #55604C 60%, #434C3B 100%)" }}
              >
                <Radar className={`h-9 w-9 mb-1.5 ${phase === "armed" ? "animate-pulse" : ""}`} />
                <span className="text-[17px] font-extrabold tracking-tight">{phase === "armed" ? "Watching" : "Off"}</span>
                <span className="text-[11px] text-white/80">{phase === "armed" ? "Monitoring motion" : "Guardian disarmed"}</span>
              </div>
            </div>

            {phase === "armed" && (
              <div className="bg-white rounded-2xl border border-[#E7E0D1] p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6E6A5E]"><Activity className="h-3.5 w-3.5" /> Live motion</span>
                  <span className="text-[12px] font-bold text-[#2F6B4A]">{peakG.toFixed(1)}g</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#EDE7D9] overflow-hidden">
                  <div className="h-full rounded-full bg-[#2F6B4A] transition-all duration-200" style={{ width: `${peakPct}%` }} />
                </div>
                <p className="text-[11px] text-[#9A9684] mt-2">Auto-alert triggers above ~3g impact.</p>
              </div>
            )}

            <div className="bg-[#E4EEE2] rounded-2xl p-4 mb-4 space-y-2.5">
              {[
                { icon: Car, t: "Detects a sudden crash or hard fall using your phone's motion sensors" },
                { icon: TriangleAlert, t: "Pops a loud 15-second check: tap “I'm OK” to cancel a false alarm" },
                { icon: ShieldCheck, t: "If you can't respond, it auto-shares your live location with your circle" },
              ].map((r, i) => {
                const I = r.icon;
                return (
                  <div key={i} className="flex gap-2.5">
                    <I className="h-4.5 w-4.5 text-[#2F6B4A] shrink-0 mt-0.5" />
                    <p className="text-[12.5px] text-[#365043] leading-snug">{r.t}</p>
                  </div>
                );
              })}
            </div>

            {!supported && (
              <p className="text-[12px] text-[#C15B3C] mb-3 text-center">Motion sensors aren&apos;t available on this device/browser. Use a phone, or try the demo below.</p>
            )}

            {phase === "idle" ? (
              <button onClick={handleArm} className="w-full rounded-2xl bg-[#2F6B4A] text-white py-4 text-[15px] font-bold shadow-[0_12px_28px_-10px_rgba(47,107,74,0.55)] hover:bg-[#285C40] active:scale-[0.99] transition-all flex items-center justify-center gap-2">
                <Radar className="h-5 w-5" /> Arm Guardian Mode
              </button>
            ) : (
              <div className="space-y-3">
                <button onClick={simulate} className="w-full rounded-2xl bg-white border-2 border-dashed border-[#E5603C]/50 text-[#E5603C] py-3.5 text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-[#FBEAE3] transition-colors">
                  <Zap className="h-4.5 w-4.5" /> Simulate impact (demo)
                </button>
                <button onClick={handleDisarm} className="w-full rounded-2xl bg-white border border-[#E7E0D1] text-[#2A2A22] py-3.5 text-[15px] font-semibold hover:bg-[#F3ECE1] transition-colors">
                  Disarm Guardian
                </button>
              </div>
            )}
          </>
        )}

        {phase === "alert" && (
          <div className="flex flex-col items-center text-center pt-4 pop-in">
            <div className="relative flex items-center justify-center mb-5" style={{ height: 210 }}>
              <span className="absolute h-[200px] w-[200px] rounded-full bg-[#E5603C]/30 pulse-ring" />
              <div className="h-[180px] w-[180px] rounded-full flex flex-col items-center justify-center text-white"
                style={{ background: "radial-gradient(circle at 50% 35%, #F0734E 0%, #E5603C 60%, #D9542F 100%)" }}>
                <span className="text-[56px] font-extrabold leading-none">{count}</span>
                <span className="text-[12px] text-white/85 mt-1">auto-alert in</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[#E5603C] mb-1">
              <TriangleAlert className="h-5 w-5" />
              <h2 className="text-[20px] font-extrabold">Possible accident detected</h2>
            </div>
            <p className="text-[14px] text-[#6E6A5E] max-w-[280px]">Impact of ~{impactG.toFixed(1)}g detected. Are you okay, Priya? We&apos;ll alert your contacts automatically if you don&apos;t respond.</p>

            <div className="w-full mt-7 space-y-3">
              <button onClick={imOk} className="w-full rounded-2xl bg-[#2F6B4A] text-white py-4 text-[16px] font-bold hover:bg-[#285C40] transition-colors">
                I&apos;m OK — cancel
              </button>
              <button onClick={sendEmergency} className="w-full rounded-2xl bg-white border-2 border-[#E5603C] text-[#E5603C] py-3.5 text-[15px] font-bold hover:bg-[#FBEAE3] transition-colors">
                Send help now
              </button>
            </div>
          </div>
        )}

        {phase === "sending" && (
          <div className="flex flex-col items-center justify-center text-center pt-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#E5603C] mb-4" />
            <h2 className="text-[20px] font-extrabold text-[#2A2A22]">Sending emergency alert…</h2>
            <p className="text-[14px] text-[#6E6A5E] mt-2">Sharing your live location with your trusted circle.</p>
          </div>
        )}

        {phase === "sent" && (
          <div className="flex flex-col items-center text-center pt-6 float-up">
            <span className="h-20 w-20 rounded-full bg-[#E4EEE2] text-[#2F6B4A] flex items-center justify-center mb-4 pop-in">
              <Check className="h-10 w-10" strokeWidth={2.4} />
            </span>
            <h2 className="text-[22px] font-extrabold text-[#2A2A22]">Emergency alert sent</h2>
            <p className="text-[14px] text-[#6E6A5E] mt-2">We detected an accident and alerted {recipients.length} contact{recipients.length !== 1 ? "s" : ""} with your live location.</p>

            <div className="mt-4 w-full bg-white rounded-2xl border border-[#E7E0D1] divide-y divide-[#F1EADF] text-left">
              {recipients.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <span className="h-9 w-9 rounded-full bg-[#E4EEE2] text-[#2F6B4A] flex items-center justify-center font-bold text-[13px]">{r.name.trim().charAt(0).toUpperCase()}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-[#2A2A22] truncate">{r.name}</p>
                    <p className="text-[11.5px] text-[#6E6A5E]">{r.phone}</p>
                  </div>
                  <span className="text-[11px] font-bold text-[#2F6B4A] bg-[#E4EEE2] rounded-full px-2.5 py-1 flex items-center gap-1"><Check className="h-3 w-3" /> Sent</span>
                </div>
              ))}
            </div>
            <a href={result?.maps_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-[13px] font-semibold text-[#2F6B4A] bg-white border border-[#E7E0D1] rounded-full px-4 py-2 hover:bg-[#F3ECE1] transition-colors">
              <MapPin className="h-4 w-4" /> Open shared location <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="text-[11px] text-[#9A9684] mt-3">Demo mode — delivery is simulated. Connect Twilio to send real SMS/WhatsApp.</p>
            <button onClick={onBack} className="w-full mt-6 rounded-2xl bg-[#2F6B4A] text-white py-4 text-[15px] font-bold hover:bg-[#285C40] transition-colors">Done</button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center text-center pt-16">
            <h2 className="text-[20px] font-extrabold text-[#2A2A22]">Couldn&apos;t send alert</h2>
            <p className="text-[14px] text-[#6E6A5E] mt-2">Please check your connection and try again.</p>
            <button onClick={sendEmergency} className="mt-6 rounded-2xl bg-[#E5603C] text-white py-3 px-8 text-[15px] font-bold hover:bg-[#d9542f] transition-colors">Retry</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuardianScreen;
