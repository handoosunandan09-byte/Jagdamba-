// Guardian City 3D map, built on MapLibre GL with free OpenFreeMap vector tiles
// (OpenStreetMap data, real 3D building heights, no API key). Centred on the
// user's live location.
import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { poiStyles, guardianRadiusOptions } from "../../config";
import { useUser } from "../../context/UserContext";
import { getNearby, getAlerts, getBuildingSummary, getSafeRoutes } from "../../lib/api";
import BuildingIntelligence from "./BuildingIntelligence";
import GuardianHUD from "./GuardianHUD";
import { ChevronLeft, ShieldCheck, Layers, Navigation2, LocateFixed, Box } from "lucide-react";

const STYLE_URL = process.env.REACT_APP_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
const CITY_VIEW = { zoom: 15.6, pitch: 58, bearing: -20 };
const GUARDIAN_VIEW = { zoom: 17.2, pitch: 65, bearing: 30 };

const typeGlyph = { hospital: "H", police: "P", pharmacy: "+", incident: "!" };
const EMPTY = { type: "FeatureCollection", features: [] };

// GeoJSON circle polygon (metres) for the guardian radius
const circle = (lng, lat, radiusM, steps = 72) => {
  const coords = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} }] };
};

const poisToGeoJSON = (list) => ({
  type: "FeatureCollection",
  features: list.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    properties: {
      ...p,
      color: (poiStyles[p.type] || poiStyles.incident).color,
      glyph: typeGlyph[p.type] || "•",
    },
  })),
});

const userMarkerEl = () => {
  const el = document.createElement("div");
  el.style.cssText = "position:relative;width:22px;height:22px;";
  el.innerHTML = `
    <span style="position:absolute;inset:-14px;border-radius:9999px;background:rgba(13,148,136,.25);animation:jg-ping 1.8s ease-out infinite"></span>
    <span style="position:absolute;inset:0;border-radius:9999px;background:#0D9488;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>`;
  return el;
};

const MAP_CSS = `
@keyframes jg-ping { 0% { transform: scale(.5); opacity: .9 } 100% { transform: scale(1.6); opacity: 0 } }
.jg-map .maplibregl-ctrl-top-left { top: 64px; }
.jg-map .maplibregl-ctrl-group { border-radius: 14px; box-shadow: 0 4px 14px rgba(15,23,42,.18); }
.jg-map .maplibregl-ctrl-attrib { font-size: 10px; }
`;

const GuardianCityMap = ({ onBack }) => {
  const { coords, place, locStatus, retryLocation } = useUser();
  // Freeze the first GPS fix as the map centre; the user marker keeps tracking live.
  const centerRef = useRef(null);
  if (!centerRef.current && coords) centerRef.current = { lat: coords.lat, lng: coords.lng };
  const userRef = useRef(coords);
  userRef.current = coords;

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const pickMarkerRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [guardian, setGuardian] = useState(false);
  const [radius, setRadius] = useState(500);
  const [activeRoute, setActiveRoute] = useState("A");
  const [selected, setSelected] = useState(null);
  const [showLayers, setShowLayers] = useState(true);
  const [pois, setPois] = useState([]);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [routeState, setRouteState] = useState("idle"); // idle | loading | ready | error
  const [is3d, setIs3d] = useState(true);

  const fetchSummary = useCallback(async (lat, lng, poi) => {
    setSelected({ loading: true, poi, lat, lng });
    try {
      const u = userRef.current;
      const data = await getBuildingSummary({ lat, lng, ...(u ? { user_lat: u.lat, user_lng: u.lng } : {}) });
      setSelected({ loading: false, poi, data, lat, lng });
    } catch (e) {
      setSelected({ loading: false, poi, error: true, lat, lng });
    }
  }, []);
  const fetchSummaryRef = useRef(fetchSummary);
  fetchSummaryRef.current = fetchSummary;

  // ---- Create the map once we know where the user is ----
  const hasCenter = !!centerRef.current;
  useEffect(() => {
    if (!hasCenter || !containerRef.current) return undefined;
    const c = centerRef.current;
    let map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [c.lng, c.lat],
        ...CITY_VIEW,
        maxPitch: 75,
        attributionControl: { compact: true },
        canvasContextAttributes: { antialias: true },
      });
    } catch (err) {
      setLoadError(err.message || "This device can't show the 3D map (WebGL unavailable).");
      return undefined;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true }), "top-left");

    map.on("error", (e) => {
      // Tile hiccups are normal; only surface a failure to load the style itself
      if (!map.isStyleLoaded() && !map.loaded()) setLoadError(e?.error?.message || "Map tiles couldn't load");
    });

    map.on("load", () => {
      setLoadError(null);

      // Civic look for the real 3D buildings from OpenStreetMap
      if (map.getLayer("building-3d")) {
        map.setPaintProperty("building-3d", "fill-extrusion-color", [
          "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 0],
          0, "#E2E8F0", 30, "#CBD5E1", 80, "#94A3B8",
        ]);
        map.setPaintProperty("building-3d", "fill-extrusion-opacity", 0.92);
      }

      map.addSource("guardian-radius", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "guardian-radius-fill", type: "fill", source: "guardian-radius", paint: { "fill-color": "#0D9488", "fill-opacity": 0.1 } });
      map.addLayer({ id: "guardian-radius-line", type: "line", source: "guardian-radius", paint: { "line-color": "#0D9488", "line-width": 2, "line-opacity": 0.7, "line-dasharray": [2, 1.5] } });

      map.addSource("route", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 14, "line-opacity": 0.25, "line-blur": 4 } });
      map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 6 } });

      map.addSource("pois", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "poi-circles", type: "circle", source: "pois",
        paint: {
          "circle-radius": ["case", ["==", ["get", "type"], "incident"], 11, 10],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
          "circle-pitch-alignment": "viewport",
        },
      });
      map.addLayer({
        id: "poi-glyphs", type: "symbol", source: "pois",
        layout: { "text-field": ["get", "glyph"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-allow-overlap": true, "text-ignore-placement": true },
        paint: { "text-color": "#ffffff" },
      });

      userMarkerRef.current = new maplibregl.Marker({ element: userMarkerEl() })
        .setLngLat([(userRef.current || c).lng, (userRef.current || c).lat])
        .addTo(map);

      map.on("click", (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ["poi-circles"] })[0];
        const { lng, lat } = e.lngLat;
        if (pickMarkerRef.current) pickMarkerRef.current.remove();
        pickMarkerRef.current = new maplibregl.Marker({ color: "#7C3AED", scale: 0.8 }).setLngLat([lng, lat]).addTo(map);
        if (hit) {
          const p = hit.properties;
          fetchSummaryRef.current(Number(p.lat), Number(p.lng), { ...p, lat: Number(p.lat), lng: Number(p.lng) });
        } else {
          fetchSummaryRef.current(lat, lng, null);
        }
      });
      map.on("mouseenter", "poi-circles", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "poi-circles", () => { map.getCanvas().style.cursor = ""; });

      setReady(true);
    });

    return () => {
      try { map.remove(); } catch (e) { /* noop */ }
      mapRef.current = null;
      userMarkerRef.current = null;
      setReady(false);
    };
  }, [hasCenter]);

  // ---- Live POIs (OpenStreetMap) + community-reported issues ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return undefined;
    const c = centerRef.current;
    let cancelled = false;
    Promise.allSettled([
      getNearby({ lat: c.lat, lng: c.lng, radius: 3000, types: "police,hospital,pharmacy" }),
      getAlerts({ lat: c.lat, lng: c.lng, radius: 3000, days: 30 }),
    ]).then(([placesRes, alertsRes]) => {
      if (cancelled || !mapRef.current) return;
      const places = placesRes.status === "fulfilled" ? placesRes.value : [];
      const incidents = alertsRes.status === "fulfilled"
        ? alertsRes.value.map((a) => ({ id: `r-${a.id}`, type: "incident", name: a.title, lat: a.lat, lng: a.lng, ward: a.area }))
        : [];
      const list = [...places, ...incidents];
      setPois(list);
      map.getSource("pois")?.setData(poisToGeoJSON(list));
    });
    return () => { cancelled = true; };
  }, [ready]);

  // ---- Live user position + guardian radius ----
  useEffect(() => {
    const map = mapRef.current;
    const u = coords || centerRef.current;
    if (!map || !ready || !u) return;
    userMarkerRef.current?.setLngLat([u.lng, u.lat]);
    map.getSource("guardian-radius")?.setData(circle(u.lng, u.lat, radius));
  }, [coords?.lat, coords?.lng, radius, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Layer visibility ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const vis = showLayers ? "visible" : "none";
    ["poi-circles", "poi-glyphs", "guardian-radius-fill", "guardian-radius-line"].forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", vis));
  }, [showLayers, ready]);

  // ---- 2D / 3D toggle ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (map.getLayer("building-3d")) map.setLayoutProperty("building-3d", "visibility", is3d ? "visible" : "none");
    map.easeTo({ pitch: is3d ? (guardian ? GUARDIAN_VIEW.pitch : CITY_VIEW.pitch) : 0, duration: 800 });
  }, [is3d, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Safe walking routes ----
  const planRoute = useCallback(async (dest) => {
    const from = userRef.current;
    if (!from) return;
    setDestination(dest);
    setSelected(null);
    setGuardian(true);
    setRouteState("loading");
    try {
      const list = await getSafeRoutes({ from, to: dest });
      setRoutes(list);
      setActiveRoute(list[0]?.id || "A");
      setRouteState("ready");
    } catch (e) {
      setRoutes([]);
      setRouteState("error");
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const route = guardian ? routes.find((r) => r.id === activeRoute) : null;
    map.getSource("route")?.setData(route ? {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { color: route.color }, geometry: { type: "LineString", coordinates: route.path.map((p) => [p.lng, p.lat]) } }],
    } : EMPTY);
    if (route && route.path.length > 1) {
      const b = new maplibregl.LngLatBounds();
      route.path.forEach((p) => b.extend([p.lng, p.lat]));
      map.fitBounds(b, { padding: { top: 120, bottom: 300, left: 40, right: 40 }, pitch: is3d ? 50 : 0, duration: 1200 });
    }
  }, [activeRoute, routes, guardian, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Camera for Guardian Mode on/off ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const u = userRef.current || centerRef.current;
    if (guardian) {
      map.flyTo({ center: [u.lng, u.lat], ...GUARDIAN_VIEW, pitch: is3d ? GUARDIAN_VIEW.pitch : 0, duration: 2000 });
    } else {
      setRoutes([]);
      setDestination(null);
      setRouteState("idle");
      map.flyTo({ center: [u.lng, u.lat], ...CITY_VIEW, pitch: is3d ? CITY_VIEW.pitch : 0, duration: 1600 });
    }
  }, [guardian, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const recenter = () => {
    const map = mapRef.current;
    const u = userRef.current || centerRef.current;
    if (map && u) map.flyTo({ center: [u.lng, u.lat], zoom: Math.max(map.getZoom(), 16), duration: 900 });
  };

  const nearestPolice = (() => {
    const u = coords || centerRef.current;
    if (!u) return null;
    let best = null;
    pois.filter((p) => p.type === "police").forEach((p) => {
      const dLat = (p.lat - u.lat) * 111320;
      const dLng = (p.lng - u.lng) * 111320 * Math.cos((u.lat * Math.PI) / 180);
      const d = Math.sqrt(dLat * dLat + dLng * dLng);
      if (!best || d < best.distance_m) best = { name: p.name, distance_m: Math.round(d) };
    });
    return best;
  })();

  const cityName = place?.city || place?.area || "Your area";

  if (!coords && !centerRef.current) {
    return (
      <div className="relative h-full w-full bg-[#EDEDE7] flex flex-col items-center justify-center px-8 text-center">
        <button onClick={onBack} className="absolute top-4 left-4 h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center text-[#334155]">
          <ChevronLeft className="h-5 w-5" />
        </button>
        {locStatus === "locating" ? (
          <>
            <div className="h-12 w-12 rounded-full border-4 border-[#0D9488]/30 border-t-[#0D9488] animate-spin mb-4" />
            <p className="text-[14px] font-semibold text-[#334155]">Getting your location…</p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-bold text-[#334155]">Location needed</p>
            <p className="text-[12px] text-[#64748B] mt-2">The safety map is built around where you are. Allow location access and try again.</p>
            <button onClick={retryLocation} className="mt-4 rounded-xl bg-[#0D9488] text-white px-5 py-2.5 text-[13px] font-bold">Try again</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="jg-map relative h-full w-full bg-[#DCE3EA] overflow-hidden">
      <style>{MAP_CSS}</style>
      {/* MapLibre forces position:relative on its container, so give it an explicit size */}
      <div className="absolute inset-0">
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {!ready && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#EDEDE7] z-20">
          <div className="h-12 w-12 rounded-full border-4 border-[#0D9488]/30 border-t-[#0D9488] animate-spin mb-4" />
          <p className="text-[14px] font-semibold text-[#334155]">Loading 3D map of {cityName}…</p>
          <p className="text-[12px] text-[#64748B] mt-1">Guardian City · OpenStreetMap</p>
        </div>
      )}
      {loadError && !ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#EDEDE7] z-20 px-8 text-center">
          <p className="text-[15px] font-bold text-[#334155]">3D map couldn&apos;t load</p>
          <p className="text-[12px] text-[#64748B] mt-2">{loadError}</p>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4 pb-3 pointer-events-none">
        <button onClick={onBack} aria-label="Back" className="pointer-events-auto h-10 w-10 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[#334155] hover:bg-white transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="pointer-events-auto bg-white/95 shadow-md rounded-full px-4 py-2 flex items-center gap-2 max-w-[60%]">
          <ShieldCheck className="h-4 w-4 text-[#0D9488] shrink-0" />
          <span className="text-[13px] font-bold text-[#334155] truncate">Guardian City · {cityName}</span>
        </div>
        <button onClick={() => setShowLayers((v) => !v)} aria-label="Layers" className="pointer-events-auto h-10 w-10 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[#334155] hover:bg-white transition-colors">
          <Layers className="h-5 w-5" />
        </button>
      </div>

      {/* Right-side quick controls */}
      {ready && (
        <div className="absolute right-4 z-10 flex flex-col gap-2" style={{ top: showLayers ? 340 : 72 }}>
          <button onClick={() => setIs3d((v) => !v)} aria-label="Toggle 3D" className="h-10 w-10 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[11px] font-extrabold text-[#334155]">
            {is3d ? "2D" : <Box className="h-4.5 w-4.5" />}
          </button>
          <button onClick={recenter} aria-label="Centre on me" className="h-10 w-10 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[#0D9488]">
            <LocateFixed className="h-4.5 w-4.5" />
          </button>
        </div>
      )}

      {/* Legend / layers */}
      {showLayers && ready && (
        <div className="absolute top-[72px] right-4 z-10 bg-white/95 shadow-md rounded-2xl p-3 w-[172px]">
          <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Layers</p>
          {Object.entries(poiStyles).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 py-1">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: v.color }} />
              <span className="text-[12px] text-[#334155]">{v.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 py-1">
            <span className="h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: "#0D9488" }} />
            <span className="text-[12px] text-[#334155]">You</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-[#64748B] mb-1.5">Guardian radius</p>
            <div className="flex gap-1.5">
              {guardianRadiusOptions.map((r) => (
                <button key={r} onClick={() => setRadius(r)} className={`flex-1 text-[11px] font-bold rounded-lg py-1.5 transition-colors ${radius === r ? "bg-[#0D9488] text-white" : "bg-[#F1F5F9] text-[#64748B]"}`}>
                  {r >= 1000 ? "1km" : `${r}m`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Guardian Mode toggle */}
      {ready && !guardian && !selected && (
        <button
          onClick={() => setGuardian(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 rounded-full bg-[#059669] text-white px-6 py-3.5 text-[15px] font-bold shadow-[0_12px_28px_-8px_rgba(5,150,105,0.6)] hover:bg-[#047857] transition-colors flex items-center gap-2"
        >
          <Navigation2 className="h-5 w-5" /> Enter Guardian Mode
        </button>
      )}

      {ready && guardian && (
        <GuardianHUD
          routes={routes}
          routeState={routeState}
          hasDestination={!!destination}
          activeRoute={activeRoute}
          onRoute={setActiveRoute}
          nearestPolice={nearestPolice}
          onExit={() => setGuardian(false)}
        />
      )}

      {selected && (
        <BuildingIntelligence selected={selected} onClose={() => { setSelected(null); pickMarkerRef.current?.remove(); }} onRouteHere={(dest) => planRoute(dest)} canRoute={!!coords} />
      )}
    </div>
  );
};

export default GuardianCityMap;
