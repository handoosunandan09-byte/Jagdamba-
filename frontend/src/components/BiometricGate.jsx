import React, { useEffect, useRef, useState } from "react";
import { Phone, KeyRound, Check } from "lucide-react";
import { useUser } from "../context/UserContext";
import { bioEnrolled, verifyBiometric, savedPin, markSessionUnlocked } from "../lib/biometric";

// Holo Shield entry: fingerprint scan -> circuit lines -> yantra -> "Welcome to Jagdamba".
// Rendered as an overlay above the app so Voice SOS and Guardian keep running underneath.

const COL = { gold: "244,194,107", saffron: "255,153,51", cyan: "86,230,255", blue: "61,123,255" };
const RM = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* noop */ } };

const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Fingerprint ridges in a 120 x 140 box
const RIDGES = (() => {
  const rnd = seeded(11);
  const out = [];
  for (let i = 0; i < 11; i++) {
    const r = 4.5 + i * 4.4, ry = r * 1.18, cx = 60, cy = 64, lL = 6 + i * 3.4, lR = 4 + i * 2.8;
    let d = `M ${cx - r} ${cy + lL} L ${cx - r} ${cy} A ${r} ${ry} 0 0 1 ${cx + r} ${cy} L ${cx + r} ${cy + lR}`;
    if (i >= 6) {
      d = `M ${cx - r + 9} ${cy + lL + 17} Q ${cx - r} ${cy + lL + 11} ${cx - r} ${cy + lL} L ${cx - r} ${cy} A ${r} ${ry} 0 0 1 ${cx + r} ${cy} L ${cx + r} ${cy + lR} Q ${cx + r} ${cy + lR + 11} ${cx + r - 8} ${cy + lR + 17}`;
    }
    const a = 18 + rnd() * 40, g1 = 2 + rnd() * 3, b = 12 + rnd() * 30, g2 = 2 + rnd() * 3;
    out.push({ d, dash: `${a.toFixed(1)} ${g1.toFixed(1)} ${b.toFixed(1)} ${g2.toFixed(1)} 100 0` });
  }
  return out;
})();

// 108 ticks, a mala's count
const TICKS = Array.from({ length: 108 }, (_, i) => {
  const a = (i / 108) * Math.PI * 2, big = i % 9 === 0, r1 = big ? 104 : 108, r2 = 113;
  return { x1: Math.cos(a) * r1, y1: Math.sin(a) * r1, x2: Math.cos(a) * r2, y2: Math.sin(a) * r2, big };
});

const STATUS = {
  idle: (enrolled) => enrolled
    ? ["Touch to unlock", "Use your fingerprint to open Jagdamba"]
    : ["Touch to enter", "Turn on fingerprint lock any time in Profile"],
  scanning: (enrolled, pct) => [`Scanning ${pct}%`, enrolled ? "Confirm with your fingerprint" : "Hold still"],
  verified: () => ["Verified", "Welcome back"],
  retry: () => ["Not recognised", "Touch the fingerprint to try again"],
};

const BiometricGate = ({ onDone }) => {
  const { firstName } = useUser();
  const enrolled = bioEnrolled();
  const pinAvailable = enrolled && !!savedPin();

  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const scannerRef = useRef(null);
  const litRefs = useRef([]);
  const progRef = useRef(null);
  const heroRef = useRef(null);
  const footRef = useRef(null);
  const st = useRef({ phase: "idle", p: 0, tScan: 0, tVer: 0, tWel: 0, traces: [], mandala: null, target: null });

  const [phase, setPhase] = useState("idle");
  const [pct, setPct] = useState(0);
  const [welcomeIn, setWelcomeIn] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState("");

  const go = (ph) => { st.current.phase = ph; setPhase(ph); };

  const setPrint = (p, retry = false) => {
    litRefs.current.forEach((n, i) => {
      if (!n) return;
      n.setAttribute("stroke-dashoffset", (100 * (1 - clamp(p * 1.6 - i * 0.055))).toFixed(2));
      n.setAttribute("stroke", retry ? "#FF5A6E" : "#56E6FF");
    });
    if (progRef.current) {
      progRef.current.setAttribute("stroke-dasharray", `${(p * 100).toFixed(1)} 100`);
      progRef.current.setAttribute("stroke", retry ? "#FF5A6E" : "#3D7BFF");
    }
  };

  // ---------- canvas engine ----------
  useEffect(() => {
    const s = st.current;
    const cv = canvasRef.current;
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, C = { x: 0, y: 0 };

    const measure = () => {
      const r = rootRef.current.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sc = scannerRef.current.getBoundingClientRect();
      C = { x: sc.left + sc.width / 2 - r.left, y: sc.top + sc.height / 2 - r.top };
      s.R0 = sc.width * 0.5;
    };

    s.genTraces = () => {
      measure();
      const rnd = seeded(23);
      s.traces = [];
      const n = 30;
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2 + 0.05, base = Math.round(th / (Math.PI / 4));
        let x = C.x + Math.cos(th) * s.R0, y = C.y + Math.sin(th) * s.R0;
        const pts = [[x, y]], cum = [0];
        let total = 0;
        for (let k = 0; k < 60; k++) {
          const off = [-1, 0, 0, 0, 1][Math.floor(rnd() * 5)];
          const a = k === 0 ? th : ((base + off) * Math.PI) / 4, seg = 14 + rnd() * 40;
          x += Math.cos(a) * seg; y += Math.sin(a) * seg; total += seg;
          pts.push([x, y]); cum.push(total);
          if (x < -10 || x > W + 10 || y < -10 || y > H + 10) break;
        }
        s.traces.push({ pts, cum, total, col: [COL.cyan, COL.gold, COL.blue][i % 3], delay: rnd() * 0.3, ph: rnd() });
      }
    };

    s.buildMandala = () => {
      const S = Math.min(W * 0.42, H * 0.3), sh = [];
      const add = (pts, o) => sh.push(Object.assign({ pts, spin: 0, lw: 1.2 }, o));
      const circ = (r, n = 160) => Array.from({ length: n + 1 }, (_, i) => { const t = -Math.PI / 2 + (i / n) * Math.PI * 2; return [Math.cos(t) * r, Math.sin(t) * r]; });
      const poly = (vs, per = 24) => { const a = []; vs.forEach((v, i) => { const w = vs[(i + 1) % vs.length]; for (let j = 0; j < per; j++) { const t = j / per; a.push([v[0] + (w[0] - v[0]) * t, v[1] + (w[1] - v[1]) * t]); } }); a.push(vs[0]); return a; };
      const tri = (r, up, dy) => poly([0, 1, 2].map((k) => { const t = (up ? -Math.PI / 2 : Math.PI / 2) + (k * 2 * Math.PI) / 3; return [Math.cos(t) * r, Math.sin(t) * r + dy]; }));
      const petal = (a, r1, r2, w) => { const L = [], R = []; for (let i = 0; i <= 24; i++) { const t = i / 24, r = r1 + (r2 - r1) * t, off = w * (1 - t) * (1 + 1.4 * t); L.push([Math.cos(a - off / r) * r, Math.sin(a - off / r) * r]); R.push([Math.cos(a + off / r) * r, Math.sin(a + off / r) * r]); } return L.concat(R.reverse()); };
      add(circ(S * 0.1), { s: 0, d: 0.4, col: COL.saffron, lw: 1.4 });
      add(tri(S * 0.31, true, -S * 0.03), { s: 0.2, d: 0.45, col: COL.gold });
      add(tri(S * 0.31, false, S * 0.03), { s: 0.3, d: 0.45, col: COL.gold });
      add(tri(S * 0.2, true, S * 0.05), { s: 0.45, d: 0.4, col: COL.saffron });
      add(tri(S * 0.2, false, -S * 0.05), { s: 0.55, d: 0.4, col: COL.saffron });
      add(circ(S * 0.37), { s: 0.6, d: 0.5, col: COL.gold });
      add(circ(S * 0.41), { s: 0.7, d: 0.5, col: COL.cyan, lw: 0.9 });
      for (let k = 0; k < 8; k++) add(petal((k * Math.PI) / 4 - Math.PI / 2, S * 0.41, S * 0.64, S * 0.13), { s: 0.9 + k * 0.06, d: 0.5, col: COL.cyan, spin: 1 });
      add(circ(S * 0.67), { s: 1.3, d: 0.5, col: COL.blue, lw: 0.9 });
      for (let k = 0; k < 16; k++) add(petal((k * Math.PI) / 8 - Math.PI / 2 + Math.PI / 16, S * 0.67, S * 0.82, S * 0.055), { s: 1.4 + k * 0.03, d: 0.4, col: COL.gold, spin: -1 });
      add(circ(S * 0.85), { s: 1.8, d: 0.5, col: COL.gold, lw: 0.9 });
      const B = S * 0.95, g = S * 0.16, dd = S * 0.06, e = S * 0.05, f = S * 0.06;
      const side = [[-B, -B], [-g, -B], [-g, -B - dd], [-g - e, -B - dd], [-g - e, -B - dd - f], [g + e, -B - dd - f], [g + e, -B - dd], [g, -B - dd], [g, -B]];
      const vs = [];
      for (let q = 0; q < 4; q++) { const c = Math.cos((q * Math.PI) / 2), sn = Math.sin((q * Math.PI) / 2); side.forEach(([x, y]) => vs.push([x * c - y * sn, x * sn + y * c])); }
      add(poly(vs, 8), { s: 1.9, d: 0.9, col: COL.cyan });
      s.mandala = sh;
      s.MS = S * 1.07;
      s.C0 = { ...C };
    };

    s.computeTarget = () => {
      if (!heroRef.current || !footRef.current) return;
      const r = rootRef.current.getBoundingClientRect();
      const top = heroRef.current.getBoundingClientRect().bottom - r.top;
      const bot = footRef.current.getBoundingClientRect().top - r.top;
      s.target = { x: W / 2, y: (top + bot) / 2, s: Math.min(1, Math.max(0.35, ((bot - top) / 2 - 8) / (s.MS || 1))) };
    };

    const pointAt = (tr, len) => {
      for (let i = 1; i < tr.pts.length; i++) {
        if (tr.cum[i] >= len) {
          const t = (len - tr.cum[i - 1]) / (tr.cum[i] - tr.cum[i - 1]), a = tr.pts[i - 1], b = tr.pts[i];
          return { i, x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t };
        }
      }
      const l = tr.pts[tr.pts.length - 1];
      return { i: tr.pts.length, x: l[0], y: l[1] };
    };

    const drawTraces = (G, alpha, time) => {
      for (const tr of s.traces) {
        const g = clamp(G - tr.delay * (1 - G)), len = ease(g) * tr.total;
        if (len <= 0) continue;
        const end = pointAt(tr, len);
        ctx.beginPath(); ctx.moveTo(tr.pts[0][0], tr.pts[0][1]);
        for (let i = 1; i < end.i; i++) ctx.lineTo(tr.pts[i][0], tr.pts[i][1]);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = `rgba(${tr.col},${0.18 * alpha})`; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = `rgba(${tr.col},${0.75 * alpha})`; ctx.lineWidth = 1.1; ctx.stroke();
        ctx.fillStyle = `rgba(${tr.col},${alpha})`;
        ctx.beginPath(); ctx.arc(end.x, end.y, 2.2, 0, 7); ctx.fill();
        if (g >= 1) {
          const p = pointAt(tr, ((time * 0.25 + tr.ph) % 1) * tr.total);
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
          grd.addColorStop(0, `rgba(255,255,255,${0.9 * alpha})`); grd.addColorStop(0.3, `rgba(${tr.col},${0.6 * alpha})`); grd.addColorStop(1, `rgba(${tr.col},0)`);
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 7); ctx.fill();
        }
      }
    };

    const drawMandala = (tv, alpha, time, x, y, sc) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      for (const m of s.mandala) {
        const k = clamp((tv - m.s) / m.d);
        if (k <= 0) continue;
        const n = Math.max(2, Math.floor(ease(k) * (m.pts.length - 1)) + 1);
        ctx.save(); if (m.spin) ctx.rotate(m.spin * time * 0.06);
        ctx.beginPath(); ctx.moveTo(m.pts[0][0], m.pts[0][1]);
        for (let i = 1; i < n; i++) ctx.lineTo(m.pts[i][0], m.pts[i][1]);
        ctx.strokeStyle = `rgba(${m.col},${0.16 * alpha})`; ctx.lineWidth = m.lw * 4; ctx.stroke();
        ctx.strokeStyle = `rgba(${m.col},${0.85 * alpha})`; ctx.lineWidth = m.lw; ctx.stroke();
        ctx.restore();
      }
      const b = clamp(tv / 0.4);
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
      grd.addColorStop(0, `rgba(255,245,230,${b * alpha})`); grd.addColorStop(0.35, `rgba(${COL.saffron},${b * alpha})`); grd.addColorStop(1, `rgba(${COL.saffron},0)`);
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
      ctx.restore();
    };

    // Door garland of mango leaves and marigolds, drawn in on the welcome screen
    const drawToran = (tw) => {
      const k0 = ease(clamp(tw / 0.8));
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(${COL.gold},${0.6 * k0})`;
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(W / 2, 40, W, 6); ctx.stroke();
      const n = Math.max(9, Math.round(W / 30));
      for (let k = 0; k < n; k++) {
        const x = 15 + (k * (W - 30)) / (n - 1), t = x / W, y = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 40 + t * t * 6;
        const a = ease(clamp((tw - k * 0.045) / 0.6));
        if (a <= 0) continue;
        if (k % 2 === 0) {
          ctx.strokeStyle = `rgba(${COL.cyan},${0.85 * a})`;
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.bezierCurveTo(x - 9, y + 10, x - 6, y + 27, x, y + 36 * a);
          ctx.bezierCurveTo(x + 6, y + 27, x + 9, y + 10, x, y);
          ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 30 * a); ctx.stroke();
        } else {
          ctx.strokeStyle = `rgba(${COL.saffron},${a})`;
          ctx.beginPath(); ctx.arc(x, y + 9, 6.5, 0, Math.PI * 2 * a); ctx.stroke();
          ctx.strokeStyle = `rgba(${COL.gold},${a})`;
          ctx.beginPath(); ctx.arc(x, y + 9, 2.5, 0, Math.PI * 2 * a); ctx.stroke();
        }
      }
    };

    const embers = [];
    const rnd = seeded(5);
    const spawn = (boost) => embers.push({ x: rnd() * W, y: H + 6, vy: -(12 + rnd() * 30) * (boost ? 1.6 : 1), sw: rnd() * 6.28, sz: 0.6 + rnd() * 1.6, col: rnd() < 0.6 ? COL.cyan : COL.gold, life: 0, max: 5 + rnd() * 6 });

    measure();
    let raf, last = performance.now();
    const start = last;
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const time = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      let G = 0, tAlpha = 1;

      if (s.phase === "scanning") {
        s.p += (0.88 - s.p) * Math.min(1, dt * 1.6);
        setPrint(s.p);
        G = s.p * 0.4;
        const r = Math.round(s.p * 100);
        if (r !== s.lastPct) { s.lastPct = r; setPct(r); }
      }
      if (s.phase === "verified" || s.phase === "welcome") {
        const tv = (now - s.tVer) / 1000;
        s.p = Math.min(1, s.p + dt * 3); setPrint(s.p);
        G = 0.4 + 0.6 * clamp(tv / 0.8);
        tAlpha = 1 - 0.6 * clamp((tv - 4) / 1.5);
        const fl = clamp(1 - tv / 0.7) * clamp(tv / 0.08);
        if (fl > 0) {
          const r = Math.max(W, H) * (0.2 + tv);
          const grd = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, r);
          grd.addColorStop(0, `rgba(225,245,255,${0.55 * fl})`); grd.addColorStop(0.25, `rgba(${COL.blue},${0.3 * fl})`); grd.addColorStop(1, `rgba(${COL.blue},0)`);
          ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
        }
        if (s.mandala) {
          const T = s.target || { x: s.C0.x, y: s.C0.y, s: 1 };
          const mk = s.target ? ease(clamp((tv - 2.6) / 1.1)) : 0;
          drawMandala((tv - 0.35) * (RM ? 3 : 1), 1 - 0.25 * clamp((tv - 3) / 1.5), RM ? 0 : time,
            s.C0.x + (T.x - s.C0.x) * mk, s.C0.y + (T.y - s.C0.y) * mk, 1 + (T.s - 1) * mk);
        }
        if (s.phase === "welcome") drawToran((now - s.tWel) / 1000 - 0.1);
      }
      if (s.traces.length) drawTraces(G, tAlpha, time);

      const rate = s.phase === "welcome" ? 0.5 : 0.16;
      if (!RM && rnd() < rate) spawn(s.phase === "welcome");
      for (let i = embers.length - 1; i >= 0; i--) {
        const m = embers[i];
        m.life += dt; m.y += m.vy * dt; m.sw += dt * 1.5; m.x += Math.sin(m.sw) * 0.3;
        if (m.life > m.max || m.y < -10) { embers.splice(i, 1); continue; }
        const a = Math.sin(Math.PI * clamp(m.life / m.max)) * 0.75;
        ctx.fillStyle = `rgba(${m.col},${a})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.sz, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onResize = () => {
      measure();
      if (s.traces.length) s.genTraces();
      if (s.mandala) { s.buildMandala(); if (s.phase === "welcome") s.computeTarget(); }
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- flow ----------
  const verified = () => {
    const s = st.current;
    s.tVer = performance.now();
    s.buildMandala();
    go("verified");
    vib([18, 40, 28]);
    setVerifiedAt(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }));
    setTimeout(() => {
      st.current.tWel = performance.now();
      go("welcome");
      requestAnimationFrame(() => requestAnimationFrame(() => { setWelcomeIn(true); st.current.computeTarget(); }));
    }, RM ? 300 : 1400);
  };

  const begin = async () => {
    const s = st.current;
    if (s.phase !== "idle" && s.phase !== "retry") return;
    s.genTraces();
    s.p = 0; s.lastPct = -1; s.tScan = performance.now();
    setPrint(0);
    go("scanning");
    vib(12);
    let ok = true;
    if (enrolled) {
      try { ok = await verifyBiometric(); } catch (e) { ok = false; }
    } else {
      await wait(RM ? 300 : 1300);
      markSessionUnlocked();
    }
    const elapsed = performance.now() - s.tScan;
    if (elapsed < 900) await wait(900 - elapsed);
    if (ok) verified();
    else { s.traces = []; setPrint(0.55, true); go("retry"); vib([40, 60, 40]); }
  };

  const submitPin = (e) => {
    e.preventDefault();
    if (pin && pin === savedPin()) {
      setPinOpen(false);
      markSessionUnlocked();
      st.current.genTraces();
      st.current.p = 0.4;
      verified();
    } else {
      setPinError(true); setPin(""); vib([40, 60, 40]);
    }
  };

  const [title, sub] = (STATUS[phase === "welcome" ? "verified" : phase] || STATUS.idle)(enrolled, pct);
  const lockVisible = phase !== "welcome";
  const scanning = phase === "scanning";
  const retry = phase === "retry";

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[45] overflow-hidden text-[#EEF4FF] holo-ground"
      style={{ fontFamily: "Sora, system-ui, sans-serif" }}
      role="dialog"
      aria-label="Unlock Jagdamba"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true" />

      {/* ---------- lock ---------- */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-between px-6 transition-opacity duration-500"
        style={{ paddingTop: "max(48px, 7vh)", paddingBottom: "max(28px, 4vh)", opacity: phase === "verified" || phase === "welcome" ? 0 : 1, transitionDelay: phase === "verified" ? "350ms" : "0ms", pointerEvents: lockVisible ? "auto" : "none" }}
      >
        <div className="flex flex-col items-center text-center">
          <span className="font-holo-label text-[10px] tracking-[0.5em] pl-[0.5em] text-[#56E6FF]">SECURE ENTRY</span>
          <span className="font-holo-script holo-wordmark text-[64px] leading-[1.15] px-3">Jagdamba</span>
        </div>

        <div ref={scannerRef} className="relative aspect-square" style={{ width: "min(66vw, 260px, 36vh)" }}>
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="-130 -130 260 260" aria-hidden="true">
            <g className="holo-spin">
              <circle r="124" fill="none" stroke="#56E6FF" strokeOpacity="0.4" strokeDasharray="2 7" />
              {[0, 1, 2, 3].map((q) => (
                <rect key={q} x="-3" y="-127" width="6" height="6" transform={`rotate(${q * 90}) rotate(45 0 -124)`} fill="#02050F" stroke="#56E6FF" strokeWidth="1.2" />
              ))}
            </g>
            <g className="holo-spin holo-spin-rev">
              {TICKS.map((t, i) => (
                <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.big ? "#F4C26B" : "#56E6FF"} strokeOpacity={t.big ? 0.9 : 0.3} strokeWidth={t.big ? 1.6 : 1} />
              ))}
            </g>
            <circle r="94" fill="none" stroke="#56E6FF" strokeOpacity="0.12" strokeWidth="3" />
            <circle ref={progRef} r="94" fill="none" stroke="#3D7BFF" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray="0 100" transform="rotate(-90)" style={{ filter: "drop-shadow(0 0 6px #3D7BFF)" }} />
            <circle r="80" fill={retry ? "rgba(255,90,110,0.10)" : scanning ? "rgba(86,230,255,0.10)" : "rgba(61,123,255,0.07)"} />
          </svg>
          <button
            type="button"
            onClick={begin}
            disabled={!(phase === "idle" || retry)}
            aria-label={enrolled ? "Unlock with your fingerprint" : "Touch to enter"}
            className="absolute left-1/2 top-1/2 w-1/2 rounded-[48%] transition-all duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[14px] focus-visible:outline-[#56E6FF]"
            style={{ aspectRatio: "120 / 140", transform: `translate(-50%, -50%) scale(${phase === "verified" || phase === "welcome" ? 0.15 : 1})`, opacity: phase === "verified" || phase === "welcome" ? 0 : 1 }}
          >
            <span className={`absolute -inset-[18%] rounded-full ${scanning ? "" : "holo-breathe"}`} style={{ background: `radial-gradient(circle, ${retry ? "rgba(255,90,110,0.25)" : scanning ? "rgba(86,230,255,0.28)" : "rgba(61,123,255,0.25)"}, transparent 65%)` }} />
            <svg viewBox="0 0 120 140" className="relative h-full w-full overflow-visible" aria-hidden="true">
              <defs>
                <mask id="jgFpMask" maskUnits="userSpaceOnUse" x="-10" y="-10" width="140" height="160">
                  <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round">
                    {RIDGES.map((r, i) => <path key={i} d={r.d} pathLength="100" strokeDasharray={r.dash} />)}
                  </g>
                </mask>
              </defs>
              <g fill="none" stroke="#BFE9FF" strokeOpacity="0.38" strokeWidth="2.2" strokeLinecap="round">
                {RIDGES.map((r, i) => <path key={i} d={r.d} pathLength="100" strokeDasharray={r.dash} />)}
              </g>
              <g mask="url(#jgFpMask)" style={{ filter: "drop-shadow(0 0 3px #56E6FF)" }}>
                {RIDGES.map((r, i) => (
                  <path key={i} ref={(n) => { litRefs.current[i] = n; }} d={r.d} fill="none" stroke="#56E6FF" strokeWidth="2.4" strokeLinecap="round" pathLength="100" strokeDasharray="100 100" strokeDashoffset="100" />
                ))}
              </g>
            </svg>
            {scanning && <span className="holo-scanbar absolute -left-[8%] -right-[8%] h-[3px] rounded" />}
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 text-center min-h-[64px]" aria-live="polite">
          <span className={`font-holo-label text-[13px] tracking-[0.3em] pl-[0.3em] uppercase tabular-nums ${retry ? "text-[#FF7A8A]" : scanning || phase === "verified" ? "text-[#56E6FF]" : "text-[#EEF4FF]"}`}>{title}</span>
          <span className="text-[14px] font-light text-[#93A3CC]">{sub}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          {pinAvailable && (
            <button type="button" onClick={() => { setPinOpen(true); setPinError(false); }} className="h-11 px-4 text-[14px] text-[#93A3CC] underline underline-offset-4 decoration-[#93A3CC]/40 inline-flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Use PIN instead
            </button>
          )}
          <a href="tel:112" className="h-11 px-4 inline-flex items-center gap-2 rounded-full border border-[#FF9933]/40 bg-[#FF9933]/10 text-[13px] font-semibold text-[#FFB066]">
            <Phone className="h-4 w-4" /> Emergency? Call 112
          </a>
        </div>
      </div>

      {/* ---------- PIN fallback ---------- */}
      {pinOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#02050F]/80 backdrop-blur px-6">
          <form onSubmit={submitPin} className="w-full max-w-[320px] rounded-[26px] border border-[#78BEFF]/30 holo-glass p-6 pop-in">
            <p className="font-holo-label text-[10px] tracking-[0.4em] text-[#F4C26B]">BACKUP PIN</p>
            <h2 className="text-[20px] font-semibold mt-2">Enter your PIN</h2>
            <label htmlFor="jg-pin" className="sr-only">PIN</label>
            <input
              id="jg-pin" autoFocus value={pin} type="password" inputMode="numeric" autoComplete="off"
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(false); }}
              className="mt-4 w-full rounded-2xl bg-[#0B1A44] border border-[#78BEFF]/30 px-4 py-3.5 text-[22px] tracking-[0.5em] text-center text-[#EEF4FF] outline-none focus:border-[#56E6FF]"
            />
            {pinError && <p className="mt-2 text-[13px] text-[#FF7A8A]">That PIN doesn&apos;t match. Try again.</p>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPinOpen(false)} className="h-12 rounded-2xl border border-[#78BEFF]/30 text-[14px] font-medium">Cancel</button>
              <button type="submit" className="h-12 rounded-2xl holo-cta text-[14px] font-semibold">Unlock</button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- welcome ---------- */}
      {phase === "welcome" && (
        <div className="absolute inset-0 flex flex-col items-center px-5 text-center" style={{ paddingTop: "max(96px, 12vh)", paddingBottom: "max(28px, 4vh)" }}>
          <div ref={heroRef} className="flex flex-col items-center gap-1">
            <span className={`font-holo-label text-[12px] tracking-[0.56em] pl-[0.56em] text-[#56E6FF] transition-all duration-700 ${welcomeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>WELCOME TO</span>
            <h1
              className="font-holo-script holo-wordmark text-[clamp(72px,24vw,106px)] leading-[1.2] px-4 m-0 font-bold"
              style={{ clipPath: welcomeIn ? "inset(-30% 0% -30% -10%)" : "inset(-30% 100% -30% -10%)", transition: "clip-path 1.4s cubic-bezier(.3,.1,.3,1) .45s" }}
            >
              Jagdamba
            </h1>
            <div className={`flex items-center gap-2.5 w-[170px] transition-opacity duration-700 delay-[1500ms] ${welcomeIn ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
              <span className="flex-1 h-px bg-gradient-to-r from-transparent to-[#F4C26B]" />
              <span className="h-[7px] w-[7px] rotate-45 border border-[#F4C26B]" />
              <span className="flex-1 h-px bg-gradient-to-r from-[#F4C26B] to-transparent" />
            </div>
            {firstName && (
              <p className={`mt-3 text-[16px] font-light text-[#B8C4E4] transition-opacity duration-700 delay-[1700ms] ${welcomeIn ? "opacity-100" : "opacity-0"}`}>Good to see you, {firstName}</p>
            )}
          </div>
          <div ref={footRef} className={`mt-auto flex flex-col items-center gap-3 w-full transition-opacity duration-700 delay-[1900ms] ${welcomeIn ? "opacity-100" : "opacity-0"}`}>
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#56E6FF]/35 bg-[#56E6FF]/[0.06] text-[14px]">
              <Check className="h-4 w-4 text-[#56E6FF]" />
              {enrolled ? "Identity verified" : "Welcome back"}
              <span className="text-[#93A3CC] tabular-nums">{verifiedAt}</span>
            </span>
            <button type="button" onClick={onDone} autoFocus className="w-full max-w-[300px] h-[52px] rounded-full holo-cta text-[15px] font-semibold">
              Enter Jagdamba
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BiometricGate;
