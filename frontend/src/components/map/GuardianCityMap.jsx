// Guardian City 3D spatial map (CesiumJS) for Jagdamba — centred on the user's live location.
// Set the Cesium static asset base URL BEFORE importing Cesium.
window.CESIUM_BASE_URL = "/cesium";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { poiStyles, guardianRadiusOptions } from "../../config";
import { useUser } from "../../context/UserContext";
import { getNearby, getAlerts, getBuildingSummary, getSafeRoutes } from "../../lib/api";
import BuildingIntelligence from "./BuildingIntelligence";
import GuardianHUD from "./GuardianHUD";
import { ChevronLeft, ShieldCheck, Layers, Navigation2 } from "lucide-react";

const ION_TOKEN = process.env.REACT_APP_CESIUM_ION_TOKEN;
const GROUND_M = 0; // camera altitude offset (terrain is ellipsoid unless an ion token is set)
const CAMERA_ALT = 1500;
const CAMERA_PITCH = -45;

const typeGlyph = {
  hospital: "H",
  police: "P",
  pharmacy: "+",
  incident: "!",
};

const GuardianCityMap = ({ onBack }) => {
  const { coords, place, locStatus, retryLocation } = useUser();
  // Freeze the first GPS fix as the map centre; the user marker keeps tracking live.
  const centerRef = useRef(null);
  if (!centerRef.current && coords) centerRef.current = { lat: coords.lat, lng: coords.lng };
  const userRef = useRef(coords);
  userRef.current = coords;
  const poiEntitiesRef = useRef([]);
  const [pois, setPois] = useState([]);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [routeState, setRouteState] = useState("idle"); // idle | loading | ready | error
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const userEntityRef = useRef(null);
  const radiusEntityRef = useRef(null);
  const routeEntitiesRef = useRef([]);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [guardian, setGuardian] = useState(false);
  const [radius, setRadius] = useState(500);
  const [activeRoute, setActiveRoute] = useState("A");
  const [selected, setSelected] = useState(null); // building intelligence payload
  const [showLayers, setShowLayers] = useState(true);

  // ---- Initialise the Cesium viewer once ----
  useEffect(() => {
    let viewer;
    let cancelled = false;

    const init = async () => {
      try {
        // Always set the ion token explicitly. Setting it (or "" when absent)
        // prevents Cesium from using its built-in demo token, which is what
        // triggers the "default ion access token / API key required" panel.
        Cesium.Ion.defaultAccessToken = ION_TOKEN || "";

        viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          showRenderLoopErrors: false, // never show Cesium's red error panel to users
          creditContainer: document.createElement("div"),
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            Promise.resolve(new Cesium.UrlTemplateImageryProvider({
              url: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
              credit: "© OpenStreetMap contributors, © CARTO",
              maximumLevel: 19,
            }))
          ),
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        });
        if (cancelled || viewer.isDestroyed()) { if (viewer && !viewer.isDestroyed()) viewer.destroy(); return; }
        viewerRef.current = viewer;

        // Clean, light "civic" look (Apple-Maps-like)
        const scene = viewer.scene;
        scene.skyAtmosphere.show = true;
        scene.globe.baseColor = Cesium.Color.fromCssColorString("#EDEDE7");
        scene.fog.enabled = true;
        scene.fog.density = 0.0002;
        scene.globe.enableLighting = false;
        scene.backgroundColor = Cesium.Color.fromCssColorString("#DCE3EA");
        scene.highDynamicRange = false;

        // Terrain (requires ion token) — best-effort, non-blocking
        if (ION_TOKEN) {
          try {
            const terrain = await Cesium.createWorldTerrainAsync();
            if (cancelled || viewer.isDestroyed()) return;
            viewer.terrainProvider = terrain;
          } catch (e) { /* keep ellipsoid */ }
        }

        // 3D Buildings: streamed Cesium OSM Buildings (ion) with a restrained style
        if (ION_TOKEN) {
          try {
            const osm = await Cesium.createOsmBuildingsAsync();
            if (cancelled || viewer.isDestroyed()) return;
            osm.style = new Cesium.Cesium3DTileStyle({
              color: {
                conditions: [
                  ["${feature['building']} === 'hospital'", "color('#2563EB')"],
                  ["${feature['building']} === 'clinic'", "color('#2563EB')"],
                  ["${feature['building']} === 'police'", "color('#0D9488')"],
                  ["true", "color('#E2E8F0')"],
                ],
              },
            });
            viewer.scene.primitives.add(osm);
            // Swallow any per-tile load failures so no error surfaces to the user
            try { osm.tileFailed.addEventListener(() => {}); } catch (e) { /* noop */ }
          } catch (e) { /* buildings unavailable — flat basemap only */ }
        }

        if (cancelled || viewer.isDestroyed()) return;

        // Tilted overview around the user
        const c = centerRef.current;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(c.lng, c.lat - 0.012, GROUND_M + CAMERA_ALT),
          orientation: {
            heading: Cesium.Math.toRadians(20),
            pitch: Cesium.Math.toRadians(CAMERA_PITCH),
            roll: 0,
          },
        });

        drawUser(viewer);
        drawRadius(viewer, radius);
        setupPicking(viewer);

        if (!cancelled) setReady(true);
      } catch (err) {
        console.error("Cesium init failed", err);
        if (!cancelled) setLoadError(err.message || "Failed to initialise 3D map");
      }
    };

    if (centerRef.current) init();

    return () => {
      cancelled = true;
      try {
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.destroy();
        }
      } catch (e) { /* noop */ }
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!centerRef.current]);

  // ---- Helpers ----
  const drawPois = (viewer, list) => {
    poiEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    poiEntitiesRef.current = [];
    list.forEach((p) => {
      const col = poiStyles[p.type].color;
      const ent = viewer.entities.add({
        id: `poi-${p.id}`,
        position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat),
        point: {
          pixelSize: p.type === "incident" ? 14 : 12,
          color: Cesium.Color.fromCssColorString(col),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: typeGlyph[p.type],
          font: "bold 11px sans-serif",
          fillColor: Cesium.Color.WHITE,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          pixelOffset: new Cesium.Cartesian2(0, 0),
        },
        properties: { poi: p },
      });
      poiEntitiesRef.current.push(ent);
    });
  };

  const drawUser = (viewer) => {
    userEntityRef.current = viewer.entities.add({
      id: "user-pos",
      position: Cesium.Cartesian3.fromDegrees(userRef.current.lng, userRef.current.lat),
      point: {
        pixelSize: 16,
        color: Cesium.Color.fromCssColorString("#0D9488"),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  };

  const drawRadius = (viewer, r) => {
    if (radiusEntityRef.current) viewer.entities.remove(radiusEntityRef.current);
    radiusEntityRef.current = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(userRef.current.lng, userRef.current.lat),
      ellipse: {
        semiMajorAxis: r,
        semiMinorAxis: r,
        material: Cesium.Color.fromCssColorString("#0D9488").withAlpha(0.12),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#0D9488").withAlpha(0.6),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
  };

  const clearRoutes = (viewer) => {
    routeEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    routeEntitiesRef.current = [];
  };

  const drawRoute = (viewer, routeKey) => {
    clearRoutes(viewer);
    const route = routes.find((r) => r.id === routeKey);
    if (!route) return;
    const positions = route.path.flatMap((pt) => [pt.lng, pt.lat]);
    const line = viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(positions),
        width: 9,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Cesium.Color.fromCssColorString(route.color),
        }),
        clampToGround: true,
      },
    });
    routeEntitiesRef.current.push(line);
  };

  const setupPicking = (viewer) => {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(async (movement) => {
      const picked = viewer.scene.pick(movement.position);
      const cart = viewer.scene.pickPosition(movement.position) ||
        viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
      if (!cart) return;
      const carto = Cesium.Cartographic.fromCartesian(cart);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lng = Cesium.Math.toDegrees(carto.longitude);

      // POI clicked?
      if (picked && picked.id && typeof picked.id.id === "string" && picked.id.id.startsWith("poi-")) {
        const p = picked.id.properties.poi.getValue();
        await fetchSummary(lat, lng, p);
        return;
      }
      // Otherwise treat as building/ground selection
      await fetchSummary(lat, lng, null);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  };

  const fetchSummary = useCallback(async (lat, lng, poi) => {
    setSelected({ loading: true, poi });
    try {
      const u = userRef.current;
      const data = await getBuildingSummary({ lat, lng, ...(u ? { user_lat: u.lat, user_lng: u.lng } : {}) });
      setSelected({ loading: false, poi, data, lat, lng });
    } catch (e) {
      setSelected({ loading: false, poi, error: true, lat, lng });
    }
  }, []);

  // ---- React -> Cesium side effects ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    drawRadius(viewer, radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, ready]);

  // Live POIs (OpenStreetMap) + community-reported issues around the user
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    const c = centerRef.current;
    let cancelled = false;
    Promise.allSettled([
      getNearby({ lat: c.lat, lng: c.lng, radius: 3000, types: "police,hospital,pharmacy" }),
      getAlerts({ lat: c.lat, lng: c.lng, radius: 3000, days: 30 }),
    ]).then(([placesRes, alertsRes]) => {
      if (cancelled || viewer.isDestroyed()) return;
      const places = placesRes.status === "fulfilled" ? placesRes.value : [];
      const incidents = alertsRes.status === "fulfilled"
        ? alertsRes.value.map((a) => ({ id: `r-${a.id}`, type: "incident", name: a.title, lat: a.lat, lng: a.lng, ward: a.area }))
        : [];
      const list = [...places, ...incidents];
      setPois(list);
      drawPois(viewer, list);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Keep the user marker + guardian radius on the live GPS position
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready || !coords || viewer.isDestroyed()) return;
    if (userEntityRef.current) {
      userEntityRef.current.position = Cesium.Cartesian3.fromDegrees(coords.lng, coords.lat);
    }
    drawRadius(viewer, radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng, ready]);

  // Walking routes to the chosen destination, ranked by safety
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
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    const u = userRef.current || centerRef.current;
    const c = centerRef.current;
    if (guardian) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(u.lng, u.lat - 0.004, GROUND_M + 350),
        orientation: { heading: Cesium.Math.toRadians(35), pitch: Cesium.Math.toRadians(-30), roll: 0 },
        duration: 2.2,
      });
    } else {
      clearRoutes(viewer);
      setRoutes([]);
      setDestination(null);
      setRouteState("idle");
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(c.lng, c.lat - 0.012, GROUND_M + CAMERA_ALT),
        orientation: { heading: Cesium.Math.toRadians(20), pitch: Cesium.Math.toRadians(CAMERA_PITCH), roll: 0 },
        duration: 1.8,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardian, ready]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready || !guardian) return;
    drawRoute(viewer, activeRoute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoute, routes]);

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
    <div className="relative h-full w-full bg-[#DCE3EA] overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading / error overlay */}
      {!ready && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#EDEDE7] z-20">
          <div className="h-12 w-12 rounded-full border-4 border-[#0D9488]/30 border-t-[#0D9488] animate-spin mb-4" />
          <p className="text-[14px] font-semibold text-[#334155]">Streaming map tiles for {cityName}…</p>
          <p className="text-[12px] text-[#64748B] mt-1">Guardian City spatial engine</p>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#EDEDE7] z-20 px-8 text-center">
          <p className="text-[15px] font-bold text-[#334155]">3D map couldn&apos;t load</p>
          <p className="text-[12px] text-[#64748B] mt-2">{loadError}</p>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4 pb-3 pointer-events-none">
        <button onClick={onBack} className="pointer-events-auto h-10 w-10 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[#334155] hover:bg-white transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="pointer-events-auto bg-white/95 shadow-md rounded-full px-4 py-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#0D9488]" />
          <span className="text-[13px] font-bold text-[#334155]">Guardian City · {cityName}</span>
        </div>
        <button onClick={() => setShowLayers((v) => !v)} className="pointer-events-auto h-10 w-10 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[#334155] hover:bg-white transition-colors">
          <Layers className="h-5 w-5" />
        </button>
      </div>

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

      {/* Guardian HUD */}
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

      {/* Building intelligence bottom sheet */}
      {selected && (
        <BuildingIntelligence selected={selected} onClose={() => setSelected(null)} onRouteHere={(dest) => planRoute(dest)} canRoute={!!coords} />
      )}
    </div>
  );
};

export default GuardianCityMap;
