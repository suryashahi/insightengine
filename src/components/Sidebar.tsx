import React, { useState, useEffect } from "react";
import {
  FileText,
  MessageSquare,
  Search,
  BookOpen,
  BarChart3,
  Settings,
  ShieldAlert,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import { User } from "../types";
import { api } from "../services/api";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  collapsed,
  setCollapsed,
  mobileMenuOpen,
  setMobileMenuOpen,
}: SidebarProps) {
  const [limits, setLimits] = useState<{
    documentsUsed: number;
    documentsMax: number;
    storageUsedBytes: number;
    storageUsedMB: number;
    storageMaxMB: number;
    creditsUsed: number;
    creditsMax: number;
    creditsRemaining: number;
    semanticQueriesUsed: number;
    semanticQueriesMax: number;
    deepSearchesUsed: number;
    deepSearchesMax: number;
    providerUsagePercent: number;
    isReadOnly: boolean;
  } | null>(null);

  const fetchLimits = () => {
    if (user) {
      api.getLimits()
        .then((data) => {
          setLimits(data);
        })
        .catch((err) => {
          console.error("Sidebar limits fetch failed:", err);
        });
    }
  };

  useEffect(() => {
    fetchLimits();
  }, [user, activeTab]);

  useEffect(() => {
    window.addEventListener("limits-updated", fetchLimits);
    return () => {
      window.removeEventListener("limits-updated", fetchLimits);
    };
  }, [user]);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "chat", label: "Semantic Chat", icon: MessageSquare },
    { id: "documents", label: "My Documents", icon: FileText },
    { id: "search", label: "Deep Search", icon: Search },
    { id: "utilities", label: "Study Tools", icon: BookOpen },
    { id: "analytics", label: "Usage Insight", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  if (user && user.role === "admin") {
    menuItems.push({ id: "admin", label: "Admin Panel", icon: ShieldAlert });
  }

  return (
    <>
      {/* Mobile Sidebar Overlay Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileMenuOpen?.(false)}
        />
      )}

      <aside
        className={`bg-[#060a1d] md:bg-white/5 md:backdrop-blur-2xl flex flex-col h-screen transition-all duration-300 ease-in-out border-r border-white/10 z-40 md:z-30 shrink-0
          fixed md:relative top-0 bottom-0 left-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${collapsed ? "w-20" : "w-64"}
        `}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-gradient-to-tr from-[#8B5CF6] via-[#6366F1] to-[#06B6D4] rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 shrink-0 relative animate-pulse">
              <div className="absolute inset-0 bg-purple-500/20 blur-md rounded-xl animate-ping opacity-60"></div>
              <Sparkles className="w-5 h-5 text-white relative z-10" />
            </div>
            {(!collapsed || mobileMenuOpen) && (
              <div className="flex flex-col select-none">
                <span className="font-sans font-black text-base tracking-tight text-white leading-none">
                  InsightEngine
                </span>
                <span className="text-[8px] font-bold tracking-widest text-cyan-400 mt-1 uppercase">
                  AI Research Workspace
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer hidden md:block"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          
          {/* Mobile Close/Slide Chevron dismiss Button */}
          <button
            onClick={() => setMobileMenuOpen?.(false)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer md:hidden"
            aria-label="Close menu"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

      {/* User Information Minimal */}
      {(!collapsed || mobileMenuOpen) && user && (
        <div className="mx-4 mt-5 p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-purple-400 border border-white/10 uppercase">
            {user.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-slate-100 line-clamp-1">{user.name}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">{user.role}</p>
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer text-left select-none group relative ${
                isActive
                  ? "bg-white/10 border border-white/10 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-200 group-hover:scale-105 shrink-0 ${
                  isActive ? "text-purple-400" : "text-slate-400 group-hover:text-slate-300"
                }`}
              />
              {(!collapsed || mobileMenuOpen) && <span className="text-sm font-medium tracking-tight">{item.label}</span>}
              
              {/* Desktop tooltips when sidebar is collapsed */}
              {collapsed && !mobileMenuOpen && (
                <div className="absolute left-22 scale-0 group-hover:scale-100 bg-[#020617] text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-white/10 pointer-events-none transition-all duration-150 shadow-xl whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Research Usage Widget */}
      {(!collapsed || mobileMenuOpen) && limits && (
        <div className="p-4 mx-4 mb-2 shrink-0 space-y-3">
          <div className="bg-white/5 p-4 rounded-[24px] border border-white/10 flex flex-col gap-3">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest leading-none">Research Usage</p>
            
            {/* Documents limit */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] leading-tight">
                <span className="text-slate-400">Documents</span>
                <span className="text-slate-200 font-medium">{limits.documentsUsed} / {limits.documentsMax}</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (limits.documentsUsed / limits.documentsMax) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Storage limit */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] leading-tight">
                <span className="text-slate-400">Storage</span>
                <span className="text-slate-200 font-medium">{limits.storageUsedMB} MB / {limits.storageMaxMB} MB</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (limits.storageUsedMB / limits.storageMaxMB) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Credits limit */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] leading-tight">
                <span className="text-slate-400">Credits Remaining</span>
                <span className="text-slate-200 font-medium">{limits.creditsRemaining} / {limits.creditsMax}</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (limits.creditsRemaining / limits.creditsMax) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* AI Capacity Warnings */}
            {limits.providerUsagePercent > 0 && (
              <div className="mt-1 pt-2 border-t border-white/5 flex flex-col gap-1 select-none">
                <div className="flex justify-between text-[9px] uppercase tracking-wider font-extrabold leading-none">
                  <span className="text-cyan-400">AI Capacity Status</span>
                  <span className={limits.isReadOnly ? "text-rose-450" : limits.providerUsagePercent > 80 ? "text-amber-450" : "text-emerald-450"}>
                    {limits.isReadOnly ? "READ-ONLY" : `${Math.round(limits.providerUsagePercent)}%`}
                  </span>
                </div>
                {limits.providerUsagePercent >= 100 ? (
                  <div className="p-1 px-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[8px] text-rose-300 leading-normal font-medium text-center">
                    Capacity reached. Read-only.
                  </div>
                ) : limits.providerUsagePercent >= 80 ? (
                  <div className="p-1 px-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[8px] text-amber-300 leading-normal font-medium text-center">
                    Restricted searches mode.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout Action */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent transition-all duration-200 cursor-pointer text-left group"
        >
          <LogOut className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          {(!collapsed || mobileMenuOpen) && <span className="text-sm font-semibold tracking-tight">Sign Out</span>}
        </button>
      </div>
    </aside>
  </>
);
}
