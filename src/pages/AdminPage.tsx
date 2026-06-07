import React, { useEffect, useState } from "react";
import { ShieldAlert, Trash2, Users, FileText, Settings, Sparkles, MessageSquare, Database, Server, BarChart3, AlertTriangle } from "lucide-react";
import { api } from "../services/api";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface FileLog {
  id: string;
  filename: string;
  mimeType: string;
  userId: string;
}

interface ChatLog {
  id: string;
  userId: string;
  query: string;
  timestamp: string;
}

interface AdminAnalytics {
  activeUsersCount: number;
  documentsUploadedCount: number;
  storageUsedBytes: number;
  semanticSearchesToday: number;
  deepSearchesToday: number;
  groqUsage: number;
  mixtralUsage: number;
  quotaRemainingPercent: number;
  providerUsagePercent: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [files, setFiles] = useState<FileLog[]>([]);
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [simPercent, setSimPercent] = useState<number>(45);
  const [updatingSim, setUpdatingSim] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const userList = await api.adminGetUsers();
      const fileList = await api.adminGetDocuments();
      const logList = await api.adminGetChatLogs();
      const stats = await api.adminGetAnalytics();

      setUsers(userList);
      setFiles(fileList);
      setLogs(logList);
      setAnalytics(stats);
      setSimPercent(stats.providerUsagePercent);
    } catch (err: any) {
      console.error("Admin data loading failed:", err);
      setError("Admin privileges required but server access was denied.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSimulateCapacity = async () => {
    setUpdatingSim(true);
    try {
      await api.adminUpdateProviderUsage(simPercent);
      const stats = await api.adminGetAnalytics();
      setAnalytics(stats);
      window.dispatchEvent(new Event("limits-updated"));
    } catch (err: any) {
      alert("Simulate provider capacity error: " + err.message);
    } finally {
      setUpdatingSim(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user profile? This will delete all their documents, semantic vector chunk indexes, and private chats permanently.")) return;
    try {
      await api.adminDeleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to finalize user deletion.");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-purple-600 animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Assembling Admin telemetry metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-sm mx-auto">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Access Restrained</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          The selected workspace tab is restricted to System Admins. Access credentials logged down.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 select-none max-w-7xl mx-auto w-full">
      {/* Structural greeting header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
          Admin Console <ShieldAlert className="w-5 h-5 text-purple-400 animate-pulse" />
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Supervise register indices, file ingestion logs, database corpus volumes, and system-wide queries securely.
        </p>
      </div>

      {/* Dynamic Telemetry Metrics Cards Grid */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 select-none">
          {/* Card 1: Active Users */}
          <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10 flex flex-col gap-1 relative overflow-hidden group hover:border-[#8B5CF6]/30 transition-all">
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-[#8B5CF6]/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider select-none">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Active Users</span>
            </div>
            <span className="text-3xl font-black text-white mt-3">{analytics.activeUsersCount}</span>
            <span className="text-[10px] text-cyan-455 mt-1">Total registered users</span>
          </div>

          {/* Card 2: Documents Ingested & Storage */}
          <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10 flex flex-col gap-1 relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-blue-500/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider">
              <FileText className="w-4 h-4 text-blue-450" />
              <span>Documents Ingested</span>
            </div>
            <span className="text-2xl font-black text-white mt-3 truncate">
              {analytics.documentsUploadedCount} <span className="text-xs text-slate-400 font-normal">({(analytics.storageUsedBytes / (1024 * 1024)).toFixed(1)} MB)</span>
            </span>
            <span className="text-[10px] text-indigo-400 mt-1">Total database storage</span>
          </div>

          {/* Card 3: Ingestion Searches */}
          <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10 flex flex-col gap-1 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider">
              <BarChart3 className="w-4 h-4 text-emerald-450" />
              <span>Searches Today</span>
            </div>
            <span className="text-3xl font-black text-white mt-3">
              {analytics.semanticSearchesToday + analytics.deepSearchesToday}
            </span>
            <span className="text-[10px] text-emerald-400 mt-1">
              {analytics.semanticSearchesToday} Semantic • {analytics.deepSearchesToday} Deep
            </span>
          </div>

          {/* Card 4: AI Platform capacity warnings */}
          <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10 flex flex-col gap-1 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-400/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider">
              <Server className="w-4 h-4 text-cyan-455" />
              <span>Remaining Quota</span>
            </div>
            <span className={`text-3xl font-black mt-3 ${analytics.providerUsagePercent >= 100 ? "text-rose-450 animate-pulse" : analytics.providerUsagePercent >= 80 ? "text-amber-450" : "text-white"}`}>
              {analytics.quotaRemainingPercent.toFixed(0)}%
            </span>
            <span className="text-[10px] text-slate-400 mt-1 truncate">
              Groq: {analytics.groqUsage} • Mistral: {analytics.mixtralUsage}
            </span>
          </div>
        </div>
      )}

      {/* Emergency Protection Dashboard Simulation Block */}
      {analytics && (
        <div className="bg-white/5 p-6 rounded-[28px] border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                Emergency Protection Simulator <Settings className="w-4 h-4 text-purple-400 animate-spin" />
              </h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-normal">
                Simulate automatic model load thresholds. Drag the simulation slider to adjust simulated capacity loads, then hit "Simulate Capacity" to lock in platform rules in real time.
              </p>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 min-w-[320px] justify-between">
              <span className={`text-2xl font-black tracking-tight shrink-0 select-none ${simPercent >= 100 ? "text-rose-450 animate-pulse" : simPercent >= 80 ? "text-amber-440" : "text-cyan-400"}`}>
                {simPercent}%
              </span>
              <input 
                type="range"
                min="0"
                max="100"
                value={simPercent}
                onChange={(e) => setSimPercent(Number(e.target.value))}
                className="flex-1 accent-purple-500 cursor-pointer h-1 rounded-full bg-slate-800"
              />
              <button
                onClick={handleSimulateCapacity}
                disabled={updatingSim}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs text-white font-extrabold shadow-md hover:shadow-purple-500/20 active:scale-[0.98] transition-all cursor-pointer shrink-0"
              >
                {updatingSim ? "Updating..." : "Simulate Capacity"}
              </button>
            </div>
          </div>

          {/* Quick Info Alerts depending on current percent */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-[11px] leading-relaxed select-none">
            <div className={`p-3.5 rounded-2xl border transition-colors ${simPercent < 60 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-white/5 border-white/5 text-slate-500"}`}>
              <span className="font-bold block text-slate-200 mb-0.5">0% - 60% Load</span>
              Normal operation. Automatic limits up to 20 semantic searches per day.
            </div>
            <div className={`p-3.5 rounded-2xl border transition-colors ${simPercent >= 60 && simPercent < 80 ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-white/5 border-white/5 text-slate-500"}`}>
              <span className="font-bold block text-slate-200 mb-0.5">60% - 80% Load (Warning)</span>
              Platform alerts warning messages displayed to systems administrators immediately.
            </div>
            <div className={`p-3.5 rounded-2xl border transition-colors ${simPercent >= 80 && simPercent < 90 ? "bg-amber-500/10 border-amber-500/25 text-amber-300 font-medium" : "bg-white/5 border-white/5 text-slate-500"}`}>
              <span className="font-bold block text-slate-200 mb-0.5">80% - 90% Load (Throttle)</span>
              Automatic limit throttling. Semantic search limits capped from 20 to 15 queries daily.
            </div>
            <div className={`p-3.5 rounded-2xl border transition-colors ${simPercent >= 90 && simPercent < 100 ? "bg-amber-500/10 border-amber-500/25 text-amber-300" : simPercent >= 100 ? "bg-rose-500/10 border-rose-500/25 text-rose-300" : "bg-white/5 border-white/5 text-slate-500"}`}>
              <span className="font-bold block text-slate-200 mb-0.5">90% - 100% Load (Block)</span>
              {simPercent >= 100 ? "100% Read-Only mode. All uploads blocked. Existing workspace is read-only." : "Extreme load. Credits restricted to 10 semantic queries daily."}
            </div>
          </div>
        </div>
      )}

      {/* Primary Users segment table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Users panel */}
        <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 opacity-20"></div>
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Users className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Registered User Accounts ({users.length})</h3>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/15 transition-all gap-4"
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-purple-400 uppercase text-xs shrink-0 select-none">
                    {u.name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-100 truncate pr-2">{u.name}</p>
                    <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest">{u.email} • {u.role}</p>
                  </div>
                </div>

                <button
                  disabled={u.role === "admin"}
                  onClick={() => handleDeleteUser(u.id)}
                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-450 hover:bg-rose-500/20 border border-transparent hover:border-rose-500/20 transition-all disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Global Files table */}
        <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-20"></div>
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <FileText className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Global Ingestion Index ({files.length})</h3>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
            {files.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-10">No indexed documents currently in the entire database.</p>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-205 transition-all hover:border-white/10"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="overflow-hidden">
                      <span className="font-bold text-slate-100 truncate block pr-2">{file.filename}</span>
                      <span className="text-[9px] text-slate-455 font-bold block uppercase tracking-widest mt-0.5">Owner user ID: {file.userId}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Global Activity log terminal */}
      <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8B5CF6]/30 to-transparent"></div>
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Recent Lexical & Vector Searches Logs ({logs.length})</h3>
        </div>

        <div className="space-y-2 rounded-xl bg-slate-950/40 p-4 border border-white/10 font-mono text-[11px] text-slate-400 max-h-[200px] overflow-y-auto scrollbar-thin">
          {logs.length === 0 ? (
            <p className="text-slate-650 italic">No search events are captured currently inside telemetry channels.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-1 text-slate-400 hover:text-white transition-colors">
                <span className="truncate flex-1">
                  [QUERY LOG] User {log.userId.slice(0, 8)} searched: <span className="text-cyan-455 font-bold">"{log.query}"</span>
                </span>
                <span className="text-slate-500 shrink-0 text-[10px]">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
