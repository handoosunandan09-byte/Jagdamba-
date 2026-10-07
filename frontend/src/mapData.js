// Mock spatial intelligence data for Saathi Guardian City (Bengaluru).
// Abstracted cityConfig so Mumbai / Delhi / Pune can be plugged in later.

export const cityConfig = {
  name: "Bengaluru",
  center: { lat: 12.9716, lng: 77.5946 },
  cameraAltitude: 1500,
  pitch: -45,
  bounds: {
    west: 77.56, south: 12.95, east: 77.66, north: 13.0,
  },
};

// POI types -> civic palette (restrained, Apple-Maps-like)
export const poiStyles = {
  hospital: { color: "#2563EB", label: "Hospital" },
  police: { color: "#0D9488", label: "Police" },
  pharmacy: { color: "#F59E0B", label: "24x7 Pharmacy" },
  incident: { color: "#DC2626", label: "Active Alert" },
};

export const pois = [
  // Hospitals (blue)
  { id: "h1", type: "hospital", name: "Bowring & Lady Curzon Hospital", lat: 12.9823, lng: 77.6063, ward: "Shivaji Nagar", open: true },
  { id: "h2", type: "hospital", name: "Manipal Hospital (Old Airport Rd)", lat: 12.9606, lng: 77.6486, ward: "HAL", open: true },
  { id: "h3", type: "hospital", name: "St. Philomena's Hospital", lat: 12.9709, lng: 77.6089, ward: "Neelasandra", open: true },
  { id: "h4", type: "hospital", name: "Vydehi Multispeciality (MG Rd)", lat: 12.9754, lng: 77.6096, ward: "Ulsoor", open: true },

  // Police (teal)
  { id: "p1", type: "police", name: "Ashok Nagar Police Station", lat: 12.9655, lng: 77.6045, ward: "Ashok Nagar", open: true },
  { id: "p2", type: "police", name: "Cubbon Park Police Station", lat: 12.9763, lng: 77.5929, ward: "Cubbon Park", open: true },
  { id: "p3", type: "police", name: "Indiranagar Police Station", lat: 12.9719, lng: 77.6412, ward: "Indiranagar", open: true },
  { id: "p4", type: "police", name: "Koramangala Police Station", lat: 12.9352, lng: 77.6245, ward: "Koramangala", open: true },

  // 24x7 Pharmacies (amber)
  { id: "ph1", type: "pharmacy", name: "Apollo Pharmacy (Brigade Rd)", lat: 12.9718, lng: 77.6071, ward: "Brigade Road", open: true },
  { id: "ph2", type: "pharmacy", name: "MedPlus (Indiranagar 100ft)", lat: 12.9711, lng: 77.6401, ward: "Indiranagar", open: true },
  { id: "ph3", type: "pharmacy", name: "Apollo Pharmacy (Koramangala)", lat: 12.9345, lng: 77.6265, ward: "Koramangala", open: true },
  { id: "ph4", type: "pharmacy", name: "MedPlus 24x7 (MG Road)", lat: 12.9759, lng: 77.6045, ward: "MG Road", open: true },

  // Active incidents (red)
  { id: "i1", type: "incident", name: "Poorly-lit stretch reported", lat: 12.9690, lng: 77.6150, ward: "Richmond Town", open: true },
  { id: "i2", type: "incident", name: "Chain-snatching alert (2 reports)", lat: 12.9735, lng: 77.6320, ward: "Domlur", open: true },
];

// Two simulated safe routes (near MG Road -> Indiranagar corridor)
export const safeRoutes = {
  // Route A: safest / well-lit, passes police + hospital
  A: {
    id: "A",
    name: "Safest · well-lit",
    color: "#059669",
    etaMin: 14,
    distanceKm: 4.2,
    lighting: "High",
    path: [
      { lat: 12.9718, lng: 77.6071 }, // Brigade Rd
      { lat: 12.9754, lng: 77.6096 }, // MG Rd (hospital)
      { lat: 12.9763, lng: 77.5929 }, // Cubbon Park PS -> wait, keep corridor; use main road pts
      { lat: 12.9759, lng: 77.6045 },
      { lat: 12.9735, lng: 77.6320 },
      { lat: 12.9719, lng: 77.6412 }, // Indiranagar PS
    ],
  },
  // Route B: fastest (fewer safe nodes)
  B: {
    id: "B",
    name: "Fastest",
    color: "#64748B",
    etaMin: 10,
    distanceKm: 3.6,
    lighting: "Medium",
    path: [
      { lat: 12.9718, lng: 77.6071 },
      { lat: 12.9690, lng: 77.6150 },
      { lat: 12.9680, lng: 77.6280 },
      { lat: 12.9711, lng: 77.6401 },
    ],
  },
};

// Simulated user live position (central Bengaluru, Brigade Road)
export const userPosition = { lat: 12.9718, lng: 77.6071 };

export const guardianRadiusOptions = [300, 500, 1000]; // meters
