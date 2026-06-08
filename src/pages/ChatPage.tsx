import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Info,
  ChevronRight,
  AlertCircle,
  Cpu,
  Database,
  Search,
  Calendar,
  X,
} from "lucide-react";
import { api } from "../services/api";
import { ChatSession, ChatMessage, Citation } from "../types";

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [inspectMessage, setInspectMessage] = useState<ChatMessage | null>(null);

  // Deletion workflows state
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState<string | null>(null);
  const [sessionToast, setSessionToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (sessionToast) {
      const timer = setTimeout(() => {
        setSessionToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [sessionToast]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat logs on entry
  useEffect(() => {
    async function loadSessions() {
      try {
        const history = await api.getHistory();
        setSessions(history);
        if (history.length > 0) {
          setActiveSessionId(history[0].id);
          setMessages(history[0].messages || []);
        }
      } catch (err) {
        console.error("Failed to fetch sessions history:", err);
      }
    }
    loadSessions();
  }, []);

  // Sync active messages
  useEffect(() => {
    if (activeSessionId) {
      const active = sessions.find((s) => s.id === activeSessionId);
      if (active) {
        setMessages(active.messages || []);
      }
    } else {
      setMessages([]);
    }
  }, [activeSessionId, sessions]);

  // Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create new session
  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
  };

  // Run messaging dispatch
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessageText = input.trim();
    setInput("");
    setLoading(true);

    // Create temporary optimistic message to enhance responsiveness
    const tempUserMsg: ChatMessage = {
      id: "optimistic-user-msg-id-" + Date.now(),
      role: "user",
      content: userMessageText,
      timestamp: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const result = await api.sendMessage(userMessageText, activeSessionId || undefined);
      
      // Update historical sessions
      const updatedSessions = await api.getHistory();
      setSessions(updatedSessions);
      setActiveSessionId(result.sessionId);
      window.dispatchEvent(new Event("limits-updated"));
    } catch (err) {
      console.error("Express RAG pipeline transfer error:", err);
      // Append temporary failure notification
      const tempErrorMsg: ChatMessage = {
        id: "optimistic-err-msg-id-" + Date.now(),
        role: "assistant",
        content: "⚠️ Failed to transmit query to RAG server. Please confirm your local backend is booted and check console log streams.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempErrorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Trigger deletion modal
  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmDeleteModal(id);
  };

  // Execute actual deletion
  const executeDeleteSession = async (id: string) => {
    setDeletingSessionId(id);
    try {
      await api.deleteSession(id);
      
      // Update local state immediately without refresh
      const filtered = sessions.filter((s) => s.id !== id);
      setSessions(filtered);
      
      if (activeSessionId === id) {
        if (filtered.length > 0) {
          setActiveSessionId(filtered[0].id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
      
      setSessionToast({ type: "success", message: "Conversation deleted successfully." });
      setShowConfirmDeleteModal(null);
    } catch (err) {
      console.error("Delete session error:", err);
      setSessionToast({ type: "error", message: "Unable to delete conversation." });
    } finally {
      setDeletingSessionId(null);
    }
  };

  // Clipboard copies
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-[#020617] relative select-none">
      
      {/* Dynamic blurred blobs */}
      <div className="absolute top-[25%] left-[20%] w-[450px] h-[450px] rounded-full aurora-blob-1 opacity-20 -z-10" />

      {/* Embedded Left Collapsible Sessions sidebar */}
      <div className="w-68 border-r border-white/10 bg-white/5 backdrop-blur-md hidden md:flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-white/10 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:bg-white/10 transition-all cursor-pointer shadow-md group animate-fade-in"
          >
            <Plus className="w-4 h-4 text-purple-400 group-hover:rotate-90 transition-transform" /> New Research Chat
          </button>
        </div>

        {/* Sessions list log */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
          {sessions.length === 0 ? (
            <div className="text-center p-6 text-slate-500 mt-12 space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-[10px] uppercase tracking-wider font-semibold">No recent chats</p>
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border group text-left ${
                    isActive
                      ? "bg-white/10 border-white/10 text-white font-semibold"
                      : "bg-transparent border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-purple-400" : ""}`} />
                    <span className="text-xs font-medium truncate tracking-wide">{session.title}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteClick(session.id, e)}
                    disabled={deletingSessionId === session.id}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {deletingSessionId === session.id ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main chat viewport frame */}
      <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden">
        
        {/* Topic Banner */}
        <div className="px-6 py-4.5 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex md:hidden items-center text-xs font-bold text-slate-300 gap-1.5 p-1 rounded-lg bg-white/5 border border-white/10 cursor-pointer" onClick={handleNewChat}>
              <Plus className="w-3.5 h-3.5" /> New
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                {activeSessionId ? "Active Research Workspace" : "Workspace Intelligence"}
              </h2>
              <p className="text-[10px] text-slate-450 mt-0.5">
                Powered by Google Gemini 3.5 RAG model for context queries.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-[9px] text-[#8B5CF6] font-bold border border-purple-500/20 uppercase tracking-widest">
              Semantic RAG Active
            </span>
          </div>
        </div>

        {/* Messaging Area container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {messages.length === 0 ? (
            /* Splash Initial chat prompts */
            <div className="max-w-2xl mx-auto py-12 text-center space-y-8 mt-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-lg shadow-purple-500/5">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-2.5">
                <h3 className="font-extrabold text-white text-xl sm:text-2xl tracking-tight">Ask your Document Corpus</h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Start conversing with uploaded documents. Ask complex cross-document questions and receive instant answers with direct page link references.
                </p>
              </div>

              {/* Sample Quickprompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left">
                <button
                  onClick={() => setInput("What are the key themes and overall findings of this report?")}
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-between"
                >
                  <span>Summarize major findings</span> <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                </button>
                <button
                  onClick={() => setInput("Are there any statistics, percentages, or core figures in these files?")}
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-between"
                >
                  <span>Extract metrics and statistics</span> <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                </button>
              </div>
            </div>
          ) : (
            /* Render Message bubbles */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    {/* Bubble Content Layout */}
                    <div
                      className={`max-w-[85%] rounded-2xl p-4.5 border shadow-md relative ${
                        isUser
                          ? "bg-gradient-to-tr from-[#8B5CF6] to-[#6366F1] text-white border-white/15 rounded-tr-none shadow-purple-500/10"
                          : "bg-white/5 text-slate-200 border-white/10 rounded-tl-none"
                      }`}
                    >
                      {/* Copy Clip operation trigger */}
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="absolute top-3.5 right-3.5 p-1 rounded bg-slate-900/60 text-slate-400 hover:text-white transition-all cursor-pointer"
                        >
                          {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}

                      {/* Msg formatted Text */}
                      <div className="markdown-body pr-4 overflow-x-auto select-text selection:bg-purple-500/30">
                        {/* A very robust formatted bullet and paragraph highlights renderer */}
                        {msg.content.split("\n\n").map((para, pIdx) => {
                          if (para.startsWith("- ") || para.startsWith("* ")) {
                            return (
                              <ul key={pIdx} className="list-disc pl-5 my-2 space-y-1">
                                {para.split("\n").map((li, lIdx) => (
                                  <li key={lIdx}>{li.replace(/^[-*]\s+/, "")}</li>
                                ))}
                              </ul>
                            );
                          }
                          return <p key={pIdx}>{para}</p>;
                        })}
                      </div>

                      {/* Subtle engine badge */}
                      {!isUser && msg.provider && msg.provider !== "system" && (
                        <div id={`provider-badge-${msg.id}`} className="mt-3 flex items-center gap-1.5 text-[9px] text-[#A7F3D0] uppercase tracking-widest font-bold select-none">
                          <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                          Powered by {msg.provider === "groq" ? "OpenRouter" : msg.provider.charAt(0).toUpperCase() + msg.provider.slice(1)}
                        </div>
                      )}

                      {/* Citations block */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-5 pt-3.5 border-t border-slate-800/40 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1">
                              <BookOpen className="w-3 h-3" /> Grounded Source References
                            </span>
                            <button
                              onClick={() => setInspectMessage(msg)}
                              className="text-[9px] font-bold text-amber-400 hover:text-amber-300 uppercase tracking-widest flex items-center gap-1.5 px-2 py-1 rounded bg-[#FBBF24]/5 border border-[#FBBF24]/20 hover:bg-[#FBBF24]/10 transition-all cursor-pointer"
                            >
                              <Search className="w-2.5 h-2.5 text-amber-400" /> Inspect Retrieval
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              const groups: Record<string, { filename: string; pages: number[]; count: number; citations: any[] }> = {};
                              for (const cite of msg.citations) {
                                if (!groups[cite.filename]) {
                                  groups[cite.filename] = {
                                    filename: cite.filename,
                                    pages: [],
                                    count: 0,
                                    citations: []
                                  };
                                }
                                groups[cite.filename].citations.push(cite);
                                groups[cite.filename].count += 1;
                                if (cite.pageNumber && !groups[cite.filename].pages.includes(cite.pageNumber)) {
                                  groups[cite.filename].pages.push(cite.pageNumber);
                                }
                              }
                              return Object.values(groups).map((group, groupIdx) => (
                                <button
                                  key={groupIdx}
                                  onClick={() => setActiveCitation(group.citations[0])}
                                  className="p-2 px-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-purple-500/30 text-left text-[11px] hover:text-white cursor-pointer transition-all flex flex-col gap-1 w-full max-w-[220px]"
                                >
                                  <div className="flex items-center justify-between gap-2 w-full">
                                    <span className="font-semibold truncate text-slate-300 block max-w-[120px]" title={group.filename}>
                                      {group.filename}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-[9px] text-purple-400 shrink-0 whitespace-nowrap">
                                      {group.count} citation{group.count !== 1 ? "s" : ""}
                                    </span>
                                  </div>
                                  {group.pages.length > 0 && (
                                    <span className="text-[10px] text-slate-450 truncate block w-full">
                                      Pages: {group.pages.sort((a, b) => a - b).join(", ")}
                                    </span>
                                  )}
                                </button>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="text-[9px] text-slate-500 mt-1.5 font-medium px-2">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Typing Loading Indicator animation */}
          {loading && (
            <div className="max-w-3xl mx-auto flex items-start gap-3 pl-4">
              <div className="glass-panel p-4 rounded-2xl rounded-tl-none border-slate-800/60 flex items-center gap-2 shadow-inner">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-100" />
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce delay-200" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-2">RAG engine resolving matrices...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Frame form */}
        <div className="p-5 border-t border-white/10 bg-white/5 shrink-0">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about document summary, timelines, statistics, or custom query definitions..."
              className="glass-input w-full pl-5 pr-14 py-4 rounded-2xl text-sm border-white/10"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white disabled:opacity-30 disabled:hover:bg-[#8B5CF6] flex items-center justify-center cursor-pointer transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="max-w-3xl mx-auto mt-2 text-center">
            <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <Info className="w-3 h-3" /> Chat responses are fully cited first, avoiding hallucination by referencing loaded text block contexts exclusively.
            </p>
          </div>
        </div>

      </div>

      {/* Citation text block inspection modal overlay */}
      {activeCitation && (
        <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-fade-in select-text">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 w-full max-w-lg flex flex-col max-h-[80vh] shadow-2xl relative select-text">
            <h3 className="text-sm font-bold text-white tracking-wide uppercase mb-1">Passage Citation Analysis</h3>
            <p className="text-[10px] text-slate-400 mb-4">{activeCitation.filename} • Page {activeCitation.pageNumber}</p>
            
            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-slate-900/60 border border-slate-850 text-xs text-slate-300 leading-relaxed max-h-[350px]">
              {activeCitation.text}
            </div>

            <button
              onClick={() => setActiveCitation(null)}
              className="mt-5 w-full py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 hover:text-white font-bold cursor-pointer hover:bg-slate-850 transition-all text-center"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Requirement 9: Retrieval Inspector panel */}
      {inspectMessage && (
        <div className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 animate-fade-in select-text">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 w-full max-w-4xl flex flex-col max-h-[90vh] shadow-2xl relative select-text">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                  <Cpu className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">RAG Retrieval Inspector</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Analyzing active semantic vectors inside single shared collection: <span className="font-mono text-amber-400">research_documents</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectMessage(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-450 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Core Scrollable */}
            <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-1 scrollbar-thin">
              
              {/* Question summary / Query context */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                  <Search className="w-3.5 h-3.5" /> User Query Vector
                </span>
                <p className="text-xs text-slate-200 font-medium italic select-text leading-relaxed">
                  "{inspectMessage.content}"
                </p>
              </div>

              {/* Stat highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Vector Collection</div>
                  <div className="text-xs font-bold text-slate-255 flex items-center justify-center gap-1">
                    <Database className="w-3.5 h-3.5 text-indigo-400" /> research_documents
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Retrieved Chunks depth (k)</div>
                  <div className="text-xs font-bold text-slate-255 font-mono">
                    k = {inspectMessage.citations?.length || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Top Similarity Score</div>
                  <div className="text-xs font-bold text-emerald-400 font-mono">
                    {inspectMessage.citations && inspectMessage.citations.length > 0
                      ? (inspectMessage.citations[0].similarity?.toFixed(4) || "0.0000")
                      : "0.0000"}
                  </div>
                </div>
              </div>

              {/* Chunks List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Retrieved Fragment Rank Ordering</h4>
                
                <div className="space-y-3.5">
                  {inspectMessage.citations?.map((cite, index) => {
                    const similarity = cite.similarity ?? 0;
                    return (
                      <div
                        key={index}
                        className="p-4.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/15 transition-all space-y-3 relative overflow-hidden group select-text"
                      >
                        {/* Match Progress indicator line overlay */}
                        <div
                          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-amber-500 to-amber-400 transition-all"
                          style={{ width: `${Math.min(similarity * 100, 100)}%` }}
                        />

                        {/* Top layout */}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] border-b border-white/5 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] rounded font-extrabold uppercase select-none">
                              Rank #{index + 1}
                            </span>
                            <span className="font-bold text-slate-200 max-w-[200px] truncate">{cite.filename}</span>
                            <span className="text-slate-500 font-medium font-mono">• Page {cite.pageNumber}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-emerald-400 font-mono text-[11px] bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                              Similarity Score: {similarity.toFixed(4)}
                            </span>
                          </div>
                        </div>

                        {/* Passage text block */}
                        <div className="text-xs text-slate-300 leading-relaxed font-normal bg-slate-950/40 p-3 rounded-xl border border-white/5 select-text overflow-x-auto max-h-40 scrollbar-thin">
                          "{cite.text}"
                        </div>

                        {/* Bottom Metadata detail panel */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px] text-slate-500 font-semibold pt-1 border-t border-white/5 uppercase tracking-wider font-mono select-none">
                          <div className="flex items-center gap-1">
                            <span className="font-extrabold text-slate-450 shrink-0">Chunk ID:</span>
                            <span className="truncate">{cite.chunkId || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-1 sm:justify-end">
                            <Calendar className="w-2.5 h-2.5 text-slate-500" />
                            <span className="font-extrabold text-slate-450 shrink-0">Indexed:</span>
                            <span>
                              {cite.uploadDate ? new Date(cite.uploadDate).toLocaleString() : "N/A"}
                            </span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-white/10 shrink-0">
              <button
                onClick={() => setInspectMessage(null)}
                className="w-full py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 hover:text-white font-bold cursor-pointer hover:bg-slate-850 transition-all text-center"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Requirement 6: Delete Conversation Confirmation Modal */}
      {showConfirmDeleteModal && (
        <div className="fixed inset-0 min-h-screen bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0f172a] border border-white/10 p-6 rounded-2xl w-full max-w-sm space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-600"></div>
            
            <div className="space-y-2 text-center sm:text-left">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" /> Delete Conversation?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This will permanently remove the conversation and all associated messages.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setShowConfirmDeleteModal(null)}
                disabled={deletingSessionId !== null}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDeleteSession(showConfirmDeleteModal)}
                disabled={deletingSessionId !== null}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deletingSessionId !== null ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 8 & 9: Success/Error Toast Notification */}
      {sessionToast && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl border flex items-center gap-2.5 z-50 animate-fade-in min-w-[280px] max-w-sm transition-all duration-300 ${
          sessionToast.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
        }`}>
          {sessionToast.type === "success" ? (
            <Check className="w-4 h-4 shrink-0 bg-emerald-500/20 p-0.5 rounded-full" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 bg-rose-500/20 p-0.5 rounded-full" />
          )}
          <span className="text-xs font-bold tracking-wide">{sessionToast.message}</span>
        </div>
      )}

    </div>
  );
}
