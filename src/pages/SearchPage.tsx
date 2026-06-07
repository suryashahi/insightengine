import React, { useState } from "react";
import { Search, FileText, Sparkles, Filter, ChevronRight, Compass } from "lucide-react";
import { api } from "../services/api";
import { SearchResult } from "../types";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const resp = await api.searchAcrossDocs(query.trim());
      setResults(resp);
      window.dispatchEvent(new Event("limits-updated"));
    } catch (err: any) {
      console.error("Express semantic query search failed:", err);
      setError("Semantic search index took too long to compile or is disabled.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to highlight matching user search terms inside extracted chunks
  const getHighlightedText = (text: string, highlight: string) => {
    const parts = highlight.toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return text;

    let regexStr = parts.map((term) => term.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|");
    let regex = new RegExp(`(${regexStr})`, "gi");

    const segments = text.split(regex);
    return (
      <>
        {segments.map((segment, idx) =>
          regex.test(segment) ? (
            <mark key={idx} className="bg-purple-500/30 text-white font-medium p-0.5 rounded px-1 selection:bg-purple-500/20">
              {segment}
            </mark>
          ) : (
            segment
          )
        )}
      </>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 select-none max-w-7xl mx-auto w-full">
      {/* Visual greeting headings */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
          Deep Semantic Retrieval <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Run high-precision query scans across your entire corpus. Combines vector proximity analysis with lexical keyword weights to pinpoint passages.
        </p>
      </div>

      {/* Input query field panel */}
      <form onSubmit={handleSearch} className="bg-white/5 backdrop-blur-lg p-6 rounded-[28px] border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8B5CF6]/35 to-transparent"></div>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Query any insights, e.g., 'What are the main target outcomes described in Section 4?'"
              className="glass-input w-full pl-11 pr-4 py-3.5 rounded-xl text-xs sm:text-sm border-white/10"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide glass-button-primary disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-purple-500/20"
          >
            {loading ? <div className="w-4 h-4 rounded-full border-2 border-slate-350 border-t-purple-600 animate-spin" /> : "Semantic Scan"}
          </button>
        </div>
      </form>

      {/* Results viewport panel */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3.5">
            <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-purple-600 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Pinpointing cosine metrics across matching coordinate matrices...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-semibold">
            {error}
          </div>
        ) : !hasSearched ? (
          /* Search teaser placeholder block */
          <div className="text-center p-16 py-20 space-y-4 max-w-sm mx-auto">
            <Compass className="w-12 h-12 text-slate-700 mx-auto animate-spin-slow" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-300">Discover Grounded Paragraphs</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Submit an inquiry above. We scan embeddings of all text blocks and retrieve the top matching segments with exact highlights.
              </p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center p-16 py-20 space-y-2">
            <Filter className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">No matching text blocks found</p>
            <p className="text-xs text-slate-400">Try modifying your query tags or confirm that documents exist in your Corpus.</p>
          </div>
        ) : (
          /* Listing search cards matches */
          <div className="space-y-4.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Grounded Clues Pinpointed ({results.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {results.map((item, idx) => {
                const percentage = Math.round(item.score * 100);
                return (
                  <div
                    key={idx}
                    className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-4 hover:border-white/25 hover:bg-white/10 transition-all flex flex-col justify-between"
                  >
                    {/* Card heading info metrics */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-100 truncate pr-2">{item.filename}</span>
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded font-bold text-[9px] text-purple-400 shrink-0 uppercase tracking-widest">
                          Page {item.pageNumber}
                        </span>
                      </div>
                      
                      {/* Metric Match Bar */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Semantic Score:</span>
                        <div className="w-16 h-1.5 bg-white/5 rounded-full border border-white/10 overflow-hidden">
                           <div
                            className="bg-[#8B5CF6] h-full rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-purple-400">{percentage}%</span>
                      </div>
                    </div>

                    {/* Extracted context text block passage */}
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed selection:bg-purple-500/20 select-text font-serif">
                      "{getHighlightedText(item.text, query)}"
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
