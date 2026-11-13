import axios from "axios";

// Netlify sets REACT_APP_BACKEND_URL. Android builds made on a laptop may not have it,
// so fall back to the live Render backend (a public address, not a secret).
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://jagdamba-backend-wz8e.onrender.com";
export const API = `${BACKEND_URL}/api`;

// Stable per-browser id. Profile, contacts and SOS history are scoped to it.
export const getDeviceId = () => {
  let id = null;
  try { id = localStorage.getItem("jagdamba_device"); } catch (e) { /* storage blocked */ }
  if (!id) {
    id = (window.crypto?.randomUUID?.() || `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);
    try { localStorage.setItem("jagdamba_device", id); } catch (e) { /* noop */ }
  }
  return id;
};

const http = axios.create({ baseURL: API, timeout: 30000 });
http.interceptors.request.use((cfg) => {
  cfg.headers = { ...(cfg.headers || {}), "X-Device-Id": getDeviceId() };
  return cfg;
});

// ---- Profile ----
export const getProfile = async () => {
  try {
    const { data } = await http.get("/profile");
    return data;
  } catch (e) {
    if (e.response?.status === 404) return null;
    throw e;
  }
};
export const saveProfile = async (payload) => (await http.put("/profile", payload)).data;

// ---- Assistant ----
export const sendChat = async (sessionId, message, coords) => {
  const { data } = await http.post("/chat", {
    session_id: sessionId, message, lat: coords?.lat ?? null, lng: coords?.lng ?? null,
  });
  return data.reply;
};

// ---- Reports / alerts ----
export const submitReport = async (payload) => (await http.post("/reports", payload)).data;
export const getAlerts = async ({ lat, lng, radius = 5000, days = 14 }) =>
  (await http.get("/alerts", { params: { lat, lng, radius, days } })).data.alerts;

// ---- Places / geo ----
export const getNearby = async ({ lat, lng, radius = 3000, types }) =>
  (await http.get("/nearby", { params: { lat, lng, radius, ...(types ? { types } : {}) } })).data.places;
export const reverseGeocode = async (lat, lng) => (await http.get("/geo/reverse", { params: { lat, lng } })).data;
export const getBuildingSummary = async (params) => (await http.get("/spatial/building-summary", { params })).data;
export const getSafeRoutes = async ({ from, to }) =>
  (await http.get("/routes", {
    params: { from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng },
  })).data.routes;

// ---- SOS ----
export const shareSos = async (payload) => (await http.post("/sos", payload)).data;

// ---- Contacts ----
export const getContacts = async () => (await http.get("/contacts")).data;
export const addContact = async (payload) => (await http.post("/contacts", payload)).data;
export const deleteContact = async (id) => (await http.delete(`/contacts/${id}`)).data;

// Chat session id (per browser)
export const getSessionId = () => {
  let id = null;
  try { id = localStorage.getItem("saathi_session"); } catch (e) { /* noop */ }
  if (!id) {
    id = "sess-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem("saathi_session", id); } catch (e) { /* noop */ }
  }
  return id;
};

// Builds a phone SMS link (fallback when server-side SMS isn't configured)
export const buildSmsUri = (phones, body) => {
  const to = (phones || []).filter(Boolean).join(",");
  return `sms:${to}?&body=${encodeURIComponent(body)}`;
};

// WhatsApp click-to-chat link with the message pre-filled.
// Numbers saved without a country code are treated as Indian (+91).
export const toWhatsAppNumber = (phone) => {
  let d = String(phone || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.slice(1);
  if (d.startsWith("00")) return d.slice(2);
  d = d.replace(/^0+/, "");
  return d.length === 10 ? `91${d}` : d;
};
export const whatsappUrl = (phone, text) => {
  const n = toWhatsAppNumber(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text || "")}`;
};

export const directionsUrl = (lat, lng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

export const formatDistance = (m) => {
  if (m == null) return "";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
};
