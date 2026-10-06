import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const sendChat = async (sessionId, message) => {
  const { data } = await axios.post(`${API}/chat`, { session_id: sessionId, message });
  return data.reply;
};

export const submitReport = async (payload) => {
  const { data } = await axios.post(`${API}/reports`, payload);
  return data;
};

export const shareSos = async (payload) => {
  const { data } = await axios.post(`${API}/sos`, payload);
  return data;
};

// Get a stable per-browser session id for Saathi chat
export const getSessionId = () => {
  let id = localStorage.getItem("saathi_session");
  if (!id) {
    id = "sess-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("saathi_session", id);
  }
  return id;
};
