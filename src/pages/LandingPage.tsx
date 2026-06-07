import React from "react";
import { Sparkles, FileText, Bot, BrainCircuit, Search, ArrowRight, Shield, Zap } from "lucide-react";

interface LandingPageProps {
  onGetStarted: () => void;
  onLiveDemo: () => void;
}

export default function LandingPage({ onGetStarted, onLiveDemo }: LandingPageProps) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#020617] text-slate-100 font-sans select-none">
      
      {/* Decorative Aura Blobs */}
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full aurora-blob-1 -z-10" />
      <div className="absolute top-[40%] right-[15%] w-[600px] h-[600px] rounded-full aurora-blob-2 -z-10" />
      <div className="absolute bottom-[-10%] left-[30%] w-[550px] h-[550px] rounded-full aurora-blob-3 -z-10" />

      {/* Header Bar */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <span className="font-sans font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            AI Research Assistant
          </span>
        </div>
        <div>
          <button
            onClick={onGetStarted}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-900/60 transition-all cursor-pointer shadow-md"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 max-w-5xl mx-auto py-12 md:py-20">
        
        {/* Floating Accent Capsule */}
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold tracking-wider uppercase mb-8 shadow-inner animate-bounce duration-1000">
          <Bot className="w-3.5 h-3.5 animate-spin" /> Next-Gen RAG Intelligence
        </div>

        {/* Display Typography */}
        <h1 className="font-sans font-extrabold text-4xl sm:text-6xl md:text-7xl tracking-tighter text-white leading-[1.08] mb-6">
          Intelligence For <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400">
            Your Documents
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl text-base sm:text-xl text-slate-400 leading-relaxed font-normal mb-10 px-4">
          Upload PDFs, DOCX, and TXT files. Instantly chat, retrieve precise citations, compile key outlines, generate flashcards, and run quiz checkouts with state-of-the-art Google Gemini AI.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-md px-6">
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold tracking-wide glass-button-primary flex items-center justify-center gap-2.5 cursor-pointer text-base"
          >
            Get Started Free <ArrowRight className="w-5 h-5 animate-pulse" />
          </button>
          
          <button
            onClick={onLiveDemo}
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold tracking-wide bg-slate-900/50 hover:bg-slate-900/80 text-white border border-slate-800/80 hover:border-slate-700/80 transition-all cursor-pointer flex items-center justify-center gap-2.5 backdrop-blur-md"
          >
            Live Guest Demo <Zap className="w-4 h-4 text-amber-400" />
          </button>
        </div>

        {/* Core Capabilities Teaser Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full mt-24 pt-12 border-t border-slate-900/60 text-left">
          
          <div className="glass-panel p-6 rounded-2xl border border-slate-800/40 relative group overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-5">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Smart Ingestion</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Accept drag-and-drop PDFs, DOCX, and text. Extracts, sanitizes, and overlaps semantic vectors.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800/40 relative group overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
              <BrainCircuit className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Semantic RAG Chat</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-doc grounded chat answering exclusively from target items. Features source citations.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800/40 relative group overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5">
              <Search className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Pro Grounded Search</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Global lookup across all items combining vector search metrics with lexical matching scores.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800/40 relative group overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-teal-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Study Summaries</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Generate robust executive logs, structured summaries, cards, and adaptive multiple-choice quizzes.
            </p>
          </div>

        </div>

      </main>

      {/* Footer copyright */}
      <footer className="relative z-10 py-8 border-t border-slate-900/50 text-center text-xs text-slate-500 tracking-wide mt-12 shrink-0">
        <div className="max-w-7xl w-full mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 AI Research Assistant. Designed for enterprise document semantic intelligence.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 transition-colors cursor-pointer flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Secure Enterprise Data</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
