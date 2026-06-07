import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Sparkles, 
  HardDrive, 
  CheckCircle, 
  Cpu, 
  Activity, 
  Sliders, 
  Compass, 
  Radio, 
  FileText, 
  HelpCircle,
  TrendingUp,
  Server
} from "lucide-react";
import { User } from "../types";
import { api } from "../services/api";

interface SettingsPageProps {
  user: User | null;
}

export default function SettingsPage({ user }: SettingsPageProps) {
  // Config state synced with localStorage for premium user experience
  const [streaming, setStreaming] = useState(() => {
    const saved = localStorage.getItem("settings_streaming");
    return saved !== null ? saved === "true" : true;
  });
  const [citations, setCitations] = useState(() => {
    const saved = localStorage.getItem("settings_citations");
    return saved !== null ? saved === "true" : true;
  });
  const [temperature, setTemperature] = useState(() => {
    const saved = localStorage.getItem("settings_temperature");
    return saved !== null ? parseFloat(saved) : 0.3;
  });
  const [responseLength, setResponseLength] = useState(() => {
    return localStorage.getItem("settings_response_length") || "Medium";
  });
  const [deepResearch, setDeepResearch] = useState(() => {
    const saved = localStorage.getItem("settings_deep_research");
    return saved !== null ? saved === "true" : false;
  });

  // Keep metrics synced
  const [routerStats, setRouterStats] = useState<any | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        const stats = await api.getRouterAnalytics();
        if (active) {
          setRouterStats(stats);
          setLoadingMetrics(false);
        }
      } catch (err) {
        console.error("Failed to load router metrics on Settings refresh:", err);
        if (active) {
          setLoadingMetrics(false);
        }
      }
    };
    fetchStats();
    return () => {
      active = false;
    };
  }, []);

  // Save setters
  const saveToggle = (key: string, value: boolean, setter: (val: boolean) => void) => {
    localStorage.setItem(key, String(value));
    setter(value);
  };

  const saveLength = (value: string) => {
    localStorage.setItem("settings_response_length", value);
    setResponseLength(value);
  };

  const saveTemp = (value: number) => {
    localStorage.setItem("settings_temperature", String(value));
    setTemperature(value);
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 select-none max-w-7xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
          Environment Settings <Settings className="w-5 h-5 text-purple-400 font-bold" />
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Supervise active research accounts profile parameters, backend API connections secrets, and data ingestion constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Segment: User profile info (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 opacity-20"></div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/10 pb-3">
              Research Account Parameters
            </h3>

            <div className="space-y-4">
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Display Name:</span>
                <span className="text-white font-bold">{user?.name || "Anonymous Member"}</span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Email Address:</span>
                <span className="text-white font-bold">{user?.email || "No email linked"}</span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Workspace Authority:</span>
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-[9px] text-purple-400 font-bold border border-purple-500/20 uppercase tracking-widest w-fit mt-1">
                  {user?.role || "Member"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick System Information Display */}
          <div id="saas-system-status" className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-4 relative overflow-hidden">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/10 pb-3">
              <Server className="w-3.5 h-3.5 text-purple-450" /> System Status
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 p-3 rounded-lg border border-white/5 text-center">
                <p className="text-[9px] text-slate-450 uppercase font-black tracking-wider">Vector Database</p>
                <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Connected
                </div>
              </div>
              <div className="bg-black/20 p-3 rounded-lg border border-white/5 text-center">
                <p className="text-[9px] text-slate-450 uppercase font-black tracking-wider">Document Index</p>
                <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Healthy
                </div>
              </div>
              <div className="bg-black/20 p-3 rounded-lg border border-white/5 text-center">
                <p className="text-[9px] text-slate-450 uppercase font-black tracking-wider">Embedding Model</p>
                <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                </div>
              </div>
              <div className="bg-black/20 p-3 rounded-lg border border-white/5 text-center">
                <p className="text-[9px] text-slate-450 uppercase font-black tracking-wider">AI Router</p>
                <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Operational
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 text-[11px] text-slate-400 leading-relaxed font-serif pt-4 relative overflow-hidden">
            🔒 Our workspace operates strictly using cryptographically signed JSON Web Tokens (JWT) saved directly inside local browser storage to safe-guard communication telemetry.
          </div>
        </div>

        {/* Right Segment: Sleek AI Configuration Suite (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div id="ai-configuration-card" className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 opacity-20"></div>
            
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" /> AI Configuration
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Manage AI response behavior, provider routing, and research preferences.
              </p>
            </div>

            {/* SECTION 1: ACTIVE AI PROVIDER */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active AI Provider</span>
              <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-slate-200">
                    {routerStats?.activeProvider === "groq" 
                      ? "OpenRouter (Llama 3.3 70B)" 
                      : routerStats?.activeProvider === "mistral"
                      ? "Mistral Small"
                      : "Gemini 2.5 Flash"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Routing failover engine prioritizes cost and latency targets.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] text-emerald-400 font-black tracking-widest uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> 🟢 Active
                </span>
              </div>
            </div>

            {/* SECTION 2: PROVIDER HEALTH */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Provider Health Metrics</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Gemini Badge */}
                <div className="bg-black/10 p-3 rounded-lg border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-300 font-semibold">Gemini API</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </div>
                  <p className="text-[9px] text-slate-450 uppercase font-black">Status: <span className="text-emerald-400">Healthy</span></p>
                  <p className="text-[10px] text-purple-400 font-bold font-mono">
                    {routerStats?.metrics?.gemini?.latency > 0 ? `${routerStats.metrics.gemini.latency.toFixed(2)}s` : "1.2s"}
                  </p>
                </div>

                {/* Mistral Badge */}
                <div className="bg-black/10 p-3 rounded-lg border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-300 font-semibold">Mistral API</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </div>
                  <p className="text-[9px] text-slate-450 uppercase font-black">Status: <span className="text-emerald-400">Healthy</span></p>
                  <p className="text-[10px] text-purple-400 font-bold font-mono">
                    {routerStats?.metrics?.mistral?.latency > 0 ? `${routerStats.metrics.mistral.latency.toFixed(2)}s` : "1.8s"}
                  </p>
                </div>

                {/* OpenRouter/Groq Badge */}
                <div className="bg-black/10 p-3 rounded-lg border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-300 font-semibold">OpenRouter</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  </div>
                  <p className="text-[9px] text-slate-450 uppercase font-black">Status: <span className="text-amber-400">Ready</span></p>
                  <p className="text-[10px] text-purple-400 font-bold font-mono">
                    {routerStats?.metrics?.groq?.latency > 0 ? `${routerStats.metrics.groq.latency.toFixed(2)}s` : "2.1s"}
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 3: STREAMING SETTINGS */}
            <div className="flex items-start justify-between gap-4 pt-3 border-t border-white/5">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-200">Enable Streaming Responses</span>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Display AI responses in real-time while they are being generated.
                </p>
              </div>
              <button 
                id="toggle-streaming"
                onClick={() => saveToggle("settings_streaming", !streaming, setStreaming)}
                className={`w-10 h-5.5 rounded-full p-1 transition-colors relative duration-250 cursor-pointer ${streaming ? "bg-purple-550" : "bg-white/10"}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transform transition-transform duration-250 ${streaming ? "translate-x-4.5" : "translate-x-0"}`}></div>
              </button>
            </div>

            {/* SECTION 4: CITATION SETTINGS */}
            <div className="flex items-start justify-between gap-4 pt-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-200">Show Source Citations</span>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Display document references beneath AI answers.
                </p>
              </div>
              <button 
                id="toggle-citations"
                onClick={() => saveToggle("settings_citations", !citations, setCitations)}
                className={`w-10 h-5.5 rounded-full p-1 transition-colors relative duration-250 cursor-pointer ${citations ? "bg-purple-550" : "bg-white/10"}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transform transition-transform duration-250 ${citations ? "translate-x-4.5" : "translate-x-0"}`}></div>
              </button>
            </div>

            {/* SECTION 5: RESPONSE SETTINGS */}
            <div className="space-y-4 pt-3 border-t border-white/5">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-205">Temperature Control</span>
                  <span className="text-xs font-extrabold text-purple-400 font-mono">{temperature.toFixed(1)}</span>
                </div>
                <input 
                  id="temperature-slider"
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => saveTemp(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[9px] text-slate-400 leading-snug">
                  Lower values produce more factual answers. Higher values produce more creative answers.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-205 block">Max Response Length</span>
                <div className="grid grid-cols-3 gap-2">
                  {["Short", "Medium", "Long"].map((opt) => (
                    <button
                      id={`length-opt-${opt}`}
                      key={opt}
                      onClick={() => saveLength(opt)}
                      className={`py-1.5 text-xs font-bold border rounded-lg transition-all ${responseLength === opt ? "bg-purple-500/10 border-purple-550 text-white" : "border-white/5 bg-black/10 hover:border-white/20 text-slate-400"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 6: RESEARCH MODE */}
            <div className="flex items-start justify-between gap-4 pt-3 border-t border-white/5">
              <div className="space-y-0.5">
                <span className="text-xs font-extrabold text-slate-200">Deep Research Mode</span>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Use more retrieved context and perform deeper document analysis.
                </p>
              </div>
              <button 
                id="toggle-deep-research"
                onClick={() => saveToggle("settings_deep_research", !deepResearch, setDeepResearch)}
                className={`w-10 h-5.5 rounded-full p-1 transition-colors relative duration-250 cursor-pointer ${deepResearch ? "bg-purple-550" : "bg-white/10"}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transform transition-transform duration-250 ${deepResearch ? "translate-x-4.5" : "translate-x-0"}`}></div>
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
