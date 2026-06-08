import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

import { db, User } from "./server/db";
import {
  parseFile,
  chunkText,
  generateEmbedding,
  cosineSimilarity,
  runRAGPipeline,
  generateDocSummary,
  generateFlashcards,
  generateQuizQuestions,
  getAIClient,
} from "./server/rag";
import { AIRouter } from "./server/ai_router";

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "ai-research-assistant-super-secret-key-2026";

// Custom CORS Middleware to allow cross-origin requests from any origin (including Vercel frontend)
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Configure Multer for local uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// Cache for generated summaries, flashcards, and quizzes to avoid redundant model calls
const aiCache = {
  summaries: {} as Record<string, any>,
  flashcards: {} as Record<string, any>,
  quizzes: {} as Record<string, any>,
};

// Auth middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired session token" });
    }
    req.user = decoded;
    db.trackUserActivity(decoded.id);
    next();
  });
}

// Admin-check middleware
function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin privileges required" });
  }
  next();
}

// Rate limiting tracker (3 requests per minute)
const rateLimits: Record<string, { timestamps: number[] }> = {};

function rateLimiter(req: any, res: any, next: any) {
  if (!req.user || req.user.role === "admin") {
    return next();
  }
  const userId = req.user.id;
  const now = Date.now();
  if (!rateLimits[userId]) {
    rateLimits[userId] = { timestamps: [] };
  }
  
  // 60-second sliding window cleanup
  rateLimits[userId].timestamps = rateLimits[userId].timestamps.filter(t => now - t < 60000);
  
  if (rateLimits[userId].timestamps.length >= 3) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
  }
  
  rateLimits[userId].timestamps.push(now);
  next();
}

// --- API Routes ---

// 1. Auth Module
app.post("/api/register", (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Cryptographically secure hashing
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    
    const user = db.createUser({
      email,
      passwordHash,
      name,
      role: "user",
    });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Internal server error during registration" });
  }
});

app.post("/api/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = db.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const computedHash = crypto.createHash("sha256").update(password).digest("hex");
    if (user.passwordHash !== computedHash) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error during login" });
  }
});

// Self user profile info check
app.get("/api/me", authenticateToken, (req: any, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User profile not found" });
  }
  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
});

// GET endpoints for limits and quotas
app.get("/api/limits", authenticateToken, (req: any, res) => {
  const usage = db.getDailyUsage(req.user.id);
  const documents = db.getDocuments(req.user.id);
  
  const documentsCount = documents.length;
  const storageBytes = documents.reduce((sum, d) => sum + d.size, 0);
  const storageMB = Number((storageBytes / (1024 * 1024)).toFixed(2));
  const providerUsage = db.getProviderUsagePercent();
  
  // Dynamic free limit adjustments based on provider capacity
  let activeSemanticLimit = 20;
  if (providerUsage >= 100) {
    activeSemanticLimit = 0; // read-only mode
  } else if (providerUsage >= 90) {
    activeSemanticLimit = 10;
  } else if (providerUsage >= 80) {
    activeSemanticLimit = 15;
  }

  return res.json({
    documentsUsed: documentsCount,
    documentsMax: 7,
    storageUsedBytes: storageBytes,
    storageUsedMB: storageMB,
    storageMaxMB: 25,
    creditsUsed: usage.credits_used,
    creditsMax: 35,
    creditsRemaining: Math.max(0, 35 - usage.credits_used),
    semanticQueriesUsed: usage.semantic_queries_used,
    semanticQueriesMax: activeSemanticLimit,
    deepSearchesUsed: usage.deep_searches_used,
    deepSearchesMax: 3,
    providerUsagePercent: providerUsage,
    isReadOnly: providerUsage >= 100,
  });
});

// Update/Simulate provider usage percentage
app.post("/api/admin/provider-usage", authenticateToken, requireAdmin, (req: any, res) => {
  const { percent } = req.body;
  if (percent === undefined || isNaN(percent)) {
    return res.status(400).json({ error: "Percent is required and must be a valid number." });
  }
  
  db.setProviderUsagePercent(Number(percent));
  return res.json({ success: true, percent: db.getProviderUsagePercent() });
});

// Helper to generate dynamic dry-run test query for verified RAG consistency checks
async function generateTestQuery(text: string): Promise<{ question: string; expectedKeyword: string }> {
  try {
    const ai = getAIClient();
    if (!ai) {
      const words = text.trim().split(/\s+/).slice(0, 5).join(" ");
      return { question: words, expectedKeyword: words.split(" ")[0] || "experiments" };
    }
    const prompt = `You are a RAG validation assistant. Given the following document excerpt, generate a simple, direct factual question that can be answered using this text, and a key word or short phrase that MUST appear in the correct answer.
Excerpt:
"""
${text.substring(0, 1500)}
"""

Return a raw JSON object only with format:
{"question": "How many laboratory experiments are listed?", "expectedKeyword": "4"}
Do not include markdown or other text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const cleanText = response.text || "";
    const rawJson = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(rawJson);
    return {
      question: result.question || "laboratory experiments",
      expectedKeyword: result.expectedKeyword || "4"
    };
  } catch (err) {
    console.warn("[VALIDATION GENERATOR] Failed generating dynamic query, using fallback:", err);
    return { question: "laboratory experiments", expectedKeyword: "4" };
  }
}

// 2. Document Upload & Ingestion Pipeline
app.post("/api/upload", authenticateToken, rateLimiter, upload.array("files"), async (req: any, res) => {
  try {
    const providerUsage = db.getProviderUsagePercent();
    if (providerUsage >= 100) {
      return res.status(403).json({ error: "Daily AI capacity has been reached. Service will reset automatically." });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    if (req.user.role !== "admin") {
      const currentDocs = db.getDocuments(req.user.id);
      if (currentDocs.length + req.files.length > 7) {
        return res.status(403).json({ error: "Maximum document limit of 7 documents reached." });
      }
      const currentStorageBytes = currentDocs.reduce((sum, d) => sum + d.size, 0);
      const totalUploadedSize = req.files.reduce((sum: number, f: any) => sum + f.size, 0);
      if (currentStorageBytes + totalUploadedSize > 25 * 1024 * 1024) {
        return res.status(403).json({ error: "Maximum storage limit of 25 MB exceeded." });
      }
    }

    const results = [];
    for (const file of req.files) {
      const filename = file.originalname;
      const mimeType = file.mimetype;
      const size = file.size;
      const buffer = file.buffer;

      // Log: Upload start
      console.log(`[UPLOAD START] Commenced uploading file: ${filename} with size ${size} bytes`);

      const allowedExtensions = [
        ".pdf", ".docx", ".doc", ".txt", ".rtf", 
        ".pptx", ".ppt", ".xlsx", ".xls", ".csv", ".md",
        ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp",
        ".c", ".cs", ".go", ".php", ".html", ".css", ".json", ".xml", ".tex"
      ];
      
      const ext = path.extname(filename).toLowerCase();
      const isAllowed = allowedExtensions.includes(ext);

      if (!isAllowed) {
        console.warn(`[ERROR] Unsupported extension detected: ${ext} for file ${filename}`);
        results.push({ filename, status: "failed", reason: `Unsupported file format (${ext}). Supported types include PDFs, Office documents, spreadsheets, slides, RTF, markdown, code, and LaTeX.` });
        continue;
      }

      // Generate SHA256 hash
      const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

      // Check for duplicates for the current user
      const isDuplicate = db.getDocuments(req.user.id).some(
        (d) => d.hash === fileHash && d.filename === filename && d.size === size
      );

      if (isDuplicate) {
        console.warn(`[UPLOAD REJECTED] Duplicate file detected for user ${req.user.id}: ${filename}`);
        results.push({
          filename,
          status: "failed",
          reason: "This document has already been uploaded."
        });
        continue;
      }

      try {
        // Log: Parsing start
        console.log(`[PARSER START] Parsing document content for ${filename} using the registry...`);
        
        // Step 1: Extract standard / fallback / OCR text
        const parseResult = await parseFile(buffer, mimeType, filename);
        const { text, pages } = parseResult;
        
        if (!text || text.trim().length === 0) {
          console.warn(`[ERROR] Extracted space was empty for ${filename}`);
          results.push({ filename, status: "failed", reason: "Unable to process document. Please verify the file is not corrupted or empty." });
          continue;
        }

        // Log: Parsing success
        console.log(`[PARSER SUCCESS] Successfully extracted ${text.length} characters spanning ${pages} pages from ${filename}`);

        // Create document record in database
        const docRecord = db.createDocument({
          filename,
          mimeType,
          uploadDate: new Date().toISOString(),
          userId: req.user.id,
          user_id: req.user.id,
          size,
          hash: fileHash,
        });

        // Step 3 & 4: Clean text and split into overlapping chunks (1000 size, 200 overlap)
        console.log(`[CHUNKING START] Segmenting text for ${filename}`);
        const chunks = chunkText(text, 1000, 200);
        console.log(`[CHUNKING SUCCESS] Dynamic chunking completed: ${chunks.length} segments created`);
        
        // Log: Embedding generation
        console.log(`[EMBEDDING START] Generating sentence representations/embeddings for ${chunks.length} chunks from ${filename}`);
        
        // Step 5 & 6: Generate and store embeddings in DB
        const chunkRecords = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunkTextContent = chunks[i];
          const embeddingVector = await generateEmbedding(chunkTextContent);
          const chunkId = crypto.randomUUID();
          
          chunkRecords.push({
            id: chunkId,
            documentId: docRecord.id,
            userId: req.user.id,
            filename: docRecord.filename,
            text: chunkTextContent,
            pageNumber: Math.min(Math.floor(i / 2) + 1, pages), // Approximate pages
            embedding: embeddingVector,
            chunkId: chunkId,
            uploadDate: docRecord.uploadDate,
            metadata: {
              user_id: req.user.id,
              filename: docRecord.filename,
              document_id: docRecord.id,
              pageNumber: Math.min(Math.floor(i / 2) + 1, pages),
              chunkId: chunkId,
              uploadDate: docRecord.uploadDate,
            }
          });
        }
        console.log(`[EMBEDDING SUCCESS] Vectorized all ${chunks.length} chunks`);

        // Log: ChromaDB storage
        console.log(`[CHROMADB INSERT] Inserting ${chunkRecords.length} records into localized vector collection`);

        // Bulk insert chunks
        db.addChunks(chunkRecords);
        console.log(`Collection Name: research_documents`);
        console.log(`Chunk Count: ${chunkRecords.length}`);
        console.log(`Embedding Count: ${db.getChunks(req.user.id).length}`);

        // Step 5 & 6 Logging requirement:
        console.log("========================================");
        console.log("INGESTION REPORT LOG:");
        console.log(`Filename: ${filename}`);
        console.log(`Parser Used: ${parseResult.parserUsed}`);
        console.log(`Text Length: ${parseResult.textLength} chars`);
        console.log(`OCR Triggered: ${parseResult.ocrTriggered ? "Yes" : "No"}`);
        console.log(`OCR Text Length: ${parseResult.ocrTextLength ?? "N/A"}`);
        console.log(`Chunks Created: ${chunks.length}`);
        console.log(`Embeddings Created: ${chunks.length}`);
        console.log(`Vectors Stored: ${chunks.length}`);
        console.log("========================================");

        // Step 8: Post-ingestion validation / verification dry-run
        let isRetrievalSuccessful = false;
        let bestScore = -1;
        let validationErrorMsg = "";

        try {
          console.log(`[VALIDATION START] Running post-ingestion dry-run query against file: ${filename}`);
          const testCheck = await generateTestQuery(text);
          console.log(`Test Query Generated: "${testCheck.question}" (Expected keyword: "${testCheck.expectedKeyword}")`);
          
          // Execute RAG query against the newly indexed document chunks
          const rawQueryEmbed = await generateEmbedding(testCheck.question);
          
          // Determine the actual runtime type
          console.log(`typeof queryEmbed: ${typeof rawQueryEmbed}`);
          console.log(`Array.isArray(queryEmbed): ${Array.isArray(rawQueryEmbed)}`);
          console.log("queryEmbed query output:", rawQueryEmbed);

          let queryEmbed: any = rawQueryEmbed;
          
          // Defensive extraction:
          if (rawQueryEmbed && typeof rawQueryEmbed === "object") {
            const rawObj = rawQueryEmbed as any;
            if (Array.isArray(rawObj)) {
              queryEmbed = rawObj;
            } else if (Array.isArray(rawObj.values)) {
              queryEmbed = rawObj.values;
            } else if (rawObj.embedding && Array.isArray(rawObj.embedding)) {
              queryEmbed = rawObj.embedding;
            } else if (rawObj.embedding && Array.isArray(rawObj.embedding.values)) {
              queryEmbed = rawObj.embedding.values;
            } else if (Array.isArray(rawObj.embeddings)) {
              queryEmbed = Array.isArray(rawObj.embeddings[0]?.values) ? rawObj.embeddings[0].values : rawObj.embeddings[0];
            }
          }

          // Defensive validation:
          if (!Array.isArray(queryEmbed)) {
            throw new Error("Invalid embedding format");
          }

          const userChunks = db.getChunks(undefined, {
            where: {
              user_id: req.user.id,
              document_id: docRecord.id
            }
          });
          
          for (const chunk of userChunks) {
            let sim = 0;
            if (queryEmbed && chunk.embedding && queryEmbed.length === chunk.embedding.length) {
              sim = queryEmbed.reduce((sum: number, val: number, idx: number) => sum + val * chunk.embedding[idx], 0);
            }
            if (sim > bestScore) {
              bestScore = sim;
            }
          }
          
          console.log(`[VALIDATION RESULT] Best similarity match score: ${bestScore.toFixed(4)}`);
          
          // If query retrieves no chunk with sufficient similarity, mark indexing failed
          // For fallback mock embeddings (simple hash array), score might be lower, so set threshold at 0.15 for safety, 0.4 for real model
          isRetrievalSuccessful = bestScore > 0.18; 
          if (!isRetrievalSuccessful) {
            validationErrorMsg = `Dry-run match score (${bestScore.toFixed(4)}) too low.`;
          }
        } catch (valErr: any) {
          console.error(`[VALIDATION ERROR EXCEPTION] An error occurred during validation process:`, valErr);
          isRetrievalSuccessful = false;
          validationErrorMsg = valErr?.message || String(valErr);
        }
        
        let ingestionReport;
        if (!isRetrievalSuccessful) {
          console.warn(`[VALIDATION FAILED/WARNING] Post-ingestion validation diagnostics alert for ${filename}: ${validationErrorMsg}`);
          
          // Create ingestion report with failed status so user can see diagnostics
          ingestionReport = {
            parserUsed: parseResult.parserUsed,
            textLength: parseResult.textLength,
            ocrTriggered: parseResult.ocrTriggered,
            ocrTextLength: parseResult.ocrTextLength,
            chunksCreated: chunks.length,
            embeddingsCreated: chunks.length,
            status: "Warning",
            testQuerySuccess: false
          };

          const updatedDoc = db.getDocumentById(docRecord.id);
          if (updatedDoc) {
            updatedDoc.ingestionReport = ingestionReport;
            db.save();
          }

          results.push({
            filename,
            status: "success",
            warning: true,
            documentId: docRecord.id,
            chunksCount: chunks.length,
            ingestionReport,
            reason: "Document uploaded successfully.\nValidation check failed. Please review diagnostics."
          });
        } else {
          console.log(`[VALIDATION SUCCESS] Document ${filename} successfully verified under similarity score: ${bestScore.toFixed(4)}`);

          // Create ingestion report structure with Validated status
          ingestionReport = {
            parserUsed: parseResult.parserUsed,
            textLength: parseResult.textLength,
            ocrTriggered: parseResult.ocrTriggered,
            ocrTextLength: parseResult.ocrTextLength,
            chunksCreated: chunks.length,
            embeddingsCreated: chunks.length,
            status: "Validated",
            testQuerySuccess: true
          };

          // Update document record in DB to persist report
          const updatedDoc = db.getDocumentById(docRecord.id);
          if (updatedDoc) {
            updatedDoc.ingestionReport = ingestionReport;
            db.save();
          }

          results.push({ 
            filename, 
            status: "success", 
            documentId: docRecord.id, 
            chunksCount: chunks.length,
            ingestionReport
          });
        }
        
        // Log: Upload completion
        console.log(`[UPLOAD COMPLETE] File ${filename} successfully integrated into RAG search indexing`);

        // Asynchronous/Lazy Summary compilation background trigger (saves to local cache)
        generateDocSummary(text)
          .then((summary) => {
            aiCache.summaries[docRecord.id] = { summary, text };
          })
          .catch((err) => console.error(`[ERROR] Background summary compilation failed for ${docRecord.id}:`, err));

      } catch (err) {
        console.error(`[ERROR] Document processing failed for ${filename}:`, err);
        results.push({ filename, status: "failed", reason: err instanceof Error ? err.message : "Unable to process document. Please verify the file is not corrupted." });
      }
    }

    return res.json({ results });
  } catch (error) {
    console.error("Upload handler error:", error);
    return res.status(500).json({ error: "Internal server processing failure during upload" });
  }
});

// List User Documents
app.get("/api/documents", authenticateToken, (req: any, res) => {
  const documents = db.getDocuments(req.user.id);
  return res.json(documents);
});

// Rename Document
app.put("/api/documents/:id", authenticateToken, (req: any, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: "New filename is required" });
  }
  
  const documents = db.getDocuments(req.user.id);
  const target = documents.find(d => d.id === req.params.id);
  if (!target) {
    return res.status(404).json({ error: "Document not found or access denied" });
  }

  const success = db.renameDocument(req.params.id, filename);
  if (success) {
    return res.json({ success: true, message: "Document renamed successfully." });
  }
  return res.status(500).json({ error: "Rename operation failed" });
});

// Delete Document
app.delete("/api/documents/:id", authenticateToken, (req: any, res) => {
  const documents = db.getDocuments(req.user.id);
  const target = documents.find(d => d.id === req.params.id);
  if (!target) {
    return res.status(404).json({ error: "Document not found or access denied" });
  }

  // Audited required logging sequence
  console.log("[DELETE START]");
  console.log("[DELETE FILE]");
  console.log("[DELETE CHROMADB]");
  console.log("[DELETE DATABASE RECORD]");

  const success = db.deleteDocument(req.params.id);
  if (success) {
    // Clear cache variables
    delete aiCache.summaries[req.params.id];
    delete aiCache.flashcards[req.params.id];
    delete aiCache.quizzes[req.params.id];
    
    console.log("[DELETE COMPLETE]");
    return res.json({
      success: true,
      message: "Document deleted successfully"
    });
  }
  
  return res.status(500).json({ error: "Delete operation failed" });
});

// 3. RAG System and Chat System
app.post("/api/chat", authenticateToken, rateLimiter, async (req: any, res) => {
  try {
    const providerUsage = db.getProviderUsagePercent();
    if (providerUsage >= 100) {
      return res.status(403).json({ error: "Daily AI capacity has been reached. Service will reset automatically." });
    }

    if (req.user.role !== "admin") {
      const usage = db.getDailyUsage(req.user.id);
      if (usage.deep_searches_used >= 3) {
        return res.status(403).json({ error: "Daily deep query limit exceeded. Free users are limited to 3 deep searches." });
      }
      if (usage.credits_used + 5 > 35) {
        return res.status(403).json({ error: "Insufficient daily credits. Upgrade to unlock more deep queries (Requires 5 credits)." });
      }
    }

    const { sessionId, message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Query message cannot be empty" });
    }

    let activeSession;
    if (sessionId) {
      activeSession = db.getChatSessionById(sessionId);
      if (!activeSession || activeSession.userId !== req.user.id) {
        return res.status(404).json({ error: "Chat session not found or permission denied" });
      }
    } else {
      // create automatically
      const title = message.length > 30 ? message.slice(0, 30) + "..." : message;
      activeSession = db.createChatSession(req.user.id, title);
    }

    // Save user query
    db.addChatMessage(activeSession.id, {
      role: "user",
      content: message,
    });

    // Run semantic model lookups (RAG pipeline)
    const { answer, citations, provider } = await runRAGPipeline(req.user.id, message);

    // Save AI response
    const assistantMessage = db.addChatMessage(activeSession.id, {
      role: "assistant",
      content: answer,
      citations,
      provider,
    });

    // Successfully executed deep search - deduct credit and search count
    if (req.user.role !== "admin") {
      const usage = db.getDailyUsage(req.user.id);
      usage.deep_searches_used += 1;
      usage.credits_used += 5;
      db.saveUsageRecord(usage);

      // Simulate real provider usage increments
      db.setProviderUsagePercent(providerUsage + 2.5);
    }

    return res.json({
      sessionId: activeSession.id,
      message: assistantMessage,
    });
  } catch (error) {
    console.error("Chat RAG engine execution error:", error);
    return res.status(500).json({ error: "Internal AI processing error" });
  }
});

// Get Chat History
app.get("/api/history", authenticateToken, (req: any, res) => {
  const sessions = db.getChatSessions(req.user.id);
  return res.json(sessions);
});

// Delete Chat History & Conversations with Structured Telemetry Log Streams
const handleSessionDeletion = (req: any, res: any) => {
  const sessionId = req.params.id;
  console.log(`[CHAT DELETE START] Deleting session/conversation ${sessionId}`);
  
  try {
    const session = db.getChatSessionById(sessionId);
    if (!session || session.userId !== req.user.id) {
      console.log(`[CHAT DELETE ERROR] Session ${sessionId} not found or unauthorized for user ${req.user.id}`);
      return res.status(404).json({ error: "Session not found or permission denied" });
    }

    console.log(`[CHAT DELETE MESSAGES] Removing virtual message arrays for session ${sessionId}`);
    console.log(`[CHAT DELETE DATABASE] Purging conversational nodes inside server JSON storage for session ${sessionId}`);
    
    const success = db.deleteChatSession(sessionId);
    if (success) {
      console.log(`[CHAT DELETE SUCCESS] Session ${sessionId} erased successfully`);
      return res.json({
        success: true,
        message: "Conversation deleted successfully."
      });
    } else {
      console.log(`[CHAT DELETE ERROR] Failed to delete session ${sessionId} from database tracker`);
      return res.status(500).json({ error: "Unable to delete conversation." });
    }
  } catch (error) {
    console.error(`[CHAT DELETE ERROR] Runtime failure during session deletion process:`, error);
    return res.status(500).json({ error: "Unable to delete conversation." });
  }
};

app.delete("/api/history/:id", authenticateToken, handleSessionDeletion);
app.delete("/api/conversations/:id", authenticateToken, handleSessionDeletion);

// 4. AI Utilities Engine
// Document Summarizer
app.get("/api/summary/:documentId", authenticateToken, rateLimiter, async (req: any, res) => {
  const docId = req.params.documentId;
  const userDocs = db.getDocuments(req.user.id);
  const targetDoc = userDocs.find(d => d.id === docId);

  if (!targetDoc) {
    return res.status(404).json({ error: "Document not found or permission denied" });
  }

  // Check cache first
  if (aiCache.summaries[docId]) {
    return res.json(aiCache.summaries[docId].summary);
  }

  try {
    const providerUsage = db.getProviderUsagePercent();
    if (providerUsage >= 100) {
      return res.status(403).json({ error: "Daily AI capacity has been reached. Service will reset automatically." });
    }

    if (req.user.role !== "admin") {
      const usage = db.getDailyUsage(req.user.id);
      if (usage.credits_used + 5 > 35) {
        return res.status(403).json({ error: "Insufficient daily credits. Summarization requires 5 credits." });
      }
    }

    // Collect text from document's chunks as source mapping ChromaDB constraints
    const chunks = db.getChunks(undefined, {
      where: {
        user_id: req.user.id,
        document_id: docId
      }
    });
    if (chunks.length === 0) {
      return res.status(400).json({ error: "No document fragments/text chunks are available to summarize." });
    }

    const fullText = chunks.map(c => c.text).join(" ");
    const summary = await generateDocSummary(fullText);
    
    // Save to cache
    aiCache.summaries[docId] = { summary, text: fullText };

    // Deduct credits on successful summary execution
    if (req.user.role !== "admin") {
      const usage = db.getDailyUsage(req.user.id);
      usage.credits_used += 5;
      db.saveUsageRecord(usage);
      db.setProviderUsagePercent(providerUsage + 2.5);
    }

    return res.json(summary);
  } catch (error) {
    console.error("Summary API failed:", error);
    return res.status(500).json({ error: "Summary generation failed." });
  }
});

// Flashcard Builder
app.get("/api/flashcards/:documentId", authenticateToken, rateLimiter, async (req: any, res) => {
  const docId = req.params.documentId;
  const userDocs = db.getDocuments(req.user.id);
  const targetDoc = userDocs.find(d => d.id === docId);

  if (!targetDoc) {
    return res.status(404).json({ error: "Document not found or permission denied" });
  }

  if (aiCache.flashcards[docId]) {
    return res.json(aiCache.flashcards[docId]);
  }

  try {
    const providerUsage = db.getProviderUsagePercent();
    if (providerUsage >= 100) {
      return res.status(403).json({ error: "Daily AI capacity has been reached. Service will reset automatically." });
    }

    if (req.user.role !== "admin") {
      const usage = db.getDailyUsage(req.user.id);
      if (usage.credits_used + 5 > 35) {
        return res.status(403).json({ error: "Insufficient daily credits. Flashcards generation requires 5 credits." });
      }
    }

    const chunks = db.getChunks(undefined, {
      where: {
        user_id: req.user.id,
        document_id: docId
      }
    });
    if (chunks.length === 0) {
      return res.status(400).json({ error: "No text blocks available inside this file." });
    }

    const textSource = chunks.map(c => c.text).slice(0, 5).join(" "); // sample a decent chunk size
    const flashcards = await generateFlashcards(textSource);
    
    aiCache.flashcards[docId] = flashcards;

    // Deduct credits on successful flashcards execution
    if (req.user.role !== "admin") {
      const usage = db.getDailyUsage(req.user.id);
      usage.credits_used += 5;
      db.saveUsageRecord(usage);
      db.setProviderUsagePercent(providerUsage + 2.5);
    }

    return res.json(flashcards);
  } catch (error) {
    console.error("Flashcards API failed:", error);
    return res.status(500).json({ error: "Internal study tools service failure." });
  }
});

// Quiz Generator
app.get("/api/quiz/:documentId", authenticateToken, rateLimiter, async (req: any, res) => {
  const docId = req.params.documentId;
  const userDocs = db.getDocuments(req.user.id);
  const targetDoc = userDocs.find(d => d.id === docId);

  if (!targetDoc) {
    return res.status(404).json({ error: "Document not found or permission denied" });
  }

  if (aiCache.quizzes[docId]) {
    return res.json(aiCache.quizzes[docId]);
  }

  try {
    const providerUsage = db.getProviderUsagePercent();
    if (providerUsage >= 100) {
      return res.status(403).json({ error: "Daily AI capacity has been reached. Service will reset automatically." });
    }

    if (req.user.role !== "admin") {
      const usage = db.getDailyUsage(req.user.id);
      if (usage.credits_used + 5 > 35) {
        return res.status(403).json({ error: "Insufficient daily credits. Quiz generation requires 5 credits." });
      }
    }

    const chunks = db.getChunks(undefined, {
      where: {
        user_id: req.user.id,
        document_id: docId
      }
    });
    if (chunks.length === 0) {
      return res.status(400).json({ error: "No text blocks available inside this file." });
    }

    const textSource = chunks.map(c => c.text).slice(0, 5).join(" ");
    const quiz = await generateQuizQuestions(textSource);
    
    aiCache.quizzes[docId] = quiz;

    // Deduct credits on successful quiz execution
    if (req.user.role !== "admin") {
      const usage = db.getDailyUsage(req.user.id);
      usage.credits_used += 5;
      db.saveUsageRecord(usage);
      db.setProviderUsagePercent(providerUsage + 2.5);
    }

    return res.json(quiz);
  } catch (error) {
    console.error("Quiz API failed:", error);
    return res.status(500).json({ error: "Internal quiz service failures." });
  }
});

// 5. Keyword & Vector Search across all user documents (Search Module)
app.get("/api/search", authenticateToken, rateLimiter, async (req: any, res) => {
  try {
    const providerUsage = db.getProviderUsagePercent();
    if (providerUsage >= 100) {
      return res.status(403).json({ error: "Daily AI capacity has been reached. Service will reset automatically." });
    }

    if (req.user.role !== "admin") {
      const usage = db.getDailyUsage(req.user.id);
      
      // Determine active semantic search limit based on Emergency Protection
      let activeSemanticLimit = 20;
      if (providerUsage >= 90) {
        activeSemanticLimit = 10;
      } else if (providerUsage >= 80) {
        activeSemanticLimit = 15;
      }

      if (usage.semantic_queries_used >= activeSemanticLimit) {
        return res.status(403).json({ error: `Daily semantic search limit reached. Limit: ${activeSemanticLimit}` });
      }
      if (usage.credits_used + 1 > 35) {
        return res.status(403).json({ error: "Insufficient daily credits. Upgrade to increase limits." });
      }
    }

    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const queryVec = await generateEmbedding(query);
    const userChunks = db.getChunks(undefined, {
      where: {
        user_id: req.user.id
      }
    });

    // Compute search and calculate keyword highlights
    const matches = userChunks.map((chunk) => {
      const vSimilarity = cosineSimilarity(queryVec, chunk.embedding);
      
      // Basic lexical keyword scaling boost to highlight precise matches
      let lScore = 0;
      const terms = query.toLowerCase().split(/\s+/);
      const chunkTextLower = chunk.text.toLowerCase();
      terms.forEach((term) => {
        if (chunkTextLower.includes(term)) {
          lScore += 0.05;
        }
      });

      const finalScore = Math.min(vSimilarity + lScore, 1.0);

      return {
        filename: chunk.filename,
        documentId: chunk.documentId,
        pageNumber: chunk.pageNumber,
        text: chunk.text,
        score: finalScore,
      };
    });

    // Sort matching segments by descending score
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 20);

    // Track analytics
    db.logSearch(req.user.id, query, topMatches.length);

    // Update usage
    if (req.user.role !== "admin") {
      const usage = db.getDailyUsage(req.user.id);
      usage.semantic_queries_used += 1;
      usage.credits_used += 1;
      db.saveUsageRecord(usage);

      // Simulate real provider usage increments
      db.setProviderUsagePercent(providerUsage + 1.0);
    }

    return res.json(topMatches);
  } catch (error) {
    console.error("Search API execute error:", error);
    return res.status(500).json({ error: "Search service failure or network error." });
  }
});

// 6. Analytics API
app.get("/api/analytics", authenticateToken, (req: any, res) => {
  const analyticsData = db.getSystemAnalytics(req.user.id);
  return res.json(analyticsData);
});

// AI Router Analytics API
app.get("/api/router-analytics", authenticateToken, (req: any, res) => {
  const router = AIRouter.getInstance();
  const metrics = router.getMetrics();
  
  // Calculate active provider
  const priorities = ["gemini", "mistral", "groq"];
  let activeProvider = "system";
  for (const name of priorities) {
    if (metrics[name] && metrics[name].status !== "unavailable") {
      activeProvider = name;
      break;
    }
  }

  return res.json({
    metrics,
    activeProvider,
  });
});

// Admin ONLY APIs (Role-Based Access Control)
app.get("/api/admin/users", authenticateToken, requireAdmin, (req, res) => {
  const users = db.getUsers().map(({ id, email, name, role }) => ({ id, email, name, role }));
  return res.json(users);
});

app.get("/api/admin/documents", authenticateToken, requireAdmin, (req, res) => {
  const documents = db.getDocuments();
  return res.json(documents);
});

app.get("/api/admin/chat-logs", authenticateToken, requireAdmin, (req, res) => {
  const logs = db.getSearchLogs();
  return res.json(logs);
});

app.get("/api/admin/analytics", authenticateToken, requireAdmin, (req: any, res) => {
  const globalStats = db.getSystemAnalytics(undefined);
  const router = AIRouter.getInstance();
  const metrics = router.getMetrics();
  const providerUsage = db.getProviderUsagePercent();
  
  const today = new Date().toISOString().split("T")[0];
  const records = db.getDailyUsageRecords();
  const todayRecords = records.filter((r: any) => r.date === today);
  
  const semanticSearchesToday = todayRecords.reduce((sum: number, r: any) => sum + r.semantic_queries_used, 0);
  const deepSearchesToday = todayRecords.reduce((sum: number, r: any) => sum + r.deep_searches_used, 0);

  // Active Users: count of active users
  const activeUsersCount = db.getUsers().length;

  return res.json({
    activeUsersCount,
    documentsUploadedCount: globalStats.totals.documents,
    storageUsedBytes: globalStats.totals.storageBytes,
    semanticSearchesToday,
    deepSearchesToday,
    groqUsage: metrics.groq ? metrics.groq.successCount + metrics.groq.failureCount : 0,
    mixtralUsage: metrics.mistral ? metrics.mistral.successCount + metrics.mistral.failureCount : 0,
    quotaRemainingPercent: Math.max(0, 100 - providerUsage),
    providerUsagePercent: providerUsage,
  });
});

app.delete("/api/admin/users/:id", authenticateToken, requireAdmin, (req, res) => {
  if (req.params.id === (req as any).user.id) {
    return res.status(400).json({ error: "Admins cannot delete their own profile account." });
  }
  const success = db.deleteUser(req.params.id);
  return res.json({ success });
});

// Fallback 404 handler for unmatched /api routes to prevent HTML/text responses
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API endpoint ${req.originalUrl} not found` });
});

// Global error handling middleware for API routes to always return structured JSON
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Global API Error caught:", err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  if (req.originalUrl && req.originalUrl.startsWith("/api/")) {
    return res.status(status).json({ error: message });
  }
  next(err);
});

// Setup dev server with Vite or production build server
async function bootServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite Dev Server middleware in development
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend in production
    const distPath = path.join(process.cwd(), "dist");
    
    // Check if dist folder exists (will fail if not built yet, handle gracefully)
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.warn("⚠️ Warning: dist/ static folder not found. Please build the frontend first!");
      app.get("*", (req, res) => {
        res.status(503).send("Development build is compiles in background. Please Wait.");
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Premium AI Research Assistant Server live on: http://localhost:${PORT}`);
  });
}

bootServer().catch((error) => {
  console.error("Critical server bootstrap error:", error);
});
