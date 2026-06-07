import React, { useState, useEffect } from "react";
import {
  FileText,
  Sparkles,
  BookOpen,
  HelpCircle,
  TrendingDown,
  BrainCircuit,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  CheckCircle,
  XCircle,
  Lightbulb,
} from "lucide-react";
import { api } from "../services/api";
import { DocumentRecord, Flashcard, QuizQuestion } from "../types";

export default function UtilitiesPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [activeSubTab, setActiveSubTab] = useState<"summary" | "flashcards" | "quiz">("summary");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Summary State
  const [summary, setSummary] = useState<{ executiveSummary: string; detailedSummary: string; keyInsights: string[] } | null>(null);

  // Flashcards state
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Quiz state
  const [quizList, setQuizList] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({}); // questionId -> selectedOption

  useEffect(() => {
    async function loadDocs() {
      try {
        const list = await api.getDocuments();
        setDocuments(list);
        if (list.length > 0) {
          setSelectedDocId(list[0].id);
        }
      } catch (err) {
        console.error("Retrieve documents list for study suite failed:", err);
      }
    }
    loadDocs();
  }, []);

  // Recount states when document selection changes
  useEffect(() => {
    setSummary(null);
    setFlashcards([]);
    setCardIdx(0);
    setFlipped(false);
    setQuizList([]);
    setUserAnswers({});
    setError(null);
  }, [selectedDocId]);

  // Loader runner
  const executeOperation = async (type: "summary" | "flashcards" | "quiz") => {
    if (!selectedDocId) return;

    setLoading(true);
    setError(null);

    try {
      if (type === "summary") {
        const resp = await api.getSummary(selectedDocId);
        setSummary(resp);
      } else if (type === "flashcards") {
        const resp = await api.getFlashcards(selectedDocId);
        setFlashcards(resp);
        setCardIdx(0);
        setFlipped(false);
      } else if (type === "quiz") {
        const resp = await api.getQuiz(selectedDocId);
        setQuizList(resp);
        setUserAnswers({});
      }
      window.dispatchEvent(new Event("limits-updated"));
    } catch (err: any) {
      console.error(`AI utility suite failed: ${type}`, err);
      setError(`Failed to compile ${type}. Please verify that GEMINI_API_KEY is configured in Settings secrets.`);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionClick = (questionId: string, option: string) => {
    if (userAnswers[questionId]) return; // locked once clicked
    setUserAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 select-none max-w-7xl mx-auto w-full">
      {/* Title heading with gradient tags */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            Intelligence Study Suite <BrainCircuit className="w-5 h-5 text-purple-400" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Synthesize loaded documents into comprehensive summaries, double-sided study flashcards, and test-review quizzes securely.
          </p>
        </div>

        {/* Document Selector Dropdown */}
        {documents.length > 0 && (
          <div className="flex items-center gap-2.5 shrink-0 bg-white/5 px-4.5 py-2.5 rounded-xl border border-white/10 shadow-lg select-none">
            <span className="text-[10px] uppercase font-bold text-slate-450 tracking-widest">Source Doc:</span>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="text-white text-xs bg-transparent border-none outline-none font-bold max-w-[180px] cursor-pointer"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id} className="bg-[#0f172a] text-slate-200">
                  {doc.filename}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {documents.length === 0 ? (
        /* Empty documentation guidelines banner */
        <div className="bg-white/5 backdrop-blur-lg p-12 text-center rounded-[32px] border border-white/10 space-y-6 max-w-lg mx-auto relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8B5CF6]/35 to-transparent"></div>
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto animate-bounce" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Study Tools Disabled</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              To utilize the summarizer, flashcard loop, and quiz compilation dashboards, please upload a source PDF, DOCX, or text file on the My Documents screen first.
            </p>
          </div>
        </div>
      ) : (
        /* Render utilities core tabs layout */
        <div className="space-y-8">
          
          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-white/10 pb-px gap-1 sm:gap-2">
            <button
              onClick={() => setActiveSubTab("summary")}
              className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeSubTab === "summary"
                  ? "border-[#8B5CF6] text-white font-black"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              Document Summaries
            </button>
            <button
              onClick={() => setActiveSubTab("flashcards")}
              className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeSubTab === "flashcards"
                  ? "border-[#8B5CF6] text-white font-black"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              Study Flashcards
            </button>
            <button
              onClick={() => setActiveSubTab("quiz")}
              className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeSubTab === "quiz"
                  ? "border-[#8B5CF6] text-white font-black"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              Quiz Checkouts
            </button>
          </div>

          {/* Loader indicator spinner */}
          {loading && (
            <div className="flex flex-col items-center justify-center p-20 space-y-3.5">
              <div className="w-8 h-8 rounded-full border-2 border-slate-350 border-t-purple-600 animate-spin" />
              <p className="text-xs text-slate-450 font-semibold uppercase tracking-widest">Generating digital materials...</p>
            </div>
          )}

          {/* Error logger toast */}
          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center max-w-lg mx-auto">
              {error}
            </div>
          )}

          {/* Render Tab 1: Summaries */}
          {activeSubTab === "summary" && !loading && (
            <div className="space-y-6">
              {!summary ? (
                <div className="bg-white/5 backdrop-blur-lg p-10 text-center rounded-2xl border border-white/10 space-y-5 max-w-sm mx-auto">
                  <FileText className="w-10 h-10 text-purple-400 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">Generate executive outlines</p>
                    <p className="text-[11px] text-slate-400">Summarize paragraphs into executive, detailed insights.</p>
                  </div>
                  <button
                    onClick={() => executeOperation("summary")}
                    className="w-full py-3.5 rounded-xl font-bold text-xs tracking-wide glass-button-primary cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-purple-550/15"
                  >
                    Compile Executive Summary <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left segment summaries (7 cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    {/* Executive */}
                    <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 opacity-20"></div>
                      <h3 className="text-xs font-bold text-slate-305 uppercase tracking-widest flex items-center gap-1.5 selection:no-bg">
                        <CheckCircle className="w-4 h-4 text-purple-400" /> Executive summary
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-205 leading-relaxed select-text font-serif">
                        {summary.executiveSummary}
                      </p>
                    </div>

                    {/* Detailed Summary */}
                    <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-20"></div>
                      <h3 className="text-xs font-bold text-slate-305 uppercase tracking-widest flex items-center gap-1.5 selection:no-bg">
                        <BookOpen className="w-4 h-4 text-indigo-400" /> Detailed Synthesis
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed select-text font-serif">
                        {summary.detailedSummary}
                      </p>
                    </div>
                  </div>

                  {/* Right key insights columns list (5 cols) */}
                  <div className="lg:col-span-5">
                    <div className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-4">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" /> Core insights extracted
                      </h3>
                      <ul className="space-y-3">
                        {summary.keyInsights.map((insight, idx) => (
                          <li
                            key={idx}
                            className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/15 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5 select-text transition-all duration-200"
                          >
                            <span className="w-5 h-5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold select-none text-[10px] flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                              {idx + 1}
                            </span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* Render Tab 2: Study Flashcards loop */}
          {activeSubTab === "flashcards" && !loading && (
            <div className="space-y-6">
              {flashcards.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-lg p-10 text-center rounded-2xl border border-white/10 space-y-5 max-w-sm mx-auto">
                  <BrainCircuit className="w-10 h-10 text-indigo-400 mx-auto animate-pulse" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">Generate study cards</p>
                    <p className="text-[11px] text-slate-400">Compile cards matching questions with exact definitions.</p>
                  </div>
                  <button
                    onClick={() => executeOperation("flashcards")}
                    className="w-full py-3.5 rounded-xl font-bold text-xs tracking-wide glass-button-primary cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/15"
                  >
                    Compile Flashcards <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  </button>
                </div>
              ) : (
                /* Flipping card arena layout */
                <div className="max-w-md mx-auto space-y-6">
                  
                  {/* Flippable card panel */}
                  <div
                    onClick={() => setFlipped(!flipped)}
                    className="relative w-full h-64 cursor-pointer"
                  >
                    <div
                      className={`w-full h-full rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col items-center justify-center text-center transition-all duration-300 transform shadow-xl hover:border-white/20 select-none ${
                        flipped ? "bg-[#1E1B4B]/35" : ""
                      }`}
                    >
                      <span className="text-[9px] uppercase font-bold text-purple-400 tracking-widest mb-3 select-none">
                        {flipped ? "Fact-check Answer" : "Question Inquiry"}
                      </span>
                      
                      <p className="text-sm border-t border-b border-white/10 font-medium text-slate-100 py-4 leading-relaxed tracking-wider px-2 line-clamp-5 max-h-[160px] overflow-y-auto select-text selection:bg-purple-500/20">
                        {flipped ? flashcards[cardIdx].answer : flashcards[cardIdx].question}
                      </p>

                      <span className="text-[10px] text-slate-500 mt-4 select-none font-medium">
                        (Tap card outline to flip / reveal answers)
                      </span>
                    </div>
                  </div>

                  {/* Cycling navigations bars */}
                  <div className="flex items-center justify-between bg-white/5 px-4.5 py-3 rounded-xl border border-white/10">
                    <button
                      onClick={() => {
                        setFlipped(false);
                        setCardIdx((prev) => (prev > 0 ? prev - 1 : flashcards.length - 1));
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-305">
                      Card {cardIdx + 1} of {flashcards.length}
                    </span>
                    <button
                      onClick={() => {
                        setFlipped(false);
                        setCardIdx((prev) => (prev < flashcards.length - 1 ? prev + 1 : 0));
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* Render Tab 3: Interactive Quizzes checkout */}
          {activeSubTab === "quiz" && !loading && (
            <div className="space-y-6">
              {quizList.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-lg p-10 text-center rounded-2xl border border-white/10 space-y-5 max-w-sm mx-auto">
                  <HelpCircle className="w-10 h-10 text-cyan-400 mx-auto animate-pulse" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">Generate adaptive testing quiz</p>
                    <p className="text-[11px] text-slate-400">Assemble 5 multiple choice questions with explanations based on your documents.</p>
                  </div>
                  <button
                    onClick={() => executeOperation("quiz")}
                    className="w-full py-3 rounded-xl font-bold text-xs tracking-wide glass-button-primary cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/15 animate-pulse"
                  >
                    Compile Smart Quiz <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  </button>
                </div>
              ) : (
                /* Complete active quiz review list layout (Scroll style) */
                <div className="max-w-2xl mx-auto space-y-6 selection:bg-[#8B5CF6]/20">
                  {quizList.map((q, qIdx) => {
                    const chosenOption = userAnswers[q.id];
                    return (
                      <div
                        key={q.id}
                        className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 space-y-4 relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8B5CF6]/30 to-transparent"></div>
                        {/* Q Header title */}
                        <div className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded bg-white/5 border border-white/10 text-[10px] font-extrabold text-slate-400 flex items-center justify-center mt-0.5 select-none shrink-0 border-white/20">
                            {qIdx + 1}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-100 select-text leading-relaxed">{q.question}</h4>
                        </div>

                        {/* Options button grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-7.5">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = chosenOption === opt;
                            const isCorrect = q.correctAnswer === opt;
                            
                            let borderStyling = "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white hover:bg-white/10";
                            
                            if (chosenOption) {
                              if (isCorrect) {
                                borderStyling = "border-[#10B981]/35 bg-[#10B981]/10 text-[#34D399]";
                              } else if (isSelected) {
                                borderStyling = "border-[#EF4444]/35 bg-[#EF4444]/10 text-[#F87171]";
                              } else {
                                borderStyling = "border-white/5 bg-white/5 text-slate-500 opacity-60";
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                disabled={!!chosenOption}
                                onClick={() => handleOptionClick(q.id, opt)}
                                className={`p-3.5 rounded-xl border text-[11px] sm:text-xs text-left transition-all font-medium cursor-pointer flex items-center justify-between gap-3 ${borderStyling}`}
                              >
                                <span>{opt}</span>
                                {chosenOption && isCorrect && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                {chosenOption && isSelected && !isCorrect && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>

                        {/* Explanation block once answered */}
                        {chosenOption && (
                          <div className="pl-7.5 pt-3.5 border-t border-white/10 space-y-2 select-text">
                            <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest flex items-center gap-1 leading-none">
                              Explanation insight:
                            </span>
                            <p className="text-xs text-slate-400 leading-relaxed font-serif select-text">
                              {q.explanation}
                            </p>
                          </div>
                        )}

                      </div>
                    );
                  })}

                  {/* Reset Checkout operation bar */}
                  <div className="text-right">
                    <button
                      onClick={() => executeOperation("quiz")}
                      className="px-4.5 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-purple-400 hover:bg-[#8B5CF6]/5 hover:text-[#8B5CF6] transition-all cursor-pointer flex items-center gap-1.5 ml-auto text-[#8B5CF6] border-[#8B5CF6]/20"
                    >
                      <RotateCcw className="w-4 h-4" /> Regenerate Test Checkouts
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
