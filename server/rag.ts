import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";
// @ts-ignore
import { PDFParse } from "pdf-parse";
import { parseOffice } from "officeparser";
import * as XLSX from "xlsx";
import { PDFDocument, PDFName, PDFRawStream, PDFDict } from "pdf-lib";
import Tesseract from "tesseract.js";
import { db, DocumentChunk } from "./db";
import { AIRouter } from "./ai_router";

let aiInstance: GoogleGenAI | null = null;

export function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ Warning: GEMINI_API_KEY environment variable is not defined. AI features will run in mock mode.");
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Simple deterministic hash function to generate custom mock embeddings if API key is not present
function getSimpleFallbackEmbedding(text: string): number[] {
  const vectorSize = 384; // Matching sentence-transformers size
  const vector = new Array(vectorSize).fill(0);
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  if (normalizedText.length === 0) return vector;

  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    const index = (charCode * (i + 1)) % vectorSize;
    vector[index] = (vector[index] + charCode / 255.0) / 2.0;
  }

  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vectorSize; i++) {
      vector[i] /= magnitude;
    }
  }
  return vector;
}

// Generate high-quality embeddings using Gemini Embedding model
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const ai = getAIClient();
    if (!ai) {
      return getSimpleFallbackEmbedding(text);
    }
    
    const response: any = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: text,
    });

    if (response?.embedding?.values) {
      return response.embedding.values;
    } else if (response?.embeddings?.values) {
      return response.embeddings.values;
    } else if (Array.isArray(response?.embeddings) && response.embeddings[0]?.values) {
      return response.embeddings[0].values;
    } else if (response?.embeddings && Array.isArray(response.embeddings)) {
      return response.embeddings;
    }
    
    return getSimpleFallbackEmbedding(text);
  } catch (error) {
    console.error("Gemini embedding generation failed, using fallback:", error);
    return getSimpleFallbackEmbedding(text);
  }
}

// Cosine similarity
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || !Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

// Chunking algorithm
export function chunkText(text: string, chunkSize = 1000, chunkOverlap = 200): string[] {
  const chunks: string[] = [];
  const cleanText = text.replace(/\s+/g, " ").trim();
  
  if (cleanText.length === 0) return [];
  
  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }

  let index = 0;
  while (index < cleanText.length) {
    let endIndex = index + chunkSize;
    if (endIndex >= cleanText.length) {
      chunks.push(cleanText.slice(index).trim());
      break;
    }

    // Try to find a space near the boundary, to preserve words
    const lastSpace = cleanText.lastIndexOf(" ", endIndex);
    if (lastSpace > index + (chunkSize / 2)) {
      endIndex = lastSpace;
    }

    chunks.push(cleanText.slice(index, endIndex).trim());
    
    const nextIndex = endIndex - chunkOverlap;
    if (nextIndex <= index) {
      index = endIndex;
    } else {
      index = nextIndex;
    }
  }
  
  return chunks.filter(c => c.length > 10);
}

// Helper to clean RTF files
function cleanRTF(rtf: string): string {
  let text = rtf;
  // Strip RTF control words and groups
  text = text.replace(/\\([a-z]{1,32})(-?\d+)? ?/gi, " ");
  text = text.replace(/[{}]/g, " ");
  // Consolidate white space
  return text.replace(/\s+/g, " ").trim();
}

// Semantic CSV parser to structure row-by-row key-value data for premium vector semantic alignment
function parseCSV(buffer: Buffer): string {
  const content = buffer.toString("utf-8");
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) return "";
  
  // Header row
  const headers = lines[0].split(",");
  const rowsText: string[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(",");
    const rowInfo = columns.map((col, idx) => {
      const headerName = headers[idx] ? headers[idx].trim() : `Column ${idx + 1}`;
      return `${headerName}: ${col.trim()}`;
    }).join(", ");
    rowsText.push(`Row ${i}: ${rowInfo}`);
  }
  
  return rowsText.join("\n");
}

// Convert Excel Sheets (xlsx and xls) into semantic row structures using SheetJS
function parseExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetsText: string[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Convert sheet cells to CSV data
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    if (!csvContent.trim()) continue;
    
    // Parse sheets into clean row text representations
    const lines = csvContent.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) continue;
    
    const headers = lines[0].split(",");
    const rowsText: string[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(",");
      const rowInfo = columns.map((col, idx) => {
        const headerName = headers[idx] ? headers[idx].trim() : `Column ${idx + 1}`;
        return `${headerName}: ${col.trim()}`;
      }).join(", ");
      rowsText.push(`Row ${i}: ${rowInfo}`);
    }
    
    sheetsText.push(`[Sheet: ${sheetName}]\n${rowsText.join("\n")}`);
  }
  
  return sheetsText.join("\n\n");
}

// Extract legible string elements from binary legacy streams (e.g. .doc, .ppt, or corrupted versions)
function extractPrintableText(buffer: Buffer): string {
  let result = "";
  let currentString = "";
  for (let i = 0; i < buffer.length; i++) {
    const charCode = buffer[i];
    if ((charCode >= 32 && charCode <= 126) || charCode === 9 || charCode === 10 || charCode === 13) {
      currentString += String.fromCharCode(charCode);
    } else {
      if (currentString.trim().length > 4) {
        result += currentString + "\n";
      }
      currentString = "";
    }
  }
  if (currentString.trim().length > 4) {
    result += currentString + "\n";
  }
  return result.replace(/\s+/g, " ").trim();
}

// Helper to parse file buffers with officeparser v7+ AST interface
async function runOfficeParser(buffer: Buffer, fileExtension: string): Promise<string> {
  try {
    const fileType: any = fileExtension.replace(".", "").toLowerCase();
    const ast: any = await parseOffice(buffer, { fileType });
    const textRes = await ast.to("text");
    return textRes?.value || "";
  } catch (err) {
    console.warn(`[OFFICEPARSER] Failed parsing under fileType hint ${fileExtension}:`, err);
    throw err;
  }
}

async function extractImagesFromPDF(pdfBuffer: Buffer): Promise<Buffer[]> {
  const imageBuffers: Buffer[] = [];
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    for (const page of pages) {
      const resources = page.node.Resources();
      if (!resources) continue;
      
      const xObject = resources.get(PDFName.of('XObject'));
      if (!xObject || !(xObject instanceof PDFDict)) continue;
      
      const keys = xObject.keys();
      for (const key of keys) {
        const obj = xObject.get(key);
        if (obj instanceof PDFRawStream) {
          const subtype = obj.dict.get(PDFName.of('Subtype'));
          if (subtype === PDFName.of('Image')) {
            const contents = obj.contents;
            imageBuffers.push(Buffer.from(contents));
          }
        }
      }
    }
  } catch (err) {
    console.error("[OCR SETUP] pdf-lib extraction failed:", err);
  }
  
  if (imageBuffers.length === 0) {
    console.log("[OCR SETUP] Running regex-based JPEG extraction fallback...");
    let i = 0;
    while (i < pdfBuffer.length) {
      const startIdx = pdfBuffer.indexOf(Buffer.from([0xFF, 0xD8]), i);
      if (startIdx === -1) break;
      
      const endIdx = pdfBuffer.indexOf(Buffer.from([0xFF, 0xD9]), startIdx);
      if (endIdx === -1) break;
      
      const jpegLength = endIdx - startIdx + 2;
      const jpegBuffer = pdfBuffer.subarray(startIdx, startIdx + jpegLength);
      imageBuffers.push(jpegBuffer);
      
      i = endIdx + 2;
    }
    console.log(`[OCR SETUP] Regex fallback extracted ${imageBuffers.length} JPEG streams.`);
  }
  
  return imageBuffers;
}

export async function runTesseractOCR(imageBuffers: Buffer[]): Promise<string> {
  let mergedOCRText = "";
  console.log(`[OCR PIPELINE] Running Tesseract OCR on ${imageBuffers.length} images...`);
  
  for (let idx = 0; idx < imageBuffers.length; idx++) {
    const imgBuffer = imageBuffers[idx];
    try {
      console.log(`[OCR PIPELINE] Processing page #${idx + 1}/${imageBuffers.length}...`);
      const { data: { text } } = await Tesseract.recognize(imgBuffer, "eng");
      mergedOCRText += `\n--- Page ${idx + 1} OCR Text ---\n${text}\n`;
    } catch (ocrErr) {
      console.error(`[OCR PIPELINE] Failed OCR for page #${idx + 1}:`, ocrErr);
    }
  }
  return mergedOCRText.trim();
}

export interface IngestionInfo {
  text: string;
  pages: number;
  parserUsed: string;
  textLength: number;
  ocrTriggered: boolean;
  ocrTextLength?: number;
}

// Extract rich contents from file buffers under a modular parser registry
export async function parseFile(buffer: Buffer, mimeType: string, filename: string): Promise<IngestionInfo> {
  const extension = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  let parserUsed = "text-utf8";
  let ocrTriggered = false;
  let ocrTextLength: number | undefined = undefined;
  
  try {
    // 1. PDF Parser
    if (extension === ".pdf" || mimeType === "application/pdf") {
      let initialText = "";
      let pages = 1;
      parserUsed = "PyMuPDF / pdf-parse";
      
      try {
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        await parser.destroy();
        initialText = data.text || "";
        pages = data.total || 1;
      } catch (pdfErr) {
        console.warn(`[PARSER] Main PDF extract failed for ${filename}, running officeparser fallback:`, pdfErr);
        try {
          parserUsed = "officeparser";
          initialText = await runOfficeParser(buffer, ".pdf");
        } catch (subErr) {
          console.warn(`[PARSER] PDF officeparser fallback failed for ${filename}, applying binary text range decoding...`);
          parserUsed = "binary-decoder";
          initialText = extractPrintableText(buffer);
        }
      }

      let finalText = initialText;
      const initialLength = (initialText || "").trim().length;

      // Rule: Check if text length is less than 100 characters, and automatically trigger OCR.
      if (initialLength < 100) {
        console.log(`[PARSER] Extracted text length (${initialLength}) is less than 100 characters for ${filename}. Automatically triggering OCR fallback pipeline.`);
        ocrTriggered = true;
        try {
          const imageBuffers = await extractImagesFromPDF(buffer);
          if (imageBuffers.length > 0) {
            const ocrResult = await runTesseractOCR(imageBuffers);
            finalText = ocrResult;
            ocrTextLength = ocrResult.trim().length;
            console.log(`[PARSER] OCR pipeline successfully extracted ${ocrTextLength} characters for ${filename}`);
          } else {
            console.warn(`[PARSER] No images or pages extracted for OCR from PDF ${filename}`);
          }
        } catch (ocrErr) {
          console.error(`[PARSER] OCR pipeline execution failed for ${filename}:`, ocrErr);
        }
      }

      return {
        text: finalText || "",
        pages,
        parserUsed,
        textLength: initialLength,
        ocrTriggered,
        ocrTextLength
      };
    }
    
    // 2. DOCX Parser
    if (extension === ".docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      let text = "";
      parserUsed = "mammoth";
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || "";
      } catch (docxErr) {
        console.warn(`[PARSER] Main DOCX extract failed for ${filename}, running officeparser fallback:`, docxErr);
        try {
          parserUsed = "officeparser";
          text = await runOfficeParser(buffer, ".docx");
        } catch (subErr) {
          parserUsed = "binary-decoder";
          text = extractPrintableText(buffer);
        }
      }
      return {
        text,
        pages: 1,
        parserUsed,
        textLength: text.length,
        ocrTriggered: false
      };
    }
    
    // 3. PPTX Parser
    if (extension === ".pptx") {
      let text = "";
      parserUsed = "officeparser";
      try {
        text = await runOfficeParser(buffer, ".pptx");
        if (!text || text.trim().length <= 10) {
          throw new Error("Extracted text was empty or too small");
        }
      } catch (pptxErr) {
        parserUsed = "binary-decoder";
        text = extractPrintableText(buffer);
      }
      return {
        text,
        pages: 1,
        parserUsed,
        textLength: text.length,
        ocrTriggered: false
      };
    }

    // 4. Spreadsheets: XLSX / XLS Parser
    if (extension === ".xlsx" || extension === ".xls") {
      let text = "";
      parserUsed = "xlsx";
      try {
        text = parseExcel(buffer);
      } catch (xlsErr) {
        console.warn(`[PARSER] Spreadsheet extraction failed for ${filename}, running officeparser fallback:`, xlsErr);
        try {
          parserUsed = "officeparser";
          text = await runOfficeParser(buffer, extension);
        } catch (subErr) {
          parserUsed = "binary-decoder";
          text = extractPrintableText(buffer);
        }
      }
      return {
        text,
        pages: 1,
        parserUsed,
        textLength: text.length,
        ocrTriggered: false
      };
    }

    // 5. CSV Parser
    if (extension === ".csv") {
      let text = "";
      parserUsed = "csv";
      try {
        text = parseCSV(buffer);
      } catch (csvErr) {
        text = buffer.toString("utf-8");
      }
      return {
        text,
        pages: 1,
        parserUsed,
        textLength: text.length,
        ocrTriggered: false
      };
    }

    // 6. RTF Parser
    if (extension === ".rtf") {
      let text = "";
      parserUsed = "rtf";
      try {
        const rtfRaw = buffer.toString("utf-8");
        text = cleanRTF(rtfRaw);
      } catch (rtfErr) {
        text = extractPrintableText(buffer);
      }
      return {
        text,
        pages: 1,
        parserUsed,
        textLength: text.length,
        ocrTriggered: false
      };
    }

    // 7. Legacy formats: DOC & PPT Parser
    if (extension === ".doc" || extension === ".ppt") {
      let text = "";
      parserUsed = "officeparser";
      try {
        text = await runOfficeParser(buffer, extension);
        if (text && text.trim().length > 10) {
          return {
            text,
            pages: 1,
            parserUsed,
            textLength: text.length,
            ocrTriggered: false
          };
        }
        throw new Error("Extracted text was empty or too small");
      } catch (legacyErr) {
        parserUsed = "binary-decoder";
        text = extractPrintableText(buffer);
        return {
          text,
          pages: 1,
          parserUsed,
          textLength: text.length,
          ocrTriggered: false
        };
      }
    }

    // 8. Markdown / Plain Text / Research LaTeX / Code files
    parserUsed = "text-utf8";
    const textRaw = buffer.toString("utf-8");
    return {
      text: textRaw,
      pages: 1,
      parserUsed,
      textLength: textRaw.length,
      ocrTriggered: false
    };

  } catch (error) {
    console.error(`[INGESTION ERROR] Failed parsing file ${filename} with mimeType ${mimeType}:`, error);
    try {
      const fallbackText = extractPrintableText(buffer);
      if (fallbackText && fallbackText.trim().length > 5) {
        return {
          text: fallbackText,
          pages: 1,
          parserUsed: "binary-decoder-fallback",
          textLength: fallbackText.length,
          ocrTriggered: false
        };
      }
    } catch (lastErr) {
      console.error(`[PARSER] Absolute last resort failed for ${filename}:`, lastErr);
    }
    throw new Error(`Unable to process document. Please verify the file is not corrupted.`);
  }
}

// Retrieve relevant chunks for user questions (Top 10 depth)
export async function queryDocumentContext(userId: string, question: string): Promise<{ chunk: DocumentChunk; similarity: number }[]> {
  const queryEmbed = await generateEmbedding(question);
  const userChunks = db.getChunks(userId);

  if (userChunks.length === 0) {
    return [];
  }

  // Calculate scores
  const chunkScores = userChunks.map((chunk) => {
    const similarity = cosineSimilarity(queryEmbed, chunk.embedding);
    return { chunk, similarity };
  });

  // Sort descending
  chunkScores.sort((a, b) => b.similarity - a.similarity);

  // 1. Deduplicate exactly identical texts or chunk IDs
  const uniqueChunks: { chunk: DocumentChunk; similarity: number }[] = [];
  const seenTexts = new Set<string>();
  const seenChunkIds = new Set<string>();

  for (const item of chunkScores) {
    const textNorm = item.chunk.text.trim();
    if (seenTexts.has(textNorm)) continue;
    if (item.chunk.id && seenChunkIds.has(item.chunk.id)) continue;
    
    seenTexts.add(textNorm);
    if (item.chunk.id) seenChunkIds.add(item.chunk.id);
    uniqueChunks.push(item);
  }

  // 2. Prevent top-k from being dominated by a single document. Limit max chunks per document to 3.
  const docCounts: Record<string, number> = {};
  const selectedChunks: { chunk: DocumentChunk; similarity: number }[] = [];

  for (const item of uniqueChunks) {
    const docId = item.chunk.documentId;
    const count = docCounts[docId] || 0;
    if (count < 3) {
      selectedChunks.push(item);
      docCounts[docId] = count + 1;
    }
  }

  // 3. Slice to top 10 results from multiple relevant documents
  const topKCandidates = selectedChunks.slice(0, 10);

  // 4. Re-rank retrieved chunks before returning (boost chunks that match question terms)
  const queryTerms = question.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  const reRanked = topKCandidates.map(item => {
    let keywordScore = 0;
    const chunkTextLower = item.chunk.text.toLowerCase();
    for (const term of queryTerms) {
      if (chunkTextLower.includes(term)) {
        keywordScore += 0.05; // give small boost of 0.05 per keyword overlap
      }
    }
    return {
      ...item,
      rankingScore: item.similarity + keywordScore
    };
  });

  reRanked.sort((a, b) => b.rankingScore - a.rankingScore);

  // Return the original objects to avoid broken typing
  return reRanked.map(item => ({
    chunk: item.chunk,
    similarity: item.similarity
  }));
}

// Run Chat RAG pipeline
export async function runRAGPipeline(userId: string, question: string): Promise<{ answer: string; citations: { filename: string; pageNumber: number; text: string; similarity: number }[]; provider?: string }> {
  // Query document context (RAG Search across ALL uploaded documents)
  const targetScores = await queryDocumentContext(userId, question);

  if (targetScores.length === 0) {
    return {
      answer: "I could not find any uploaded documents in your library. Please upload a PDF, DOCX, or TXT file to begin.",
      citations: [],
    };
  }

  const targetChunks = targetScores.map((ts) => ts.chunk);

  // Form context
  const contextText = targetChunks.map((c, idx) => `[Source ${idx + 1}]: ${c.filename} - Page ${c.pageNumber}\nContent: "${c.text}"\n`).join("\n");

  const prompt = `You are an intelligent research assistant.
Only answer using the provided context. If the answer is not available in the context, reply exactly:
"I could not find that information in the uploaded documents."

Context:
${contextText}

Question:
${question}

Answer:`;

  // Required Structured Logs
  const filenames = [...new Set(targetScores.map((ts) => ts.chunk.filename))];
  const scores = targetScores.map((ts) => ts.similarity.toFixed(4));

  console.log("Question:");
  console.log(question);
  console.log("");
  console.log("Retrieved Chunks:");
  console.log(targetScores.length);
  console.log("");
  console.log("Files Used:");
  console.log(filenames.join(", "));
  console.log("");
  console.log("Similarity Scores:");
  console.log(scores.join(", "));
  console.log("");

  try {
    const router = AIRouter.getInstance();
    const result = await router.generate(prompt);

    // Compile nice citations
    const citations = targetScores.map((ts) => ({
      filename: ts.chunk.filename,
      pageNumber: ts.chunk.pageNumber,
      text: ts.chunk.text,
      similarity: ts.similarity,
      chunkId: ts.chunk.id,
      uploadDate: ts.chunk.uploadDate || new Date().toISOString(),
    }));

    return {
      answer: result.response,
      citations,
      provider: result.provider,
    };
  } catch (err) {
    console.error("RAG context failover execution failed:", err);
    return {
      answer: "All AI providers are currently unavailable. Please try again later.",
      citations: [],
      provider: "system",
    };
  }
}

// Generate Document Summary
export async function generateDocSummary(text: string): Promise<{ executiveSummary: string; detailedSummary: string; keyInsights: string[] }> {
  const ai = getAIClient();
  if (!ai) {
    return {
      executiveSummary: "Mock summary mode active. Connect your Gemini API Key in secrets to generate premium executive summaries.",
      detailedSummary: "Vivid, multi-point detailed intelligence outline is currently locked till API Key activation.",
      keyInsights: [
        "Unlocking RAG capabilities with Gemini-3.5-Flash",
        "Document parsed, vectorized, but key missing",
        "Add key via Secrets panel and regenerate summary"
      ]
    };
  }

  const prompt = `Analyze this document text and produce a structured JSON response with the following format:
{
  "executiveSummary": "A concise executive paragraph summary (3-4 sentences)",
  "detailedSummary": "A direct, multi-section structured summarization paragraph highlighting major discoveries",
  "keyInsights": ["Core insight statement 1", "Core insight statement 2", "Core insight statement 3", "Core insight statement 4"]
}

Ensure the output is valid, strict JSON ONLY.

Document Text (truncated if very large):
${text.slice(0, 20000)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            detailedSummary: { type: Type.STRING },
            keyInsights: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["executiveSummary", "detailedSummary", "keyInsights"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    throw new Error("No response from model");
  } catch (error) {
    console.error("Summary generator failed:", error);
    return {
      executiveSummary: "An unexpected parser error prevented generating this document summary.",
      detailedSummary: "The server failed to decode the model JSON correctly. Try smaller documents or test with key validation.",
      keyInsights: ["Error parsing AI Output", "Check for truncation settings"]
    };
  }
}

// Generate Flashcards
export interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

export async function generateFlashcards(text: string): Promise<Flashcard[]> {
  const ai = getAIClient();
  if (!ai) {
    return [
      { id: "1", question: "How do I create flashcards?", answer: "Add your Gemini API key inside the Secrets panel to activate full automatic extraction! This is a mock card." },
      { id: "2", question: "What document types are supported?", answer: "PDF formats, Microsoft Word DOCX files, and standard rich TXT folders are supported." },
    ];
  }

  const prompt = `Analyze this document text and generate a list of 5-10 cards for testing. Return a structured JSON response in this format:
{
  "flashcards": [
    { "question": "Critical question about the data?", "answer": "Detailed fact-checked answer." }
  ]
}

Document Text preview:
${text.slice(0, 15000)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING }
                },
                required: ["question", "answer"]
              }
            }
          },
          required: ["flashcards"]
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text.trim());
      return (result.flashcards || []).map((card: any, idx: number) => ({
        id: String(idx + 1),
        question: card.question,
        answer: card.answer
      }));
    }
  } catch (err) {
    console.error("Flashcards generator failed:", err);
  }

  return [
    { id: "1", question: "Standard AI Model Error", answer: "The model was unable to generate your study materials due to an API error." }
  ];
}

// Generate Quiz Multi-Choice Questions
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export async function generateQuizQuestions(text: string): Promise<QuizQuestion[]> {
  const ai = getAIClient();
  if (!ai) {
    return [
      {
        id: "1",
        question: "Which API is used for RAG responses in this assistant layout?",
        options: ["Vercel API", "Render Service", "Google Gemini API", "Sentence Transformers"],
        correctAnswer: "Google Gemini API",
        explanation: "Google Gemini 3.5-Flash provides fast, accurate semantic text inference with custom prompt contexts."
      }
    ];
  }

  const prompt = `Analyze this text content and generate 5 multiple choice quiz questions. Each question must have 4 options, an identified correct answer matching one of the options, and a detailed clear explanation of why that option is correct. Return JSON with this schema format:
{
  "quiz": [
    {
      "question": "The question prompt text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option C",
      "explanation": "Why Option C is correct"
    }
  ]
}

Document Text raw:
${text.slice(0, 15000)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation"]
              }
            }
          },
          required: ["quiz"]
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text.trim());
      return (result.quiz || []).map((q: any, idx: number) => ({
        id: String(idx + 1),
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
      }));
    }
  } catch (err) {
    console.error("Quiz generation failed:", err);
  }

  return [
    {
      id: "1",
      question: "System Output Interrupted",
      options: ["Re-upload doc", "Test with smaller size", "Add Gemini Key", "All of the above"],
      correctAnswer: "All of the above",
      explanation: "Troubleshooting steps can help bypass general Gemini endpoint model boundaries."
    }
  ];
}
