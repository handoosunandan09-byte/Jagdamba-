import React, { useState, useEffect, Suspense, lazy } from "react";
import "./App.css";
import { Toaster } from "sonner";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import HomeScreen from "./components/HomeScreen";
const TalkScreen = lazy(() => import("./components/TalkScreen"));
const SafetyModeScreen = lazy(() => import("./components/SafetyModeScreen"));
const NearbyScreen = lazy(() => import("./components/NearbyScreen"));
const ReportScreen = lazy(() => import("./components/ReportScreen"));
const AlertsScreen = lazy(() => import("./components/AlertsScreen"));
const ProfileScreen = lazy(() => import("./components/ProfileScreen"));
const RecordingsScreen = lazy(() => import("./components/RecordingsScreen"));
const SosScreen = lazy(() => import("./components/SosScreen"));
const ContactsScreen = lazy(() => import("./components/ContactsScreen"));
const GuardianScreen = lazy(() => import("./components/GuardianScreen"));
import { EmergencyProvider } from "./context/EmergencyContext";
import { UserProvider, useUser } from "./context/UserContext";
import OnboardingScreen from "./components/OnboardingScreen";
import { permsDone } from "./lib/perms";
import { sessionUnlocked } from "./lib/biometric";
import BiometricGate from "./components/BiometricGate";
const FingerprintSetup = lazy(() => import("./components/FingerprintSetup"));
const PermissionsScreen = lazy(() => import("./components/PermissionsScreen"));
import { VoiceGuardProvider } from "./context/VoiceGuardContext";
import VoiceOrb from "./components/VoiceOrb";
import SOSDistressTrigger from "./components/emergency/SOSDistressTrigger";
import EmergencyOverlay from "./components/emergency/EmergencyOverlay";

// Heavy 3D module — loaded only when the user opens the Guardian City map
const GuardianCityMap = lazy(() => import("./components/map/GuardianCityMap"));

// Tabs that live in the bottom nav
const TABS = ["home", "nearby", "alerts", "profile"];

function AppShell() {
  const { profileStatus, reloadProfile } = useUser();
  const [screen, setScreen] = useState(() => (permsDone() ? "home" : "permissions"));
  const [screenProps, setScreenProps] = useState({});
  // Holo Shield entry screen: shown once per app session (fingerprint unlock when enrolled)
  const [locked, setLocked] = useState(() => permsDone() && !sessionUnlocked());

  const navigate = (next, props = {}) => {
    setScreenProps(props);
    setScreen(next);
  };

  const goHome = () => navigate("home");
  // Once opened, Guardian Mode stays alive in the background of the app
  const [guardianMounted, setGuardianMounted] = useState(false);
  useEffect(() => { if (screen === "guardian") setGuardianMounted(true); }, [screen]);

  const activeTab = TABS.includes(screen) ? screen : "home";
  const showChrome = TABS.includes(screen); // show Header + BottomNav on tab screens

  const renderScreen = () => {
    switch (screen) {
      case "sos":
        return (
          <SosScreen
            onCancel={goHome}
            onTalk={() => navigate("talk", { emergency: true })}
            onManageContacts={() => navigate("contacts")}
          />
        );
      case "contacts":
        return <ContactsScreen onBack={goHome} />;
      case "guardian":
        return null; // kept mounted below so crash detection keeps running on other screens
      case "fingerprint":
        return <FingerprintSetup onBack={() => navigate("profile")} />;
      case "recordings":
        return <RecordingsScreen onBack={() => navigate("profile")} />;
      case "talk":
        return <TalkScreen onBack={goHome} emergency={screenProps.emergency} />;
      case "safety":
        return <SafetyModeScreen onBack={goHome} onManageContacts={() => navigate("contacts")} />;
      case "report":
        return <ReportScreen onBack={goHome} />;
      case "nearby":
        return <NearbyScreen onBack={goHome} onOpenMap={() => navigate("guardianmap")} />;
      case "alerts":
        return <AlertsScreen onReport={() => navigate("report")} />;
      case "permissions":
        return <PermissionsScreen onDone={goHome} />;
      case "apppermissions":
        return <PermissionsScreen onDone={() => navigate("profile")} onBack={() => navigate("profile")} />;
      case "editprofile":
        return <OnboardingScreen onDone={() => navigate("profile")} onBack={() => navigate("profile")} />;
      case "profile":
        return <ProfileScreen onNavigate={navigate} />;
      case "home":
      default:
        return <HomeScreen onNavigate={navigate} />;
    }
  };

  if (profileStatus !== "ready") {
    return (
      <div className="App min-h-screen w-full flex items-center justify-center bg-[#010309] sm:py-6">
        <div className="relative w-full sm:max-w-[440px] h-screen sm:h-[900px] sm:rounded-[2.2rem] sm:border sm:border-[#78BEFF]/20 overflow-hidden saathi-shell">
          {profileStatus === "loading" && (
            <div className="h-full flex items-center justify-center">
              <div className="h-10 w-10 rounded-full border-4 border-[#56E6FF]/25 border-t-[#56E6FF] animate-spin" />
            </div>
          )}
          {profileStatus === "missing" && <OnboardingScreen />}
          {profileStatus === "error" && (
            <div className="h-full flex flex-col items-center justify-center px-8 text-center">
              <p className="text-[17px] font-bold text-[#EEF4FF]">Can&apos;t reach Jagdamba servers</p>
              <p className="text-[13px] text-[#93A3CC] mt-2">In an emergency, call 112 directly.</p>
              <a href="tel:112" className="mt-5 rounded-2xl bg-[#E5603C] text-white py-3 px-8 text-[15px] font-bold">Call 112</a>
              <button onClick={reloadProfile} className="mt-3 text-[14px] font-semibold text-[#56E6FF]">Try again</button>
            </div>
          )}
          <Toaster position="top-center" richColors theme="dark" theme="dark" toastOptions={{ style: { borderRadius: "16px" } }} />
        </div>
      </div>
    );
  }

  return (
    <EmergencyProvider>
      {/* Talk screen uses the microphone for dictation, so pause hands-free SOS there */}
      <VoiceGuardProvider paused={screen === "talk"}>
      <div className="App min-h-screen w-full flex items-center justify-center bg-[#010309] sm:py-6">
        {/* Mobile frame */}
        <div className="relative w-full sm:max-w-[440px] h-screen sm:h-[900px] sm:rounded-[2.2rem] sm:border sm:border-[#78BEFF]/20 overflow-hidden saathi-shell sm:shadow-[0_30px_80px_-30px_rgba(61,123,255,0.45)]">
          <div className="flex flex-col h-full">
            {showChrome && <Header onProfile={() => navigate("profile")} />}
            <main className={`flex-1 overflow-y-auto no-scrollbar ${showChrome ? "pb-28" : ""}`}>
              <Suspense fallback={<div className="h-full flex items-center justify-center py-20"><div className="h-9 w-9 rounded-full border-4 border-[#56E6FF]/25 border-t-[#56E6FF] animate-spin" /></div>}>
              {renderScreen()}
              {guardianMounted && (
                <div className={screen === "guardian" ? "h-full" : "hidden"}>
                  <GuardianScreen onBack={goHome} onAlert={() => navigate("guardian")} />
                </div>
              )}
              </Suspense>
            </main>
          </div>
          {showChrome && <BottomNav active={activeTab} onNavigate={(id) => navigate(id)} />}

          {/* Persistent one-touch emergency trigger (tab screens only) */}
          {showChrome && <SOSDistressTrigger />}

          {/* Siri-style Voice SOS orb (visible whenever Voice SOS is on) */}
          <VoiceOrb />

          {/* Guardian City 3D map — full-bleed overlay, lazily mounted */}
          {screen === "guardianmap" && (
            <div className="absolute inset-0 z-40">
              <Suspense fallback={
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#02050F]">
                  <div className="h-12 w-12 rounded-full border-4 border-[#56E6FF]/30 border-t-[#56E6FF] animate-spin mb-4" />
                  <p className="text-[14px] font-semibold text-[#93A3CC]">Loading Guardian City engine…</p>
                </div>
              }>
                <GuardianCityMap onBack={goHome} />
              </Suspense>
            </div>
          )}

          {/* Fingerprint / welcome entry (Voice SOS keeps listening underneath) */}
          {locked && <BiometricGate onDone={() => setLocked(false)} />}

          {/* Emergency crisis-mode overlay (highest priority) */}
          <EmergencyOverlay />

          <Toaster position="top-center" richColors toastOptions={{ style: { borderRadius: "16px" } }} />
        </div>
      </div>
      </VoiceGuardProvider>
    </EmergencyProvider>
  );
}

function App() {
  return (
    <UserProvider>
      <AppShell />
    </UserProvider>
  );
}

export default App;
