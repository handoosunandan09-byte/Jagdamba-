// Guardian City 3D spatial map (CesiumJS) for Saathi — Bengaluru.
// Set the Cesium static asset base URL BEFORE importing Cesium.
window.CESIUM_BASE_URL = "/cesium";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  cityConfig, pois, poiStyles, safeRoutes, userPosition, guardianRadiusOptions,
} from "../../mapData";
import BuildingIntelligence from "./BuildingIntelligence";
import GuardianHUD from "./GuardianHUD";
import { ChevronLeft, ShieldCheck, Layers, Navigation2 } from "lucide-react";

const ION_TOKEN = process.env.REACT_APP_CESIUM_ION_TOKEN;
const GROUND_M = 900; // approx Bengaluru terrain elevation (MSL) for camera framing

const typeGlyph = {
  hospital: "H",
  police: "P",
  pharmacy: "+",
  incident: "!",
};

const GuardianCityMap = ({ onBack }) => {
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
        if (ION_TOKEN) Cesium.Ion.defaultAccessToken = ION_TOKEN;

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
          } catch (e) { /* fall back to mock blocks */ }
        }

        if (cancelled || viewer.isDestroyed()) return;

        // Supplement with a few extruded mock blocks for 3D depth
        addMockBuildings(viewer);

        // Tilted civic overview of Bengaluru
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            cityConfig.center.lng, cityConfig.center.lat - 0.012, GROUND_M + cityConfig.cameraAltitude
          ),
          orientation: {
            heading: Cesium.Math.toRadians(20),
            pitch: Cesium.Math.toRadians(cityConfig.pitch),
            roll: 0,
          },
        });

        drawPois(viewer);
        drawUser(viewer);
        drawRadius(viewer, radius);
        setupPicking(viewer);

        if (!cancelled) setReady(true);
      } catch (err) {
        console.error("Cesium init failed", err);
        if (!cancelled) setLoadError(err.message || "Failed to initialise 3D map");
      }
    };

    init();

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
  }, []);

  // ---- Helpers ----
  const addMockBuildings = (viewer) => {
    // light slate extruded boxes near the center for 3D depth (used with or without ion)
    const base = cityConfig.center;
    let s = 1;
    for (let i = 0; i < 60; i++) {
      s = (s * 9301 + 49297) % 233280;
      const r = s / 233280;
      const dLat = (r - 0.5) * 0.02;
      const dLng = (((s * 7 + 13) % 233280) / 233280 - 0.5) * 0.02;
      const h = 20 + ((s % 120));
      const size = 0.0006 + (r * 0.0008);
      viewer.entities.add({
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray([
            base.lng + dLng - size, base.lat + dLat - size,
            base.lng + dLng + size, base.lat + dLat - size,
            base.lng + dLng + size, base.lat + dLat + size,
            base.lng + dLng - size, base.lat + dLat + size,
          ]),
          extrudedHeight: h,
          perPositionHeight: false,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          material: Cesium.Color.fromCssColorString("#E2E8F0").withAlpha(0.95),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString("#C7D0DB"),
        },
      });
    }
  };

  const drawPois = (viewer) => {
    pois.forEach((p) => {
      const col = poiStyles[p.type].color;
      viewer.entities.add({
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
    });
  };

  const drawUser = (viewer) => {
    userEntityRef.current = viewer.entities.add({
      id: "user-pos",
      position: Cesium.Cartesian3.fromDegrees(userPosition.lng, userPosition.lat),
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
      position: Cesium.Cartesian3.fromDegrees(userPosition.lng, userPosition.lat),
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
    const route = safeRoutes[routeKey];
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
      const base = process.env.REACT_APP_BACKEND_URL;
      const url = `${base}/api/spatial/building-summary?lat=${lat}&lng=${lng}&user_lat=${userPosition.lat}&user_lng=${userPosition.lng}`;
      const res = await fetch(url);
      const data = await res.json();
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

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    if (guardian) {
      drawRoute(viewer, activeRoute);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(userPosition.lng, userPosition.lat - 0.004, GROUND_M + 350),
        orientation: { heading: Cesium.Math.toRadians(35), pitch: Cesium.Math.toRadians(-30), roll: 0 },
        duration: 2.2,
      });
    } else {
      clearRoutes(viewer);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(cityConfig.center.lng, cityConfig.center.lat - 0.012, GROUND_M + cityConfig.cameraAltitude),
        orientation: { heading: Cesium.Math.toRadians(20), pitch: Cesium.Math.toRadians(cityConfig.pitch), roll: 0 },
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
  }, [activeRoute]);

  return (
    <div className="relative h-full w-full bg-[#DCE3EA] overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading / error overlay */}
      {!ready && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#EDEDE7] z-20">
          <div className="h-12 w-12 rounded-full border-4 border-[#0D9488]/30 border-t-[#0D9488] animate-spin mb-4" />
          <p className="text-[14px] font-semibold text-[#334155]">Streaming Bengaluru city tiles…</p>
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
          <span className="text-[13px] font-bold text-[#334155]">Guardian City · {cityConfig.name}</span>
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
          activeRoute={activeRoute}
          onRoute={setActiveRoute}
          onExit={() => setGuardian(false)}
        />
      )}

      {/* Building intelligence bottom sheet */}
      {selected && (
        <BuildingIntelligence selected={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

export default GuardianCityMap;
