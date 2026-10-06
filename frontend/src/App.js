import React, { useState } from "react";
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
        return <NearbyScreen onBack={goHome} />;
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
        <Toaster position="top-center" richColors toastOptions={{ style: { borderRadius: "16px" } }} />
      </div>
    </div>
  );
}

export default App;
