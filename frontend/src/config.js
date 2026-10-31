// Static app configuration (navigation, form options and India's official
// emergency numbers). Live data — places, alerts, routes, the user — comes from the API.
import {
  Mic, ShieldCheck, MapPin, Building2,
  Phone, HeartPulse, Flame, ShieldAlert, Siren, Home as HomeIcon,
} from "lucide-react";

export const quickActions = [
  { id: "talk", title: "Talk to Jagdamba", subtitle: "Voice or text conversation", icon: Mic, route: "talk" },
  { id: "safety", title: "Start Safety Mode", subtitle: "Timed checks and travel monitor", icon: ShieldCheck, route: "safety" },
  { id: "nearby", title: "Nearby Help", subtitle: "Police, hospitals and pharmacies around you", icon: MapPin, route: "nearby" },
  { id: "report", title: "Report a Civic Issue", subtitle: "Street lights, potholes, safety concerns", icon: Building2, route: "report" },
];

// Official national helplines (India)
export const emergencyContacts = [
  { id: "ers", label: "Emergency", number: "112", icon: Siren },
  { id: "police", label: "Police", number: "100", icon: ShieldAlert },
  { id: "ambulance", label: "Ambulance", number: "108", icon: HeartPulse },
  { id: "women", label: "Women Helpline", number: "1091", icon: Phone },
  { id: "fire", label: "Fire", number: "101", icon: Flame },
];

export const issueCategories = [
  { value: "streetlight", label: "Broken Street Light" },
  { value: "pothole", label: "Pothole / Road Damage" },
  { value: "garbage", label: "Garbage / Sanitation" },
  { value: "safety", label: "Safety Concern" },
  { value: "water", label: "Water / Drainage" },
  { value: "other", label: "Other" },
];

export const navItems = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "nearby", label: "Nearby", icon: MapPin },
  { id: "alerts", label: "Alerts", icon: ShieldAlert },
  { id: "profile", label: "Profile", icon: null },
];

export const poiStyles = {
  hospital: { color: "#2563EB", label: "Hospital" },
  police: { color: "#0D9488", label: "Police" },
  pharmacy: { color: "#F59E0B", label: "Pharmacy" },
  incident: { color: "#DC2626", label: "Reported issue" },
};

export const guardianRadiusOptions = [300, 500, 1000]; // meters
