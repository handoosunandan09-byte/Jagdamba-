import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { getProfile, saveProfile, reverseGeocode } from "../lib/api";

// Live user state: the saved profile plus the device's real GPS position
// and a human-readable place name for it (OpenStreetMap reverse geocoding).
const UserContext = createContext(null);

const movedEnough = (a, b) => {
  if (!a || !b) return true;
  const dLat = (a.lat - b.lat) * 111320;
  const dLng = (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) > 150; // re-geocode after ~150 m
};

// The profile is cached on the phone so the app opens instantly, even while the
// free-tier server is still waking up; it's refreshed in the background.
const PROFILE_CACHE = "jagdamba_profile";
const readCachedProfile = () => { try { return JSON.parse(localStorage.getItem(PROFILE_CACHE) || "null"); } catch (e) { return null; } };
const cacheProfile = (p) => { try { p ? localStorage.setItem(PROFILE_CACHE, JSON.stringify(p)) : localStorage.removeItem(PROFILE_CACHE); } catch (e) { /* noop */ } };

export const UserProvider = ({ children }) => {
  const cached = readCachedProfile();
  const [profile, setProfile] = useState(cached);
  const [profileStatus, setProfileStatus] = useState(cached ? "ready" : "loading"); // loading | ready | missing | error
  const [coords, setCoords] = useState(null); // { lat, lng, accuracy }
  const [locStatus, setLocStatus] = useState("locating"); // locating | ok | denied | unsupported | error
  const [place, setPlace] = useState(null);
  const lastGeocoded = useRef(null);

  const loadProfile = useCallback(async () => {
    const hadCache = !!readCachedProfile();
    if (!hadCache) setProfileStatus("loading");
    try {
      const p = await getProfile();
      setProfile(p);
      cacheProfile(p);
      setProfileStatus(p ? "ready" : "missing");
    } catch (e) {
      // Offline or server asleep: keep using the cached profile if we have one
      if (!hadCache) setProfileStatus("error");
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const updateProfile = useCallback(async (payload) => {
    const p = await saveProfile(payload);
    setProfile(p);
    cacheProfile(p);
    setProfileStatus("ready");
    return p;
  }, []);

  // Live GPS
  useEffect(() => {
    if (!navigator.geolocation) { setLocStatus("unsupported"); return undefined; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocStatus("ok");
      },
      (err) => setLocStatus(err.code === 1 ? "denied" : "error"),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Place name for the current position
  useEffect(() => {
    if (!coords || !movedEnough(coords, lastGeocoded.current)) return;
    lastGeocoded.current = coords;
    reverseGeocode(coords.lat, coords.lng).then(setPlace).catch(() => {});
  }, [coords]);

  const retryLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocStatus("ok");
      },
      (err) => setLocStatus(err.code === 1 ? "denied" : "error"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  const firstName = profile?.name?.trim().split(/\s+/)[0] || "";
  const locationLabel = place?.label || (coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : null);

  return (
    <UserContext.Provider value={{
      profile, profileStatus, updateProfile, reloadProfile: loadProfile, firstName,
      coords, locStatus, retryLocation, place, locationLabel,
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
};
