import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: "user" | "admin";
}

export interface IngestionReport {
  userId?: string;
  user_id?: string;
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
  userId: string;
  user_id?: string;
  size: number;
  hash?: string;
  ingestionReport?: IngestionReport;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  userId: string;
  user_id?: string;
  filename: string;
  text: string;
  pageNumber: number;
  embedding: number[];
  chunkId?: string;
  uploadDate?: string;
  metadata?: {
    user_id: string;
    filename: string;
    document_id: string;
    pageNumber?: number;
    chunkId?: string;
    uploadDate?: string;
  };
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
  provider?: string;
  userId?: string;
  user_id?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  user_id?: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export interface SearchQueryLog {
  id: string;
  userId: string;
  query: string;
  timestamp: string;
  resultsCount: number;
}

export interface DailyUsageRecord {
  user_id: string;
  date: string;
  semantic_queries_used: number;
  deep_searches_used: number;
  credits_used: number;
  storage_used: number;
}

interface DatabaseSchema {
  users: User[];
  documents: DocumentRecord[];
  chunks: DocumentChunk[];
  chats: ChatSession[];
  searchLogs: SearchQueryLog[];
  dailyUsage: DailyUsageRecord[];
  providerUsagePercent: number;
  analytics: {
    uploadsCount: number;
    chatsCount: number;
    queriesCount: number;
    searchesCount: number;
    userActiveMap: Record<string, string[]>; // dateStr -> array of userIds
  };
}

const DB_PATH = path.join(process.cwd(), "server_db.json");

class LocalDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.data = {
      users: [],
      documents: [],
      chunks: [],
      chats: [],
      searchLogs: [],
      dailyUsage: [],
      providerUsagePercent: 45,
      analytics: {
        uploadsCount: 0,
        chatsCount: 0,
        queriesCount: 0,
        searchesCount: 0,
        userActiveMap: {},
      },
    };
    this.load();
    this.seedAdminIfNeeded();
  }

  private load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, "utf-8");
        this.data = JSON.parse(fileContent);
        // Ensure defaults if keys are missing
        if (!this.data.users) this.data.users = [];
        if (!this.data.documents) this.data.documents = [];
        if (!this.data.chunks) this.data.chunks = [];
        if (!this.data.chats) this.data.chats = [];
        if (!this.data.searchLogs) this.data.searchLogs = [];
        if (!this.data.dailyUsage) this.data.dailyUsage = [];
        if (this.data.providerUsagePercent === undefined) this.data.providerUsagePercent = 45;
        if (!this.data.analytics) {
          this.data.analytics = {
            uploadsCount: 0,
            chatsCount: 0,
            queriesCount: 0,
            searchesCount: 0,
            userActiveMap: {},
          };
        }
      } else {
        this.save();
      }
    } catch (error) {
      console.error("Failed to load local database, initializing fresh:", error);
    }
  }

  public save() {
    try {
      // Ensure the parent split exists
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to persist local database:", error);
    }
  }

  private seedAdminIfNeeded() {
    const adminEmail = "admin@assistant.com";
    const existingAdmin = this.data.users.find((u) => u.email === adminEmail);
    if (!existingAdmin) {
      const passwordHash = crypto.createHash("sha256").update("admin123").digest("hex");
      const adminUser: User = {
        id: "admin-system-id",
        email: adminEmail,
        passwordHash,
        name: "System Admin",
        role: "admin",
      };
      this.data.users.push(adminUser);
      this.save();
      console.log("Seeded system admin user: admin@assistant.com / admin123");
    }
  }

  // --- Users ---
  public getUsers(): User[] {
    return this.data.users;
  }

  public getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public createUser(user: Omit<User, "id">): User {
    const newUser: User = {
      ...user,
      id: crypto.randomUUID(),
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  public deleteUser(id: string): boolean {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    // Cascade delete user documents, chunks, and chats
    this.data.documents = this.data.documents.filter((d) => d.userId !== id);
    this.data.chunks = this.data.chunks.filter((c) => c.userId !== id);
    this.data.chats = this.data.chats.filter((ch) => ch.userId !== id);
    this.save();
    return this.data.users.length < initialLen;
  }

  // --- Documents ---
  public getDocuments(userId?: string): DocumentRecord[] {
    if (userId) {
      return this.data.documents.filter((d) => d.userId === userId);
    }
    return this.data.documents;
  }

  public getDocumentById(id: string): DocumentRecord | undefined {
    return this.data.documents.find((d) => d.id === id);
  }

  public createDocument(doc: Omit<DocumentRecord, "id">): DocumentRecord {
    const newDoc: DocumentRecord = {
      ...doc,
      id: crypto.randomUUID(),
      user_id: doc.userId,
    };
    if (newDoc.ingestionReport) {
      newDoc.ingestionReport.userId = newDoc.userId;
      newDoc.ingestionReport.user_id = newDoc.userId;
    }
    this.data.documents.push(newDoc);
    this.data.analytics.uploadsCount += 1;
    this.save();
    return newDoc;
  }

  public renameDocument(id: string, newFilename: string): boolean {
    const doc = this.getDocumentById(id);
    if (doc) {
      doc.filename = newFilename;
      // also update in chunk list
      this.data.chunks.forEach((c) => {
        if (c.documentId === id) {
          c.filename = newFilename;
        }
      });
      this.save();
      return true;
    }
    return false;
  }

  public deleteDocument(id: string): boolean {
    const initialLen = this.data.documents.length;
    this.data.documents = this.data.documents.filter((d) => d.id !== id);
    this.data.chunks = this.data.chunks.filter((c) => c.documentId !== id);
    this.save();
    return this.data.documents.length < initialLen;
  }

  // --- Chunks for RAG ---
  public getChunks(userId?: string, queryOptions?: { where?: { user_id?: string; document_id?: string } }): DocumentChunk[] {
    let rawChunks = this.data.chunks;
    
    // Simulate ChromaDB user-aware retrieval query matching options
    if (queryOptions?.where) {
      const { user_id, document_id } = queryOptions.where;
      rawChunks = rawChunks.filter((c) => {
        const meta = c.metadata;
        if (user_id && meta?.user_id !== user_id) return false;
        if (document_id && meta?.document_id !== document_id) return false;
        return true;
      });
    } else if (userId) {
      // Direct user-isolation filter mapping
      rawChunks = rawChunks.filter((c) => c.userId === userId || c.metadata?.user_id === userId);
    }
    
    return rawChunks.map((c) => ({
      ...c,
      embedding: c.embedding || [],
    }));
  }

  public addChunks(chunks: DocumentChunk[]) {
    this.data.chunks.push(...chunks);
    this.save();
  }

  // --- Chats ---
  public getChatSessions(userId: string): ChatSession[] {
    return this.data.chats.filter((c) => c.userId === userId).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getChatSessionById(id: string): ChatSession | undefined {
    return this.data.chats.find((c) => c.id === id);
  }

  public createChatSession(userId: string, title?: string): ChatSession {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      userId,
      user_id: userId,
      title: title || "New Research Chat",
      createdAt: new Date().toISOString(),
      messages: [],
    };
    this.data.chats.push(newSession);
    this.data.analytics.chatsCount += 1;
    this.save();
    return newSession;
  }

  public addChatMessage(sessionId: string, message: Omit<ChatMessage, "id" | "timestamp"> & { id?: string }): ChatMessage {
    const session = this.getChatSessionById(sessionId);
    if (!session) {
      throw new Error(`Chat session ${sessionId} not found`);
    }
    const newMessage: ChatMessage = {
      id: message.id || crypto.randomUUID(),
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString(),
      citations: message.citations,
      provider: message.provider,
      userId: session.userId,
      user_id: session.userId,
    };
    session.messages.push(newMessage);
    if (message.role === "user") {
      this.data.analytics.queriesCount += 1;
    }
    this.save();
    return newMessage;
  }

  public deleteChatSession(id: string): boolean {
    const initialLen = this.data.chats.length;
    this.data.chats = this.data.chats.filter((c) => c.id !== id);
    this.save();
    return this.data.chats.length < initialLen;
  }

  // --- Search Logs ---
  public logSearch(userId: string, query: string, resultsCount: number) {
    const searchLog: SearchQueryLog = {
      id: crypto.randomUUID(),
      userId,
      query,
      timestamp: new Date().toISOString(),
      resultsCount,
    };
    this.data.searchLogs.push(searchLog);
    this.data.analytics.searchesCount += 1;
    this.save();
  }

  public getSearchLogs(): SearchQueryLog[] {
    return this.data.searchLogs;
  }

  // --- Analytics & Tracking ---
  public trackUserActivity(userId: string) {
    const today = new Date().toISOString().split("T")[0];
    if (!this.data.analytics.userActiveMap) {
      this.data.analytics.userActiveMap = {};
    }
    if (!this.data.analytics.userActiveMap[today]) {
      this.data.analytics.userActiveMap[today] = [];
    }
    if (!this.data.analytics.userActiveMap[today].includes(userId)) {
      this.data.analytics.userActiveMap[today].push(userId);
      this.save();
    }
  }

  public getSystemAnalytics(userId?: string) {
    const totalUsers = this.data.users.length;
    
    // Filter documents, chats, and search logs by user for full segregation
    const userDocs = userId 
      ? this.data.documents.filter(d => d.userId === userId)
      : this.data.documents;
      
    const userChats = userId
      ? this.data.chats.filter(c => c.userId === userId)
      : this.data.chats;
      
    const userSearchLogs = userId
      ? this.data.searchLogs.filter(s => s.userId === userId)
      : this.data.searchLogs;

    const totalDocs = userDocs.length;
    const totalChats = userChats.length;
    
    // Calculate total queries inside active user sessions only
    const totalQueries = userId
      ? userChats.reduce((sum, c) => sum + c.messages.filter(m => m.role === "user").length, 0)
      : this.data.analytics.queriesCount;
      
    const totalSearches = userSearchLogs.length;
    
    // calculate total storage (using sizes of docs)
    const totalStorageBytes = userDocs.reduce((sum, d) => sum + d.size, 0);

    // active users over past 7 days
    const activeUsers7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const count = this.data.analytics.userActiveMap?.[dateStr]?.length || 0;
      activeUsers7Days.push({ date: dateStr, count });
    }

    return {
      totals: {
        users: totalUsers,
        documents: totalDocs,
        chats: totalChats,
        queries: totalQueries,
        searches: totalSearches,
        storageBytes: totalStorageBytes,
      },
      activeUsersDaily: activeUsers7Days,
      recentUploads: userDocs.slice(-5).reverse(),
      recentQueries: userChats.map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        messageCount: c.messages.length
      })).slice(-5).reverse(),
    };
  }

  // --- Daily Usage and Quota Trackers ---
  public getDailyUsage(userId: string): DailyUsageRecord {
    const today = new Date().toISOString().split("T")[0];
    if (!this.data.dailyUsage) {
      this.data.dailyUsage = [];
    }
    let record = this.data.dailyUsage.find(r => r.user_id === userId && r.date === today);
    if (!record) {
      const userDocs = this.getDocuments(userId);
      const storageUsed = userDocs.reduce((sum, d) => sum + d.size, 0);
      record = {
        user_id: userId,
        date: today,
        semantic_queries_used: 0,
        deep_searches_used: 0,
        credits_used: 0,
        storage_used: storageUsed,
      };
      this.data.dailyUsage.push(record);
      this.save();
    } else {
      const userDocs = this.getDocuments(userId);
      record.storage_used = userDocs.reduce((sum, d) => sum + d.size, 0);
    }
    return record;
  }

  public saveUsageRecord(record: DailyUsageRecord): void {
    if (!this.data.dailyUsage) {
      this.data.dailyUsage = [];
    }
    const idx = this.data.dailyUsage.findIndex(r => r.user_id === record.user_id && r.date === record.date);
    if (idx !== -1) {
      this.data.dailyUsage[idx] = record;
    } else {
      this.data.dailyUsage.push(record);
    }
    this.save();
  }

  public getProviderUsagePercent(): number {
    if (this.data.providerUsagePercent === undefined) {
      this.data.providerUsagePercent = 45;
    }
    return this.data.providerUsagePercent;
  }

  public setProviderUsagePercent(percent: number): void {
    this.data.providerUsagePercent = Math.max(0, Math.min(100, percent));
    this.save();
  }

  public getDailyUsageRecords(): DailyUsageRecord[] {
    if (!this.data.dailyUsage) {
      this.data.dailyUsage = [];
    }
    return this.data.dailyUsage;
  }
}

export const db = new LocalDatabase();
