export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
}

export interface IngestionReport {
  parserUsed: string;
  textLength: number;
  ocrTriggered: boolean;
  ocrTextLength?: number;
  chunksCreated: number;
  embeddingsCreated: number;
  status: "success" | "failed" | string;
  testQuerySuccess?: boolean;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  mimeType: string;
  uploadDate: string;
  size: number;
  ingestionReport?: IngestionReport;
}

export interface Citation {
  filename: string;
  pageNumber: number;
  text: string;
  similarity?: number;
  chunkId?: string;
  uploadDate?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  citations?: Citation[];
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface SearchResult {
  filename: string;
  documentId: string;
  pageNumber: number;
  text: string;
  score: number;
}

export interface AnalyticsSummary {
  totals: {
    users: number;
    documents: number;
    chats: number;
    queries: number;
    searches: number;
    storageBytes: number;
  };
  activeUsersDaily: { date: string; count: number }[];
  recentUploads: DocumentRecord[];
  recentQueries: { id: string; title: string; createdAt: string; messageCount: number }[];
}
