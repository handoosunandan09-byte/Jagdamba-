import { useCallback } from "react";
import { shareSos, buildSmsUri } from "../lib/api";

// Builds the emergency payload and dispatches it. Fails gracefully — location/SMS
// still fire even if media recording failed.
export const useSOSDispatch = () => {
  const getPosition = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });

  const getBattery = async () => {
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        return Math.round(b.level * 100);
      }
    } catch (e) { /* noop */ }
    return null;
  };

  const getNetwork = () => {
    try {
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c && c.effectiveType) return c.effectiveType.toUpperCase();
    } catch (e) { /* noop */ }
    return navigator.onLine ? "ONLINE" : "OFFLINE";
  };

  const dispatch = useCallback(async ({ evidenceId, reason = "sos" } = {}) => {
    const coords = await getPosition();
    const battery = await getBattery();
    const network = getNetwork();

    let result = null;
    try {
      result = await shareSos({
        lat: coords?.latitude ?? null,
        lng: coords?.longitude ?? null,
        accuracy: coords?.accuracy ?? null,
        channel: "sms",
        battery,
        network,
        evidence_id: evidenceId || null,
        reason,
      });
    } catch (e) {
      // Even if backend fails, keep a local payload so the UI + SMS can still work
      const lat = coords?.latitude, lng = coords?.longitude;
      const link = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : "https://www.google.com/maps";
      result = {
        maps_link: link,
        message: `EMERGENCY: I need help. My live location is tracked via Jagdamba. ${link}`,
        recipients: [],
        nearest_police: null,
        battery, network, landmark: null,
        offline: true,
      };
    }

    // SMS link the user can fire from their own phone (fallback channel)
    const pendingPhones = (result.recipients || []).filter((r) => r.status !== "sent").map((r) => r.phone);
    result.smsUri = buildSmsUri(pendingPhones, result.message);
    result.coords = coords ? { lat: coords.latitude, lng: coords.longitude } : null;
    result.battery = battery;
    result.network = network;
    return result;
  }, []);

  return { dispatch };
};
