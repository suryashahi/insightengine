import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import ChatPage from "./pages/ChatPage";
import DocumentsPage from "./pages/DocumentsPage";
import SearchPage from "./pages/SearchPage";
import UtilitiesPage from "./pages/UtilitiesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import { User } from "./types";
import { api } from "./services/api";
import { Menu, Sparkles } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthActive, setIsAuthActive] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync token state on startup
  useEffect(() => {
    async function checkAuth() {
      // Check for resetToken query parameter in the URL on startup
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("resetToken");
      if (urlToken) {
        setResetToken(urlToken);
        // Clean up parameters so URL is pristine and high-fidelity
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const savedToken = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");

      if (savedToken && savedUser) {
        try {
          // Double verify with server profile endpoint sync
          const verifiedUser = await api.getMe();
          setUser(verifiedUser);
          setToken(savedToken);
        } catch (err) {
          console.error("Startup token validation expired:", err);
          // Token expired, clear storage
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  const handleAuthSuccess = (authUser: User, authToken: string) => {
    setUser(authUser);
    setToken(authToken);
    setIsAuthActive(false);
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    setIsAuthActive(false);
    setActiveTab("dashboard");
  };

  // Live Demo optimistic bypass: registers a randomized unique Guest session seamlessly!
  const handleLiveDemo = async () => {
    setLoading(true);
    try {
      const randHex = Math.floor(Math.random() * 0xffffff).toString(16);
      const guestEmail = `guest_${randHex}@assistant.com`;
      const guestPassword = `guest_pass_${randHex}`;
      const guestName = `Guest Analyst #${randHex.toUpperCase()}`;

      const res = await api.register({
        email: guestEmail,
        password: guestPassword,
        name: guestName,
      });

      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      handleAuthSuccess(res.user, res.token);
    } catch (err) {
      console.error("Optimistic Guest demo initialization failed:", err);
      // Fallback preseeded guest
      alert("Demo workspace index timing limit exceeded. Please Register a free account directly.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-slate-300 border-t-purple-600 animate-spin" />
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest leading-none">AI Research Assist bootloader...</p>
      </div>
    );
  }

  // Segment 0: Intercept if the secure resetToken is captured
  if (resetToken) {
    return (
      <ResetPasswordPage
        token={resetToken}
        onSuccess={() => {
          setResetToken(null);
          setIsAuthActive(true);
        }}
        onCancel={() => {
          setResetToken(null);
        }}
      />
    );
  }

  // Segment 1: Show Landing Page if not authenticated and auth portal is inactive
  if (!user && !isAuthActive) {
    return (
      <LandingPage
        onGetStarted={() => setIsAuthActive(true)}
        onLiveDemo={handleLiveDemo}
      />
    );
  }

  // Segment 2: Show Auth Registration Panel
  if (!user && isAuthActive) {
    return (
      <AuthPage
        onAuthSuccess={handleAuthSuccess}
        onBackToLanding={() => setIsAuthActive(false)}
      />
    );
  }

  // Segment 3: Primary Workspace layout with Sidebar navigation
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative">
      {/* Modern AI Animated Background Orbs */}
      <div className="absolute top-[5%] left-[5%] w-[45vw] h-[45vh] rounded-full aurora-blob-1 pointer-events-none z-0" />
      <div className="absolute bottom-[5%] right-[5%] w-[40vw] h-[40vh] rounded-full aurora-blob-2 pointer-events-none z-0" />
      <div className="absolute top-[40%] right-[25%] w-[35vw] h-[35vh] rounded-full aurora-blob-3 pointer-events-none z-0 opacity-40" />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
        }}
        user={user}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main Screen Active Tab Renderers */}
      <main className="flex-1 overflow-hidden flex flex-col h-full bg-transparent z-10">
        {/* Mobile Header Top Bar */}
        <div className="md:hidden flex items-center justify-between px-6 py-4 bg-[#090d22]/80 border-b border-white/10 shrink-0 z-20 backdrop-blur-md">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-350 hover:text-white transition-all cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-sans font-black text-sm tracking-tight text-white leading-none">
              InsightEngine
            </span>
          </div>
          <div className="w-9 h-9 opacity-0 font-bold" />
        </div>

        <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeTab === "dashboard" && (
            <DashboardPage user={user} setActiveTab={setActiveTab} />
          )}
          {activeTab === "chat" && <ChatPage />}
          {activeTab === "documents" && <DocumentsPage />}
          {activeTab === "search" && <SearchPage />}
          {activeTab === "utilities" && <UtilitiesPage />}
          {activeTab === "analytics" && <AnalyticsPage />}
          {activeTab === "settings" && <SettingsPage user={user} />}
          {activeTab === "admin" && user?.role === "admin" && <AdminPage />}
        </div>
      </main>
    </div>
  );
}
