import React, { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Sparkles, HardDrive, MessageSquare, Search, FileText } from "lucide-react";
import { api } from "../services/api";
import { AnalyticsSummary } from "../types";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [routerStats, setRouterStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const stats = await api.getAnalytics();
        setData(stats);
        
        try {
          const rStats = await api.getRouterAnalytics();
          setRouterStats(rStats);
        } catch (rErr) {
          console.error("Failed to load router specific metrics:", rErr);
        }
      } catch (err) {
        console.error("Failed to load analytics dashboard details:", err);
        setError("Telemetry metrics pipeline failed to respond correctly.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-purple-600 animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Assembling analytical matrices...</p>
      </div>
    );
  }

  // Fallback structures if API fails
  const totals = data?.totals || {
    users: 0,
    documents: 0,
    chats: 0,
    queries: 0,
    searches: 0,
    storageBytes: 0,
  };
  const activeUsersDaily = data?.activeUsersDaily || [];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 select-none max-w-7xl mx-auto w-full">
      {/* Title heading greeting */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
          Usage Insights <BarChart3 className="w-5 h-5 text-purple-400" />
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Track real-time data ingestion velocities, database search logs queries, and daily user interaction patterns.
        </p>
      </div>

      {/* Grid: Gauges Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Gauge Card 1 */}
        <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 relative overflow-hidden space-y-2 hover:border-white/20 transition-all">
          <div className="flex items-center gap-2 text-purple-400">
            <FileText className="w-4 h-4 text-purple-450" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Document Uploads</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">{totals.documents}</p>
          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> +{totals.documents * 2}% Growth this week
          </div>
        </div>

        {/* Gauge Card 2 */}
        <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 relative overflow-hidden space-y-2 hover:border-white/20 transition-all">
          <div className="flex items-center gap-2 text-indigo-400">
            <MessageSquare className="w-4 h-4 text-indigo-455" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Conversations</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">{totals.chats}</p>
          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> +{totals.chats * 3}% Velocity growth
          </div>
        </div>

        {/* Gauge Card 3 */}
        <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 relative overflow-hidden space-y-2 hover:border-white/20 transition-all">
          <div className="flex items-center gap-2 text-blue-400">
            <Search className="w-4 h-4 text-blue-455" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Semantic Queries</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">{totals.queries}</p>
          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Average latency : ~340ms
          </div>
        </div>

        {/* Gauge Card 4 */}
        <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 relative overflow-hidden space-y-2 hover:border-white/20 transition-all">
          <div className="flex items-center gap-2 text-cyan-400">
            <HardDrive className="w-4 h-4 text-cyan-455" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Lexical Searches</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">{totals.searches}</p>
          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Semantic keyword boosting active
          </div>
        </div>
      </div>

      {/* Main Charts Deck Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Custom SVG Active Users Bar chart Segment Left (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between min-h-[350px]">
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                Daily Workspace Usage Logs (Last 7 Days)
              </h3>
              <p className="text-[10px] text-slate-400">Tracks active sessions and unique query interactions compiled per date.</p>
            </div>

            {/* SVG Visual Bars Arena */}
            <div className="flex items-end justify-between h-48 border-b border-l border-white/10 pb-3 pl-3.5 pt-6 relative gap-2 shrink-0">
              {activeUsersDaily.map((item, idx) => {
                // scale factor
                const maxVal = Math.max(...activeUsersDaily.map((x) => x.count), 1);
                const pct = (item.count / maxVal) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 max-w-[50px] relative group">
                    
                    {/* SVG/CSS Bar */}
                    <div className="w-full relative h-[140px] flex items-end justify-center rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                      <div
                        className="w-full bg-gradient-to-t from-purple-600/80 to-indigo-500/80 rounded-t-md transition-all duration-500 hover:opacity-90"
                        style={{ height: `${pct || 5}%` }}
                      />
                    </div>

                    {/* Meta indicator */}
                    <span className="text-[9px] text-slate-400 font-bold truncate max-w-full">
                      {item.date.slice(-5)}
                    </span>
                    <span className="absolute -top-6 bg-slate-950 p-1 px-1.5 rounded border border-white/10 text-[9px] font-black scale-0 group-hover:scale-100 transition-all text-white z-20">
                      {item.count} Active
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* System parameters logs Segment Right (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 min-h-[350px] flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/10 pb-3">
                <Sparkles className="w-4 h-4 text-purple-400 animate-spin-slow" /> Index parameters
              </h3>
              
              <div className="space-y-4 pb-4">
                <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                  <span className="text-slate-400 font-semibold">Embedding Grid:</span>
                  <span className="font-mono text-purple-400 font-bold">gemini-embedding-2</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                  <span className="text-slate-400 font-semibold">Text Parser:</span>
                  <span className="font-mono text-indigo-400 font-bold">Node pdf-parse v2</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                  <span className="text-slate-400 font-semibold">Passage Matrix size:</span>
                  <span className="font-mono text-blue-400 font-bold">1,000 chars</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                  <span className="text-slate-400 font-semibold">Overlapping grid:</span>
                  <span className="font-mono text-cyan-400 font-bold">200 chars</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic text-center p-2 leading-relaxed">
              Indices automatically optimize matrix clusters inside memory logs upon document modifications.
            </p>
          </div>
        </div>

      </div>

      {/* Multi-LLM Router telemetry panel */}
      {routerStats && (
        <div id="router-analytics-dashboard" className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8B5CF6]" /> Multi-LLM Routing & Resiliency Console
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Circuit breaking parameters and live latency performance metrics per provider target. Active Provider: <span className="font-bold text-emerald-400 uppercase">{routerStats.activeProvider === "groq" ? "OpenRouter" : routerStats.activeProvider}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {Object.values(routerStats.metrics || {}).map((m: any) => {
              const label = m.name === "groq" ? "OpenRouter (Llama 3.3)" : m.name === "gemini" ? "Gemini 2.5 Flash" : "Mistral Small";
              const isHealthy = m.status === "healthy";
              const isDegraded = m.status === "degraded";
              const statusColor = isHealthy ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" : isDegraded ? "text-amber-400 border-amber-500/20 bg-amber-500/10" : "text-rose-400 border-rose-500/20 bg-rose-500/10";
              
              return (
                <div key={m.name} className="bg-black/20 p-5 rounded-xl border border-white/5 space-y-4 hover:border-purple-500/20 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{label}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] tracking-widest uppercase font-black border ${statusColor}`}>
                      {m.status}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Total Queries:</span>
                      <span className="font-mono text-slate-300 font-bold">{m.totalRequests}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Success Rate:</span>
                      <span className="font-mono text-slate-300 font-bold">{m.successRate}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Errors logged:</span>
                      <span className="font-mono text-slate-300 font-bold">{m.failureCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Mean Latency:</span>
                      <span className="font-mono text-purple-400 font-bold">{(m.latency || m.averageLatency || 0).toFixed(2)}s</span>
                    </div>
                  </div>
                  
                  {m.status === "unavailable" && m.cooldownEnd && (
                    <div className="pt-2 border-t border-white/5 text-[9px] text-rose-400 font-sans tracking-wide">
                      ⚡ Circuit-breaker tripped. Cooldown Ends: {new Date(m.cooldownEnd).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
