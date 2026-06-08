// API Service interface for client-server operations in AI Research Assistant

const originalFetch = window.fetch;
const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let res: Response;
  try {
    res = await originalFetch(input, init);
  } catch (err: any) {
    if (err?.message && (err.message.includes("Failed to fetch") || err.message.includes("Load failed"))) {
      throw new Error("Network / CORS block: Unable to connect to backend. Please ensure your backend is awake and CORS headers are valid.");
    }
    throw err;
  }
  
  const originalJson = res.json.bind(res);
  const originalText = res.text.bind(res);
  
  res.json = async () => {
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        return await originalJson();
      } catch (err) {
        console.error("JSON parsing failed, falling back to text", err);
      }
    }
    
    const text = await originalText();
    if (text.includes("<!DOCTYPE html>") || text.includes("<html") || res.status === 404) {
      return { error: `Unexpected HTML/404 response (Status ${res.status}). Please verify that your VITE_API_URL is correctly configured in Vercel to point to your Render backend URL.` };
    }
    return { error: text.slice(0, 200) || `Server returned Status ${res.status}` };
  };
  
  return res;
};

const getApiUrl = (): string => {
  const url = ((import.meta as any).env?.VITE_API_URL as string) || "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
};

export const api = {
  // Auth Module
  async register(payload: any) {
    const res = await fetch(`${getApiUrl()}/api/register`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");
    return data;
  },

  async login(payload: any) {
    const res = await fetch(`${getApiUrl()}/api/login`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    return data;
  },

  async getMe() {
    const res = await fetch(`${getApiUrl()}/api/me`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Authentication failed");
    return data;
  },

  // Document Module
  async getDocuments() {
    const res = await fetch(`${getApiUrl()}/api/documents`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load documents");
    return data;
  },

  async uploadDocuments(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const res = await fetch(`${getApiUrl()}/api/upload`, {
      method: "POST",
      headers: getHeaders(true),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data;
  },

  async renameDocument(id: string, filename: string) {
    const res = await fetch(`${getApiUrl()}/api/documents/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ filename }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Rename failed");
    return data;
  },

  async deleteDocument(id: string) {
    const res = await fetch(`${getApiUrl()}/api/documents/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Delete failed");
    return data;
  },

  // Chat RAG Module
  async sendMessage(message: string, sessionId?: string) {
    const res = await fetch(`${getApiUrl()}/api/chat`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ message, sessionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Fail to retrieve answer");
    return data;
  },

  async getHistory() {
    const res = await fetch(`${getApiUrl()}/api/history`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load chat logs");
    return data;
  },

  async deleteSession(id: string) {
    const res = await fetch(`${getApiUrl()}/api/history/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Delete chat failure");
    return data;
  },

  // AI Utilities Module
  async getSummary(documentId: string) {
    const res = await fetch(`${getApiUrl()}/api/summary/${documentId}`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Summary compilation failed");
    return data;
  },

  async getFlashcards(documentId: string) {
    const res = await fetch(`${getApiUrl()}/api/flashcards/${documentId}`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to generate study flashcards");
    return data;
  },

  async getQuiz(documentId: string) {
    const res = await fetch(`${getApiUrl()}/api/quiz/${documentId}`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to compile quiz session");
    return data;
  },

  // Global Keyword & Semantic Search
  async searchAcrossDocs(query: string) {
    const res = await fetch(`${getApiUrl()}/api/search?q=${encodeURIComponent(query)}`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Global search failed");
    return data;
  },

  // Analytics Module
  async getAnalytics() {
    const res = await fetch(`${getApiUrl()}/api/analytics`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to poll analytics dashboard");
    return data;
  },

  async getRouterAnalytics() {
    const res = await fetch(`${getApiUrl()}/api/router-analytics`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch router metrics");
    return data;
  },

  // Admin APIs (Guard-protected)
  async adminGetUsers() {
    const res = await fetch(`${getApiUrl()}/api/admin/users`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unauthorized access code");
    return data;
  },

  async adminGetDocuments() {
    const res = await fetch(`${getApiUrl()}/api/admin/documents`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unauthorized access code");
    return data;
  },

  async adminGetChatLogs() {
    const res = await fetch(`${getApiUrl()}/api/admin/chat-logs`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unauthorized access code");
    return data;
  },

  async adminDeleteUser(id: string) {
    const res = await fetch(`${getApiUrl()}/api/admin/users/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete user profile");
    return data;
  },

  async adminGetAnalytics() {
    const res = await fetch(`${getApiUrl()}/api/admin/analytics`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load admin analytics");
    return data;
  },

  async getLimits() {
    const res = await fetch(`${getApiUrl()}/api/limits`, {
      method: "GET",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load usage limits");
    return data;
  },

  async adminUpdateProviderUsage(percent: number) {
    const res = await fetch(`${getApiUrl()}/api/admin/provider-usage`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ percent }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to simulate provider capacity ratio");
    return data;
  },
};
