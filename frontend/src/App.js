import React, { useState, Suspense, lazy } from "react";
import "./App.css";
import { Toaster } from "sonner";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import HomeScreen from "./components/HomeScreen";
import TalkScreen from "./components/TalkScreen";
import SafetyModeScreen from "./components/SafetyModeScreen";
import NearbyScreen from "./components/NearbyScreen";
import ReportScreen from "./components/ReportScreen";
import AlertsScreen from "./components/AlertsScreen";
import ProfileScreen from "./components/ProfileScreen";
import SosScreen from "./components/SosScreen";
import ContactsScreen from "./components/ContactsScreen";
import GuardianScreen from "./components/GuardianScreen";

// Heavy 3D module — loaded only when the user opens the Guardian City map
const GuardianCityMap = lazy(() => import("./components/map/GuardianCityMap"));

// Tabs that live in the bottom nav
const TABS = ["home", "nearby", "alerts", "profile"];

function App() {
  const [screen, setScreen] = useState("home");
  const [screenProps, setScreenProps] = useState({});

  const navigate = (next, props = {}) => {
    setScreenProps(props);
    setScreen(next);
  };

  const goHome = () => navigate("home");

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
        return <GuardianScreen onBack={goHome} />;
      case "talk":
        return <TalkScreen onBack={goHome} emergency={screenProps.emergency} />;
      case "safety":
        return <SafetyModeScreen onBack={goHome} onManageContacts={() => navigate("contacts")} />;
      case "report":
        return <ReportScreen onBack={goHome} />;
      case "nearby":
        return <NearbyScreen onBack={goHome} onOpenMap={() => navigate("guardianmap")} />;
      case "alerts":
        return <AlertsScreen />;
      case "profile":
        return <ProfileScreen onNavigate={navigate} />;
      case "home":
      default:
        return <HomeScreen onNavigate={navigate} />;
    }
  };

  return (
    <div className="App min-h-screen w-full flex items-center justify-center bg-[#EFE9E0] sm:py-6">
      {/* Mobile frame */}
      <div className="relative w-full sm:max-w-[440px] h-screen sm:h-[900px] sm:rounded-[2.2rem] sm:border sm:border-[#E4DCCF] overflow-hidden saathi-shell sm:shadow-[0_30px_80px_-30px_rgba(27,42,40,0.4)]">
        <div className="flex flex-col h-full">
          {showChrome && <Header />}
          <main className={`flex-1 overflow-y-auto no-scrollbar ${showChrome ? "pb-24" : ""}`}>
            {renderScreen()}
          </main>
        </div>
        {showChrome && <BottomNav active={activeTab} onNavigate={(id) => navigate(id)} />}

        {/* Guardian City 3D map — full-bleed overlay, lazily mounted */}
        {screen === "guardianmap" && (
          <div className="absolute inset-0 z-40">
            <Suspense fallback={
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#EDEDE7]">
                <div className="h-12 w-12 rounded-full border-4 border-[#0D9488]/30 border-t-[#0D9488] animate-spin mb-4" />
                <p className="text-[14px] font-semibold text-[#334155]">Loading Guardian City engine…</p>
              </div>
            }>
              <GuardianCityMap onBack={goHome} />
            </Suspense>
          </div>
        )}

        <Toaster position="top-center" richColors toastOptions={{ style: { borderRadius: "16px" } }} />
      </div>
    </div>
  );
}

export default App;
