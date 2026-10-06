// Mock data for Saathi — AI Community Safety Assistant clone
// NOTE: All data here is MOCKED for the frontend-only prototype.

import {
  Mic, ShieldCheck, MapPin, Building2,
  Phone, HeartPulse, Flame, ShieldAlert, Scale, Home as HomeIcon
} from "lucide-react";

export const currentUser = {
  name: "Priya Sharma",
  initials: "PS",
  location: "Koramangala, Bengaluru",
  phone: "+91 98765 43210",
};

export const quickActions = [
  {
    id: "talk",
    title: "Talk to Saathi",
    subtitle: "Voice or text conversation",
    icon: Mic,
    route: "talk",
  },
  {
    id: "safety",
    title: "Start Safety Mode",
    subtitle: "Timed checks and travel monitor",
    icon: ShieldCheck,
    route: "safety",
  },
  {
    id: "nearby",
    title: "Nearby Help",
    subtitle: "Emergency services: Police, Hospitals, NGOs",
    icon: MapPin,
    route: "nearby",
  },
  {
    id: "report",
    title: "Report a Civic Issue",
    subtitle: "Street lights, potholes, safety concerns",
    icon: Building2,
    route: "report",
  },
];

export const emergencyContacts = [
  { id: "police", label: "Police", number: "100", icon: ShieldAlert },
  { id: "ambulance", label: "Ambulance", number: "108", icon: HeartPulse },
  { id: "women", label: "Women Helpline", number: "1091", icon: Phone },
  { id: "fire", label: "Fire", number: "101", icon: Flame },
];

export const nearbyHelp = [
  { id: 1, name: "Koramangala Police Station", type: "Police", distance: "0.8 km", open: true, phone: "100", icon: ShieldAlert },
  { id: 2, name: "St. John's Medical Hospital", type: "Hospital", distance: "1.4 km", open: true, phone: "108", icon: HeartPulse },
  { id: 3, name: "Vimochana Women's Support", type: "NGO", distance: "2.1 km", open: true, phone: "1091", icon: Phone },
  { id: 4, name: "District Legal Aid Cell", type: "Legal", distance: "3.0 km", open: false, phone: "1516", icon: Scale },
  { id: 5, name: "Fire & Emergency Services", type: "Fire", distance: "2.6 km", open: true, phone: "101", icon: Flame },
];

export const communityAlerts = [
  { id: 1, level: "high", title: "Street lights out on 5th Block", area: "Koramangala 5th Block", time: "12 min ago", desc: "Several residents report non-functional street lights near the main junction. Stay cautious after dark." },
  { id: 2, level: "medium", title: "Waterlogging reported", area: "80 Feet Road", time: "1 hr ago", desc: "Heavy waterlogging making the stretch difficult to cross. Avoid two-wheelers if possible." },
  { id: 3, level: "low", title: "Community night-walk this Friday", area: "Jyoti Nagar", time: "3 hrs ago", desc: "Join the neighbourhood safety walk at 8 PM. Meet near the community park gate." },
  { id: 4, level: "medium", title: "Stray pack sighted near park", area: "HSR Sector 2", time: "5 hrs ago", desc: "A pack of stray dogs reported near the park entrance. BBMP has been notified." },
];

export const issueCategories = [
  { value: "streetlight", label: "Broken Street Light" },
  { value: "pothole", label: "Pothole / Road Damage" },
  { value: "garbage", label: "Garbage / Sanitation" },
  { value: "safety", label: "Safety Concern" },
  { value: "water", label: "Water / Drainage" },
  { value: "other", label: "Other" },
];

// Simple canned conversation logic for Saathi assistant (mocked AI)
export const saathiIntro = "Hi Priya, I'm Saathi — your community safety companion. Tell me what's happening and I'll guide you to the right help. If you're in immediate danger, tap the red button or call 100.";

export const saathiReplies = [
  {
    keywords: ["follow", "following", "stalk", "scared", "afraid", "danger"],
    reply: "Stay calm, Priya. Head toward a well-lit, crowded place like a shop or station. I've put the nearest police station (0.8 km) on your Nearby Help. Would you like me to start Safety Mode and share live check-ins with your trusted contact?",
  },
  {
    keywords: ["accident", "hurt", "injured", "medical", "bleeding", "hospital"],
    reply: "I'm here with you. For medical emergencies call 108 for an ambulance. The nearest hospital is St. John's Medical (1.4 km). Can you tell me if the person is conscious and breathing?",
  },
  {
    keywords: ["harass", "touch", "eve", "inappropriate", "catcall"],
    reply: "I'm sorry that happened. You are not alone. The Women Helpline (1091) can assist immediately, and Vimochana (2.1 km) offers in-person support. Would you like help filing a report?",
  },
  {
    keywords: ["pothole", "light", "garbage", "civic", "road", "water"],
    reply: "Thanks for flagging a civic issue. I can log this for the local authorities. Tap 'Report a Civic Issue' and I'll pre-fill your location at Koramangala. Want me to do that now?",
  },
];

export const defaultSaathiReply = "I hear you. Could you share a few more details — where you are and what kind of help you need (safety, medical, legal, or civic)? Meanwhile, you can always tap the red button for immediate assistance.";

export const navItems = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "nearby", label: "Nearby", icon: MapPin },
  { id: "alerts", label: "Alerts", icon: ShieldAlert },
  { id: "profile", label: "Profile", icon: null },
];
