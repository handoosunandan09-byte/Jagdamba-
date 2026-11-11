import React, { useEffect, useState } from "react";
import { Loader2, Lightbulb, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import ScreenHeader from "./ScreenHeader";
import ShieldEmblem from "./ShieldEmblem";
import { useUser } from "../context/UserContext";
import { bioSupported, bioEnrolled, enrollBiometric, disableBiometric, savedPin } from "../lib/biometric";

// Fingerprint ridges (120 x 140 box), shown inside the scan frame
const RIDGES = Array.from({ length: 11 }, (_, i) => {
  const r = 4.5 + i * 4.4, ry = r * 1.18, cx = 60, cy = 64, lL = 6 + i * 3.4, lR = 4 + i * 2.8;
  let d = `M ${cx - r} ${cy + lL} L ${cx - r} ${cy} A ${r} ${ry} 0 0 1 ${cx + r} ${cy} L ${cx + r} ${cy + lR}`;
  if (i >= 6) d = `M ${cx - r + 9} ${cy + lL + 17} Q ${cx - r} ${cy + lL + 11} ${cx - r} ${cy + lL}` + d.slice(d.indexOf(" L ")) + ` Q ${cx + r} ${cy + lR + 11} ${cx + r - 8} ${cy + lR + 17}`;
  return d;
});

const ScanFrame = ({ active }) => (
  <div className="relative mx-auto h-[200px] w-[200px]">
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
      <rect x="6" y="6" width="188" height="188" rx="28" fill="rgba(11,26,68,0.55)" stroke="rgba(120,190,255,0.12)" />
      <path d="M6 46 V30 a24 24 0 0 1 24 -24 H46 M154 6 H170 a24 24 0 0 1 24 24 V46 M194 154 V170 a24 24 0 0 1 -24 24 H154 M46 194 H30 a24 24 0 0 1 -24 -24 V154"
        fill="none" stroke="#56E6FF" strokeWidth="3" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgba(86,230,255,0.7))" }} />
      <g transform="translate(46 34) scale(0.9)" fill="none" strokeWidth="2.4" strokeLinecap="round">
        {RIDGES.map((d, i) => (
          <path key={i} d={d} stroke={active ? "#56E6FF" : "#93A3CC"} strokeOpacity={active ? 1 : 0.45}
            strokeDasharray={`${30 + i * 9} 4 400`} style={active ? { filter: "drop-shadow(0 0 3px #56E6FF)" } : undefined} />
        ))}
      </g>
    </svg>
    {active && <span className="holo-scanbar absolute left-5 right-5 h-[3px] rounded" />}
  </div>
);

const FingerprintSetup = ({ onBack }) => {
  const { profile } = useUser();
  const [supported, setSupported] = useState(null);
  const [enrolled, setEnrolled] = useState(bioEnrolled());
  const [stage, setStage] = useState("intro"); // intro | scanning | done
  const hasPin = !!savedPin();
  const [pin, setPin] = useState("");

  useEffect(() => { bioSupported().then(setSupported); }, []);

  const start = async () => {
    if (!hasPin && !/^\d{4,6}$/.test(pin)) {
      toast.error("Set a 4–6 digit backup PIN first");
      return;
    }
    setStage("scanning");
    try {
      if (!hasPin) localStorage.setItem("saathi_sos_pin", pin);
      await enrollBiometric(profile?.name);
      setEnrolled(true);
      setStage("done");
    } catch (e) {
      setStage("intro");
      toast.error("Fingerprint setup didn't finish", { description: "Touch the sensor when your phone asks, then try again." });
    }
  };

  const turnOff = () => {
    disableBiometric();
    setEnrolled(false);
    toast.success("Fingerprint lock turned off");
  };

  if (stage === "done") {
    return (
      <div className="flex flex-col h-full px-5 py-8 justify-center float-up">
        <div className="rounded-[30px] border border-[#78BEFF]/30 holo-glass px-6 pt-8 pb-6 flex flex-col items-center text-center gap-4 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <ShieldEmblem size={150} check />
          <span className="font-holo-label text-[10px] tracking-[0.4em] pl-[0.4em] text-[#F4C26B]">FINGERPRINT SAVED</span>
          <h2 className="text-[26px] font-semibold tracking-tight">You are protected</h2>
          <p className="text-[15px] font-light leading-relaxed text-[#B8C4E4]">Jagdamba now opens with a single touch. Your backup PIN works if the sensor can&apos;t read your finger.</p>
          <button onClick={onBack} className="w-full h-[54px] rounded-2xl holo-cta text-[16px] font-semibold">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="Fingerprint lock" subtitle={enrolled ? "On for this phone" : "Open Jagdamba with a touch"} onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-8 float-up">
        {supported === false && (
          <div className="mt-6 rounded-2xl border border-[#F4C26B]/30 bg-[#F4C26B]/[0.07] p-4 text-[14px] text-[#E8DCC0] leading-relaxed">
            This phone or browser can&apos;t use fingerprint unlock for web apps. Try Chrome on Android or Safari on iPhone with a fingerprint or Face ID set up.
          </div>
        )}

        {enrolled ? (
          <div className="mt-6 flex flex-col items-center text-center gap-4">
            <ShieldEmblem size={140} check />
            <p className="text-[15px] font-light text-[#B8C4E4] max-w-[300px]">Fingerprint lock is on. Jagdamba asks for your fingerprint each time you open it.</p>
            <button onClick={turnOff} className="mt-2 h-12 px-5 rounded-2xl border border-[#78BEFF]/30 text-[14px] font-medium inline-flex items-center gap-2">
              <ShieldOff className="h-4 w-4" /> Turn off fingerprint lock
            </button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-[15px] font-light leading-relaxed text-[#B8C4E4]">Add your fingerprint so only you can open Jagdamba, your contacts and your SOS recordings.</p>
            <div className="mt-8"><ScanFrame active={stage === "scanning"} /></div>
            <p className="mt-5 text-center font-holo-label text-[12px] tracking-[0.28em] text-[#56E6FF]">
              {stage === "scanning" ? "TOUCH THE SENSOR" : "READY WHEN YOU ARE"}
            </p>

            {!hasPin && (
              <div className="mt-6">
                <label htmlFor="fp-pin" className="text-[13px] font-semibold block mb-2">Backup PIN</label>
                <input id="fp-pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="4–6 digits"
                  className="w-full rounded-2xl bg-[#0B1A44] border border-[#78BEFF]/25 px-4 py-3.5 text-[15px] outline-none focus:border-[#56E6FF]" />
                <p className="text-[12px] text-[#93A3CC] mt-1.5">Unlocks the app if your finger can&apos;t be read. It also stops an active SOS.</p>
              </div>
            )}

            <div className="mt-6 flex gap-3 items-start rounded-2xl border border-[#F4C26B]/25 bg-[#F4C26B]/[0.06] p-4">
              <Lightbulb className="h-5 w-5 text-[#F4C26B] shrink-0" />
              <p className="text-[13px] font-light leading-relaxed text-[#E8DCC0]">Your fingerprint never leaves this phone. Jagdamba only learns whether the phone recognised you.</p>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <button onClick={onBack} className="h-[54px] rounded-2xl border border-[#78BEFF]/35 text-[15px] font-medium">Not now</button>
              <button onClick={start} disabled={stage === "scanning" || supported === false}
                className="h-[54px] rounded-2xl holo-cta text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {stage === "scanning" && <Loader2 className="h-4 w-4 animate-spin" />}
                Turn on
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FingerprintSetup;
