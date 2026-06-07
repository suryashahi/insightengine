import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  UploadCloud,
  FileCheck,
  AlertCircle,
  Clock,
  Trash2,
  Edit3,
  HardDrive,
  Check,
  X,
  MoreVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "../services/api";
import { DocumentRecord } from "../types";

// Helper function to format storage sizes
const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + ["B", "KB", "MB", "GB"][i];
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploadResultSummary, setUploadResultSummary] = useState<{ successList: any[], warningList: any[], failedList: any[] } | null>(null);

  // Rename states
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Deletion UI states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const records = await api.getDocuments();
      setDocuments(records);
    } catch (err) {
      console.error("Retrieve uploaded documents failed:", err);
      setError("Failed to fetch documents from database corpus.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Drag operations
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      await processUploads(files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      await processUploads(files);
    }
  };

  // Upload runner
  const processUploads = async (files: File[]) => {
    setError(null);
    setSuccessMsg(null);
    setUploadResultSummary(null);
    setUploading(true);
    setProgress(20); // Optimistic step simulation

    // Validate size and extensions
    const allowedExtensions = [
      ".pdf", ".docx", ".doc", ".txt", ".rtf", 
      ".pptx", ".ppt", ".xlsx", ".xls", ".csv", ".md",
      ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp",
      ".c", ".cs", ".go", ".php", ".html", ".css", ".json", ".xml", ".tex"
    ];
    const validFiles: File[] = [];

    for (const file of files) {
      const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        setError(`File format rejected: ${file.name}. Supported extensions are: PDFs, Office docs, presentations, spreadsheets, markdown, source code, and LaTeX.`);
        setUploading(false);
        setProgress(null);
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setError(`File limit exceeded: ${file.name} is larger than maximum allowed size (15MB).`);
        setUploading(false);
        setProgress(null);
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      setUploading(false);
      setProgress(null);
      return;
    }

    setProgress(60);

    try {
      const uploadRes = await api.uploadDocuments(validFiles);
      setProgress(90);

      const failedList = uploadRes.results.filter((res: any) => res.status === "failed");
      const warningList = uploadRes.results.filter((res: any) => res.status === "success" && (res.warning || res.ingestionReport?.status === "Warning"));
      const successList = uploadRes.results.filter((res: any) => res.status === "success" && !res.warning && res.ingestionReport?.status !== "Warning");

      setUploadResultSummary({ successList, warningList, failedList });

      await fetchDocuments();
      window.dispatchEvent(new Event("limits-updated"));
    } catch (err: any) {
      console.error("Upload server dispatch fatal error:", err);
      setError(err?.message || "File upload processing failure on standard backend pipeline.");
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete runners
  const executeDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.deleteDocument(id);
      // Success toast as requested in Requirement 8
      setToast({ type: "success", message: "Document deleted successfully" });
      setSuccessMsg("Document deleted successfully from semantic indexing.");
      // Auto list refresh
      await fetchDocuments();
      window.dispatchEvent(new Event("limits-updated"));
      setShowConfirmModal(null);
    } catch (err: any) {
      console.error("Deletion error:", err);
      // Error toast as requested in Requirement 9
      setToast({ type: "error", message: "Unable to delete document" });
      setError(err?.message || "Failed to finalize document wipe.");
      setShowConfirmModal(null);
    } finally {
      setDeletingId(null);
    }
  };

  // Rename runner
  const triggerRename = (doc: DocumentRecord) => {
    setRenamingId(doc.id);
    setRenameValue(doc.filename);
  };

  const handleRenameSubmit = async (id: string) => {
    if (!renameValue.trim()) return;
    setError(null);
    setSuccessMsg(null);

    try {
      await api.renameDocument(id, renameValue.trim());
      setSuccessMsg("Document renamed successfully.");
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, filename: renameValue.trim() } : d))
      );
      setRenamingId(null);
    } catch (err: any) {
      console.error("Rename submission error:", err);
      setError(err?.message || "Failed to apply custom renaming tag.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 select-none max-w-7xl mx-auto w-full">
      
      {/* Title greeting banner */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
          Grounded Ingestion Control <HardDrive className="w-5 h-5 text-purple-400" />
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Upload and index your files into the local vector database. Our semantic algorithms immediately clean up, split, and profile the text for chat operations.
        </p>
      </div>

      {/* Main content grid panel spacing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Upload Portal Grid Segment Left (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`bg-white/5 backdrop-blur-lg border-2 border-dashed rounded-[32px] p-8 py-12 flex flex-col items-center justify-center text-center transition-all relative ${
              dragActive
                ? "border-purple-500 bg-purple-500/10 scale-[1.01]"
                : "border-white/10 hover:border-white/25 hover:bg-white/10"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            
            <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center text-purple-400 mb-6 group cursor-pointer animate-pulse">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-sm font-bold text-slate-200 mb-1.5 tracking-wide">
              Drag-and-Drop Ingestion Pool
            </h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-6">
              Drop PDFs, DOCX, PPTX, XLSX, markdown, source code, or LaTeX materials directly, or tap to choose files.
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-5 py-3 rounded-xl font-bold text-xs tracking-wide glass-button-primary disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              Select Research Files
            </button>

            {/* Constraints indicator */}
            <p className="text-[10px] text-slate-500 mt-6 tracking-wide uppercase font-semibold">
              Max file uploads : 15MB • All research formats supported
            </p>

            {/* In-processing Upload overlay spinner */}
            {uploading && (
              <div className="absolute inset-0 bg-[#020617]/95 rounded-[32px] backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-4">
                <div className="w-10 h-10 rounded-full border-2 border-slate-350 border-t-purple-600 animate-spin" />
                <div className="space-y-1.5 text-center">
                  <p className="text-xs font-bold text-white tracking-wide uppercase">Ingesting Document Streams</p>
                  <p className="text-[10px] text-slate-450 font-medium">Loading text matrix, overlapping chunks, embedding vectors...</p>
                </div>
                {progress !== null && (
                  <div className="w-full max-w-[200px] h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toast response messages */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5 leading-relaxed antialiased">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-450" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5 leading-relaxed antialiased">
              <FileCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-450" />
              <span>{successMsg}</span>
            </div>
          )}

          {uploadResultSummary && (
            <div className="space-y-3.5 antialiased">
              {uploadResultSummary.successList.map((item: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5 leading-relaxed">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <span className="font-bold block text-emerald-200">✓ Indexed Successfully</span>
                    <span className="text-slate-350">{item.filename} (Vectorized {item.chunksCount || 0} blocks)</span>
                  </div>
                </div>
              ))}
              {uploadResultSummary.warningList.map((item: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2.5 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <span className="font-bold block text-amber-200">⚠ Validation Warning</span>
                    <span className="text-slate-350">{item.filename}: Document uploaded successfully. Validation check warning: Retrieval confidence below threshold.</span>
                  </div>
                </div>
              ))}
              {uploadResultSummary.failedList.map((item: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5 leading-relaxed">
                  <X className="w-4 h-4 shrink-0 mt-0.5 text-rose-450" />
                  <div>
                    <span className="font-bold block text-rose-200">✕ Ingestion Failed</span>
                    <span className="text-slate-350">{item.filename}: {item.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>        {/* Database Corpus Document List Segment Right (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white/5 backdrop-blur-lg p-6 rounded-[28px] border border-white/10 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8B5CF6]/35 to-transparent"></div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Indexed Database Corpus ({documents.length})</h2>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-purple-600 animate-spin" />
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Reading indexed listings...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center p-12 py-16 space-y-4">
                <FileText className="w-12 h-12 text-slate-700 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-200">Ingest Database is currently empty</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    You have not vectorized any documents yet. Drag in some source PDFs to activate semantic interactions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[500px] overflow-y-auto scrollbar-thin">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/15 hover:bg-white/10 transition-all flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left: icon/naming info */}
                      <div className="flex items-start gap-3 overflow-hidden flex-1">
                        <div className="p-3 bg-white/5 rounded-xl text-purple-400 border border-white/10">
                          <FileText className="w-5 h-5 animate-pulse" />
                        </div>
                        
                        {/* Filename vs Rename Input field */}
                        <div className="overflow-hidden space-y-1 flex-1">
                          {renamingId === doc.id ? (
                            <div className="flex items-center gap-1.5 w-full">
                              <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="glass-input text-xs p-1.5 px-2.5 rounded-lg w-full max-w-[200px]"
                              />
                              <button
                                onClick={() => handleRenameSubmit(doc.id)}
                                className="p-1 rounded bg-[#8B5CF6] hover:bg-[#7C3AED] text-white cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setRenamingId(null)}
                                className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 cursor-pointer hover:text-white border border-white/10"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <p onClick={() => triggerRename(doc)} className="text-xs font-bold text-slate-100 truncate cursor-pointer hover:text-purple-400 transition-colors flex items-center gap-1">
                              {doc.filename} <Edit3 className="w-3" />
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 flex-wrap">
                            <span>{formatBytes(doc.size)}</span>
                            <span className="text-slate-600">•</span>
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                            {doc.ingestionReport && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-300 text-[8px] rounded border border-purple-500/20 uppercase tracking-widest font-black">Report Ready</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
   
                      {/* Right: Operations buttons */}
                      <div className="flex items-center gap-2 sm:justify-end">
                        {doc.ingestionReport && (
                          <button
                            onClick={() => setExpandedReportId(expandedReportId === doc.id ? null : doc.id)}
                            className="py-1.5 px-3 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[10px] text-purple-400 font-bold hover:text-purple-300 transition-all hover:bg-[#8B5CF6]/20 cursor-pointer flex items-center gap-1"
                          >
                            Diagnose
                            {expandedReportId === doc.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                        <button
                          onClick={() => triggerRename(doc)}
                          className="py-1.5 px-3 rounded-lg bg-white/5 border border-white/10 text-[10px] text-slate-300 font-bold hover:text-white transition-all hover:bg-white/10 cursor-pointer"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => setShowConfirmModal(doc.id)}
                          disabled={deletingId === doc.id}
                          className="p-2 rounded-lg bg-rose-500/10 border border-transparent text-rose-500 hover:bg-rose-500/20 hover:text-rose-400 transition-all cursor-pointer disabled:opacity-40"
                        >
                          {deletingId === doc.id ? (
                            <div className="w-4 h-4 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable report details */}
                    {doc.ingestionReport && expandedReportId === doc.id && (
                      <div className="p-3.5 rounded-xl bg-[#030712]/90 border border-white/5 space-y-2.5 text-xs text-slate-300 select-text animate-fade-in">
                        <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                          <span className="font-extrabold text-[9px] tracking-wider uppercase text-purple-400">Ingestion Diagnostics Report</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${
                            doc.ingestionReport.status === "Warning"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : doc.ingestionReport.status === "Failed" || doc.ingestionReport.status === "Validation Failed"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}>
                            {doc.ingestionReport.status === "Warning" ? "Warning" : doc.ingestionReport.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                          <div>
                            <span className="text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Parser Registry Used</span>
                            <span className="font-mono text-slate-200 text-[11px]">{doc.ingestionReport.parserUsed}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Initial Text Length</span>
                            <span className="text-slate-200 text-[11px]">{doc.ingestionReport.textLength} characters</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-bold block text-[9px] uppercase tracking-wider">OCR Fallback Level</span>
                            <span className={`text-[11px] font-bold ${doc.ingestionReport.ocrTriggered ? "text-amber-400" : "text-slate-400"}`}>
                              {doc.ingestionReport.ocrTriggered ? "Triggered (<100 chars)" : "Not Triggered"}
                            </span>
                          </div>
                          {doc.ingestionReport.ocrTriggered && (
                            <div>
                              <span className="text-slate-500 font-bold block text-[9px] uppercase tracking-wider">OCR Extracted Length</span>
                              <span className="text-emerald-400 font-mono text-[11px] font-bold">{doc.ingestionReport.ocrTextLength} chars</span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Overlapping Chunks</span>
                            <span className="font-mono text-slate-200 text-[11px]">{doc.ingestionReport.chunksCreated} blocks</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-bold block text-[9px] uppercase tracking-wider">Vector Embeddings</span>
                            <span className="font-mono text-slate-200 text-[11px]">{doc.ingestionReport.embeddingsCreated} vectors</span>
                          </div>
                        </div>
                        
                        {doc.ingestionReport.status === "Warning" ? (
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            ⚠ Retrieval confidence below threshold
                          </div>
                        ) : doc.ingestionReport.status === "Failed" || doc.ingestionReport.status === "Validation Failed" ? (
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/5 text-[9px] font-bold uppercase tracking-wider text-rose-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            ✕ Ingestion Validation Failed (Check Failed)
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            RAG Consistency Query Verification Passed (Consistency OK)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Requirement 6: Delete Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 min-h-screen bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0f172a] border border-white/10 p-6 rounded-2xl w-full max-w-sm space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-650"></div>
            
            <div className="space-y-2 text-center sm:text-left">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" /> Delete Document?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(null)}
                disabled={deletingId !== null}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDelete(showConfirmModal)}
                disabled={deletingId !== null}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deletingId !== null ? (
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

      {/* Requirement 8 & 9: Toast Notifications */}
      {toast && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl border flex items-center gap-2.5 z-50 animate-fade-in min-w-[280px] max-w-sm transition-all duration-300 ${
          toast.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
        }`}>
          {toast.type === "success" ? (
            <Check className="w-4 h-4 shrink-0 bg-emerald-500/20 p-0.5 rounded-full" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 bg-rose-500/20 p-0.5 rounded-full" />
          )}
          <span className="text-xs font-bold tracking-wide">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
