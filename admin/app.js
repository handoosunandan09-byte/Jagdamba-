/* Jagdamba admin console.
 * Sign-in: Google Identity Services. The Google ID token is sent to the backend, which checks
 * it with Google and allows only the emails in ADMIN_EMAILS. This page never stores secrets.
 */
(() => {
  "use strict";

  const BACKEND = (window.JAGDAMBA_ADMIN_CONFIG?.backendUrl || "").replace(/\/+$/, "");
  const API = `${BACKEND}/api`;
  const TOKEN_KEY = "jagdamba_admin_token";
  const SLOW_MS = 3000;       // show "waking up" after this long
  const TIMEOUT_MS = 75000;   // free Render servers can take ~60 s to wake
  const AUTO_REFRESH_MS = 5 * 60 * 1000;

  const $ = (id) => document.getElementById(id);
  const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat("en-IN");

  // ---------- token (memory first; sessionStorage only so a page refresh keeps you signed in) ----------
  let token = null;
  const decodeExp = (t) => {
    try {
      const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return (payload.exp || 0) * 1000;
    } catch (e) { return 0; }
  };
  const saveToken = (t) => {
    token = t;
    try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* storage blocked */ }
  };
  const loadToken = () => {
    let t = null;
    try { t = sessionStorage.getItem(TOKEN_KEY); } catch (e) { /* storage blocked */ }
    if (t && decodeExp(t) > Date.now() + 60000) token = t;
    else saveToken(null);
  };

  // ---------- status bar ----------
  const status = {
    show(title, text, { error = false, retry = null, spin = !error } = {}) {
      $("status").hidden = false;
      $("status").classList.toggle("error", error);
      $("status-spinner").hidden = !spin;
      $("status-title").textContent = title;
      $("status-text").textContent = text || "";
      const btn = $("status-retry");
      btn.hidden = !retry;
      btn.onclick = retry;
    },
    hide() { $("status").hidden = true; },
  };

  // ---------- network ----------
  class HttpError extends Error {
    constructor(statusCode, detail) { super(detail || `HTTP ${statusCode}`); this.status = statusCode; }
  }

  async function api(path, { auth = true } = {}) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const slow = setTimeout(() => status.show(
      "Waking up the server…",
      "The server sleeps when nobody is using it (free plan). This can take up to a minute.",
    ), SLOW_MS);
    try {
      const headers = { Accept: "application/json" };
      if (auth && token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API}${path}`, { headers, signal: ctrl.signal, cache: "no-store" });
      let body = null;
      try { body = await res.json(); } catch (e) { /* empty body */ }
      if (!res.ok) throw new HttpError(res.status, body?.detail);
      return body;
    } catch (e) {
      if (e.name === "AbortError") throw new HttpError(0, "The server took too long to answer.");
      if (e instanceof HttpError) throw e;
      throw new HttpError(0, "Can't reach the server. Check your internet connection.");
    } finally {
      clearTimeout(timeout);
      clearTimeout(slow);
    }
  }

  // Retries network failures and server wake-up errors (not sign-in problems)
  async function apiRetry(path, opts, attempts = 3) {
    let last;
    for (let i = 0; i < attempts; i++) {
      try { return await api(path, opts); } catch (e) {
        last = e;
        const retryable = e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504;
        if (!retryable || i === attempts - 1) break;
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      }
    }
    throw last;
  }

  // ---------- Google sign-in ----------
  const waitForGoogle = () => new Promise((resolve, reject) => {
    const started = Date.now();
    (function check() {
      if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
      if (Date.now() - started > 15000) return reject(new Error("Google sign-in didn't load"));
      setTimeout(check, 150);
    })();
  });

  let gsi = null;
  function showSignIn() {
    $("console").hidden = true;
    $("who").hidden = true;
    $("signin").hidden = false;
    if (gsi) {
      $("google-button").replaceChildren();
      gsi.renderButton($("google-button"), { theme: "filled_black", size: "large", text: "signin_with", shape: "pill" });
    }
  }

  function signOut() {
    saveToken(null);
    try { gsi?.disableAutoSelect(); } catch (e) { /* noop */ }
    status.hide();
    showSignIn();
  }

  // ---------- console ----------
  let refreshTimer = null;

  async function loadConsole() {
    $("signin").hidden = true;
    let me;
    try {
      me = await apiRetry("/admin/me");
    } catch (e) {
      if (e.status === 401) { saveToken(null); status.show("Please sign in again", e.message, { error: true, spin: false }); showSignIn(); return; }
      if (e.status === 403) { signOut(); status.show("Access denied", e.message, { error: true, spin: false }); return; }
      status.show("Couldn't open the console", e.message, { error: true, retry: loadConsole });
      return;
    }
    $("who-email").textContent = me.email;
    $("who").hidden = false;
    $("console").hidden = false;
    await refresh();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, AUTO_REFRESH_MS);
  }

  async function refresh() {
    $("refresh").disabled = true;
    try {
      const [users, payments] = await Promise.all([
        apiRetry("/admin/users-summary"),
        apiRetry("/admin/payments-summary"),
      ]);
      renderUsers(users);
      renderPayments(payments);
      $("updated").textContent = `Updated ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
      status.hide();
    } catch (e) {
      if (e.status === 401) { saveToken(null); showSignIn(); status.show("Please sign in again", e.message, { error: true, spin: false }); return; }
      status.show("Couldn't load the numbers", e.message, { error: true, retry: refresh });
    } finally {
      $("refresh").disabled = false;
    }
  }

  const setNum = (id, v) => { $(id).textContent = num.format(v ?? 0); };
  const setInr = (id, v) => { $(id).textContent = inr.format(v ?? 0); };

  function renderUsers(u) {
    setNum("u-registered", u.registered);
    setNum("u-active-day", u.active.day);
    setNum("u-active-week", u.active.week);
    setNum("u-active-month", u.active.month);
    setNum("u-new-week", u.new.week);
    setNum("u-new-month", u.new.month);
    setNum("u-contacts", u.with_trusted_contacts);
    const notes = ["Counts are per phone until account sign-in launches, so one person with two phones counts twice."];
    if (u.registered_before_tracking > 0) {
      notes.push(`${num.format(u.registered_before_tracking)} users registered before tracking started, so they don't appear in "New" counts or the chart. "Active" counts include them once they open the app again.`);
    }
    $("u-note").textContent = notes.join(" ");
    drawBars($("chart-users"), u.signups_daily, { unit: "registrations", unitOne: "registration" });
    drawTable($("table-users"), u.signups_daily, "Registrations");
    renderRegions(u.regions || { by_state: [], by_city: [], unknown: 0 });
  }

  // ---------- users by region: one series, bars labelled directly (state name + count) ----------
  function renderRegions(r) {
    const box = $("region-states");
    box.replaceChildren();
    const states = r.by_state || [];
    if (!states.length) {
      const p = document.createElement("p");
      p.className = "empty-text";
      p.textContent = "No locations yet. A user's state and city appear here after they open the app with location switched on.";
      box.style.display = "block";
      box.append(p);
    } else {
      box.style.display = "";
      const max = Math.max(...states.map((s) => s.users));
      states.slice(0, 15).forEach((s) => {
        const label = document.createElement("div");
        label.className = "hbar-label";
        label.textContent = s.state;
        label.title = s.state;
        const track = document.createElement("div");
        track.className = "hbar-track hbar-row";
        const fill = document.createElement("div");
        fill.className = "hbar-fill";
        fill.style.width = `${(s.users / max) * 100}%`;
        track.append(fill);
        track.title = `${s.state}: ${num.format(s.users)} users, ${num.format(s.active_30d)} active in the last 30 days`;
        const value = document.createElement("div");
        value.className = "hbar-value";
        const muted = document.createElement("span");
        muted.className = "muted";
        muted.textContent = ` · ${num.format(s.active_30d)} active`;
        value.append(num.format(s.users), muted);
        box.append(label, track, value);
      });
    }
    const extra = states.length > 15 ? ` ${states.length - 15} more states are in the table below.` : "";
    $("region-note").textContent =
      `${num.format(r.unknown || 0)} users haven't shared a location yet. "Active" means opened the app in the last 30 days. Only state and city are stored, never exact locations.${extra}`;

    // Cities table (and any states beyond the top 15)
    const table = document.createElement("table");
    table.style.maxWidth = "560px";
    const head = table.createTHead().insertRow();
    [["City", ""], ["State", ""], ["Users", "num"], ["Active 30d", "num"]].forEach(([t, c]) => {
      const th = document.createElement("th"); th.textContent = t; th.className = c; head.append(th);
    });
    const body = table.createTBody();
    (r.by_city || []).forEach((c) => {
      const row = body.insertRow();
      row.insertCell().textContent = c.city || "–";
      row.insertCell().textContent = c.state || "–";
      const u = row.insertCell(); u.textContent = num.format(c.users); u.className = "num";
      const a = row.insertCell(); a.textContent = num.format(c.active_30d); a.className = "num";
    });
    if (!(r.by_city || []).length) {
      const row = body.insertRow(); const cell = row.insertCell(); cell.colSpan = 4; cell.textContent = "No cities yet.";
    }
    const wrap = [table];
    if (states.length > 15) {
      const t2 = document.createElement("table");
      t2.style.marginTop = "16px";
      const h2 = t2.createTHead().insertRow();
      ["More states", "Users"].forEach((t, i) => { const th = document.createElement("th"); th.textContent = t; if (i) th.className = "num"; h2.append(th); });
      const b2 = t2.createTBody();
      states.slice(15).forEach((s) => {
        const row = b2.insertRow();
        row.insertCell().textContent = s.state;
        const c = row.insertCell(); c.textContent = num.format(s.users); c.className = "num";
      });
      wrap.push(t2);
    }
    $("region-cities").replaceChildren(...wrap);
  }

  function renderPayments(p) {
    $("p-banner").hidden = !!p.billing_live;
    setNum("p-active", p.subscriptions.active);
    setInr("p-net-30", p.last_30_days.net_inr);
    setNum("p-payments", p.all_time.new_payments);
    setNum("p-renewals", p.all_time.renewals);
    setNum("p-cancelling", p.subscriptions.cancelling);
    setNum("p-expired", p.subscriptions.expired);
    setNum("p-refunds", p.all_time.refunds);
    setInr("p-net-all", p.all_time.net_inr);
    drawBars($("chart-payments"), p.payments_daily, { unit: "payments", unitOne: "payment" });
    drawTable($("table-payments"), p.payments_daily, "Payments");
  }

  // ---------- chart: one series, so no legend; the heading names it ----------
  const SVG_NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs = {}, text) => {
    const n = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text != null) n.textContent = text;
    return n;
  };
  const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const niceMax = (v) => {
    if (v <= 4) return 4;
    const rough = v / 4; // four gridline steps
    const pow = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough);
    return step * 4;
  };

  // Charts are drawn at the container's real pixel width, so text stays readable on phones
  const drawn = new Map();
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawn.forEach((args, c) => drawBars(c, ...args)), 150);
  });

  function drawBars(container, series, opts) {
    const { unit, unitOne } = opts;
    drawn.set(container, [series, opts]);
    container.replaceChildren();
    const W = Math.max(280, Math.round(container.clientWidth || 720));
    const H = W < 500 ? 190 : 230, padL = 32, padR = 8, padT = 10, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const max = niceMax(Math.max(0, ...series.map((d) => d.value)));
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${unit} per day, last 30 days` });

    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      const y = padT + plotH - (v / max) * plotH;
      svg.append(el("line", { class: "grid", x1: padL, x2: W - padR, y1: y, y2: y }));
      svg.append(el("text", { class: "axis-text", x: padL - 6, y: y + 4, "text-anchor": "end" }, num.format(v)));
    }

    const slot = plotW / series.length;
    const barW = Math.max(2, slot - 2); // 2px gap between bars
    const tip = $("tooltip");
    series.forEach((d, i) => {
      const x = padL + i * slot + 1;
      const h = d.value > 0 ? Math.max(2, (d.value / max) * plotH) : 0;
      const g = el("g", { class: "bar-group" });
      if (h > 0) {
        const r = Math.min(4, barW / 2, h);
        const y = padT + plotH - h;
        // rounded top corners, square at the baseline
        g.append(el("path", {
          class: "bar",
          d: `M${x},${padT + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${padT + plotH} Z`,
        }));
      }
      const hit = el("rect", { class: "bar-hit", x: padL + i * slot, y: padT, width: slot, height: plotH });
      const show = (ev) => {
        g.classList.add("active");
        tip.replaceChildren();
        const strong = document.createElement("strong");
        strong.textContent = num.format(d.value);
        tip.append(strong, ` ${d.value === 1 ? unitOne : unit} · ${dayLabel(d.date)}`);
        tip.hidden = false;
        const pt = ev.touches?.[0] || ev;
        tip.style.left = `${Math.min(pt.clientX + 12, window.innerWidth - tip.offsetWidth - 8)}px`;
        tip.style.top = `${pt.clientY - 36}px`;
      };
      const hide = () => { g.classList.remove("active"); tip.hidden = true; };
      hit.addEventListener("mousemove", show);
      hit.addEventListener("mouseleave", hide);
      hit.addEventListener("touchstart", show, { passive: true });
      hit.addEventListener("touchend", hide);
      g.append(hit);
      svg.append(g);
      // Weekly labels counted back from today, so the newest day is always labelled and nothing overlaps
      if ((series.length - 1 - i) % 7 === 0) {
        svg.append(el("text", { class: "axis-text", x: x + barW / 2, y: H - 6, "text-anchor": "middle" }, dayLabel(d.date)));
      }
    });

    if (series.every((d) => d.value === 0)) {
      svg.append(el("text", { class: "empty", x: padL + plotW / 2, y: padT + plotH / 2, "text-anchor": "middle" }, `No ${unit} in the last 30 days`));
    }
    container.append(svg);
  }

  function drawTable(container, series, label) {
    const table = document.createElement("table");
    const head = table.createTHead().insertRow();
    ["Date", label].forEach((t, i) => { const th = document.createElement("th"); th.textContent = t; if (i) th.className = "num"; head.append(th); });
    const body = table.createTBody();
    [...series].reverse().forEach((d) => {
      const row = body.insertRow();
      row.insertCell().textContent = dayLabel(d.date);
      const c = row.insertCell(); c.textContent = num.format(d.value); c.className = "num";
    });
    container.replaceChildren(table);
  }

  // ---------- tabs (arrow keys move between them) ----------
  function setupTabs() {
    const tabs = [$("tab-users"), $("tab-payments")];
    const select = (tab) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        $(t.getAttribute("aria-controls")).hidden = !on;
      });
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        select(next);
        next.focus();
      });
    });
  }

  // ---------- start ----------
  async function boot() {
    setupTabs();
    $("signout").addEventListener("click", signOut);
    $("refresh").addEventListener("click", refresh);
    loadToken();

    if (!BACKEND) { status.show("Setup needed", "backendUrl is missing in config.js.", { error: true, spin: false }); return; }

    let cfg;
    try {
      cfg = await apiRetry("/admin/config", { auth: false });
    } catch (e) {
      status.show("Can't reach the Jagdamba server", e.message, { error: true, retry: () => location.reload() });
      return;
    }
    if (!cfg.configured || !cfg.google_client_id) {
      status.show(
        "The admin console isn't switched on yet",
        "Add ADMIN_GOOGLE_CLIENT_ID and ADMIN_EMAILS in the Render settings, then reload this page.",
        { error: true, spin: false, retry: () => location.reload() },
      );
      return;
    }

    try {
      gsi = await waitForGoogle();
    } catch (e) {
      status.show("Google sign-in didn't load", "Check your internet connection or ad-blocker, then reload.", { error: true, retry: () => location.reload() });
      return;
    }
    gsi.initialize({
      client_id: cfg.google_client_id,
      callback: (resp) => { saveToken(resp.credential); status.hide(); loadConsole(); },
      auto_select: true,
      use_fedcm_for_prompt: true,
    });

    status.hide();
    if (token) loadConsole();
    else { showSignIn(); gsi.prompt(); }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
