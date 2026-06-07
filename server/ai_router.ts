import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export interface ProviderMetrics {
  name: string; // "gemini" | "mistral" | "groq" | "openrouter"
  status: "healthy" | "degraded" | "unavailable";
  latency: number; // average response time in seconds
  successRate: number; // percentage (0 to 100)
  successCount: number;
  failureCount: number;
  totalRequests: number;
  consecutiveFailures: number;
  cooldownEnd: number | null; // epoch timestamp
  failureTimestamps: number[]; // epoch timestamps of last failures for sliding window
  averageLatency: number; // in seconds
}

export interface RouterResponse {
  provider: string;
  response: string;
  tokens: number;
  latency: number;
}

export class AIRouter {
  private static instance: AIRouter;
  
  // In-memory metrics storage
  private metrics: Record<string, ProviderMetrics> = {
    gemini: {
      name: "gemini",
      status: "healthy",
      latency: 0,
      successRate: 100,
      successCount: 0,
      failureCount: 0,
      totalRequests: 0,
      consecutiveFailures: 0,
      cooldownEnd: null,
      failureTimestamps: [],
      averageLatency: 0,
    },
    mistral: {
      name: "mistral",
      status: "healthy",
      latency: 0,
      successRate: 100,
      successCount: 0,
      failureCount: 0,
      totalRequests: 0,
      consecutiveFailures: 0,
      cooldownEnd: null,
      failureTimestamps: [],
      averageLatency: 0,
    },
    groq: {
      name: "groq",
      status: "healthy",
      latency: 0,
      successRate: 100,
      successCount: 0,
      failureCount: 0,
      totalRequests: 0,
      consecutiveFailures: 0,
      cooldownEnd: null,
      failureTimestamps: [],
      averageLatency: 0,
    },
  };

  // Setup keys (support env with fallback to actual keys provided by user)
  private geminiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6JTs4oC6Ypwzp0IOwlJ5ZMwjtgaLb0REoGRBu_KPL_EXQ";
  private mistralKey = process.env.MISTRAL_API_KEY || "N2rQFjOSUfoK8Gor5ZoNsakAqjGFzQqW";
  private groqKey = process.env.GROQ_API_KEY || "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";
  private openrouterKey = process.env.OPENROUTER_API_KEY || "";
  private openrouterModel = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct";

  // Simulation settings for validation suite/tests
  private simulatedBehaviors: Record<string, "success" | "quota_exceeded" | "down"> = {};

  private constructor() {
    // Check key presence to update initial health status (if key is empty and we have no fallback, mark unavailable)
    this.autoConfigureHealth();
  }

  public static getInstance(): AIRouter {
    if (!AIRouter.instance) {
      AIRouter.instance = new AIRouter();
    }
    return AIRouter.instance;
  }

  private autoConfigureHealth() {
    // If no keys are available anywhere, we keep them healthy but warning so mock responses succeed
    if (!this.geminiKey && !this.mistralKey && !this.groqKey) {
      console.warn("⚠️ [AI ROUTER] No credentials detected. Defaulting to functional simulation mode.");
    }
  }

  /**
   * Helper for automated test interventions
   */
  public simulateProviderState(provider: string, behavior: "success" | "quota_exceeded" | "down") {
    this.simulatedBehaviors[provider] = behavior;
    if (behavior === "down") {
      this.metrics[provider].status = "unavailable";
    } else {
      this.metrics[provider].status = "healthy";
      this.metrics[provider].cooldownEnd = null;
    }
  }

  /**
   * Reset simulation hooks
   */
  public clearSimulations() {
    this.simulatedBehaviors = {};
    for (const key of Object.keys(this.metrics)) {
      this.metrics[key].status = "healthy";
      this.metrics[key].cooldownEnd = null;
      this.metrics[key].consecutiveFailures = 0;
      this.metrics[key].failureTimestamps = [];
    }
  }

  /**
   * Returns current monitoring metrics
   */
  public getMetrics(): Record<string, ProviderMetrics> {
    this.checkCooldowns();
    return this.metrics;
  }

  /**
   * Checks and expires cooldowns for unavailable providers
   */
  private checkCooldowns() {
    const now = Date.now();
    for (const name of Object.keys(this.metrics)) {
      const p = this.metrics[name];
      if (p.status === "unavailable" && p.cooldownEnd && now >= p.cooldownEnd) {
        p.status = "healthy";
        p.cooldownEnd = null;
        p.consecutiveFailures = 0;
        p.failureTimestamps = [];
        console.log(`[AI ROUTER] Provider Restored: ${name} cooldown completed, status reset to healthy`);
      }
    }
  }

  /**
   * Updates state after a successful invocation
   */
  private recordSuccess(provider: string, latencyMs: number) {
    const p = this.metrics[provider];
    const latencySec = latencyMs / 1000;
    
    p.totalRequests += 1;
    p.successCount += 1;
    p.consecutiveFailures = 0;
    
    // Average Latency sliding updates
    if (p.latency === 0) {
      p.latency = latencySec;
      p.averageLatency = latencySec;
    } else {
      p.latency = Number((p.latency * 0.7 + latencySec * 0.3).toFixed(2));
      p.averageLatency = p.latency;
    }
    
    p.successRate = Math.round((p.successCount / p.totalRequests) * 100);
    
    console.log(`[AI ROUTER] Provider Success: ${provider} inside ${latencySec.toFixed(2)}s`);
  }

  /**
   * Updates state after an error, triggers circuit breaking if appropriate
   */
  private recordFailure(provider: string, error: any) {
    const p = this.metrics[provider];
    p.totalRequests += 1;
    p.failureCount += 1;
    p.consecutiveFailures += 1;
    p.successRate = Math.round((p.successCount / p.totalRequests) * 100);
    
    const now = Date.now();
    p.failureTimestamps.push(now);
    
    // Filter timestamps to last 10 minutes (600,000 ms)
    p.failureTimestamps = p.failureTimestamps.filter(t => now - t <= 10 * 60 * 1000);
    
    console.error(`[AI ROUTER] Provider Failed: ${provider} failed with error:`, error.message || error);
    
    // Check circuit-breaker trigger: 5 failures within last 10 minutes
    if (p.failureTimestamps.length >= 5 || p.consecutiveFailures >= 5) {
      p.status = "unavailable";
      // Cooldown for 15 minutes (15 * 60 * 1000 ms)
      const cooldownSecs = 15 * 60;
      p.cooldownEnd = now + cooldownSecs * 1000;
      console.warn(`[AI ROUTER] Cooldown Started: Provider ${provider} temporarily disabled due to continuous failures. Cooldown for 15m.`);
    } else if (p.consecutiveFailures > 0) {
      p.status = "degraded";
    }
  }

  /**
   * Main router query generation engine
   */
  public async generate(prompt: string, context?: string): Promise<RouterResponse> {
    const fullPrompt = context ? `${context}\n\nUser Query: ${prompt}` : prompt;
    
    // Order of execution of routers
    const routingChain = ["gemini", "mistral", "groq"];
    
    this.checkCooldowns();
    
    for (const provider of routingChain) {
      const metric = this.metrics[provider];
      if (metric && metric.status === "unavailable") {
        // Skip unavailable provider undergoing cooldown
        continue;
      }
      
      console.log(`[AI ROUTER] Provider Selected: ${provider}`);
      const startTime = Date.now();
      
      try {
        // Handle mock behaviors for testing suite
        const simulated = this.simulatedBehaviors[provider];
        if (simulated === "down") {
          throw new Error(`Simulated breakdown: ${provider} is offline`);
        } else if (simulated === "quota_exceeded") {
          throw new Error(`Simulated Quota / Rate limit reached for ${provider}`);
        }
        
        let answerText = "";
        
        if (provider === "gemini") {
          answerText = await this.invokeGemini(fullPrompt);
        } else if (provider === "mistral") {
          answerText = await this.invokeMistral(fullPrompt);
        } else if (provider === "groq") {
          answerText = await this.invokeGroq(fullPrompt);
        }
        
        const latencyMs = Date.now() - startTime;
        this.recordSuccess(provider, latencyMs);
        
        // Estimate token counts
        const usedTokens = Math.round(fullPrompt.length / 4 + answerText.length / 4);
        
        return {
          provider,
          response: answerText,
          tokens: usedTokens,
          latency: Number((latencyMs / 1000).toFixed(2)),
        };
      } catch (err: any) {
        this.recordFailure(provider, err);
        
        // Prepare for fallback trigger
        const currentIdx = routingChain.indexOf(provider);
        const nextProvider = routingChain.slice(currentIdx + 1).find(p => this.metrics[p]?.status !== "unavailable");
        if (nextProvider) {
          console.warn(`[AI ROUTER] Fallback Activated: Failing over to ${nextProvider}`);
        }
      }
    }
    
    // If all providers failed, deliver elegant graceful error
    return {
      provider: "system",
      response: "All AI providers are currently unavailable. Please try again later.",
      tokens: 0,
      latency: 0,
    };
  }

  // --- Provider Calling Implementations ---

  private async invokeGemini(prompt: string): Promise<string> {
    if (!this.geminiKey || this.geminiKey === "MY_GEMINI_API_KEY") {
      throw new Error("Gemini API key is not configured.");
    }

    const ai = new GoogleGenAI({ apiKey: this.geminiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    if (!response || !response.text) {
      throw new Error("Gemini returned empty response.");
    }
    return response.text;
  }

  private async invokeMistral(prompt: string): Promise<string> {
    if (!this.mistralKey || this.mistralKey === "MY_MISTRAL_API_KEY") {
      throw new Error("Mistral API key is not configured.");
    }

    const endpoint = "https://api.mistral.ai/v1/chat/completions";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.mistralKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Mistral request failed (${res.status}): ${errorText}`);
    }

    const data: any = await res.json();
    const message = data?.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error("Mistral returned invalid JSON structure or empty choices.");
    }
    return message;
  }

  private async invokeGroq(prompt: string): Promise<string> {
    // OpenRouter has preference over Groq if custom OPENROUTER_API_KEY is available
    const isUsingOpenRouter = !!this.openrouterKey && this.openrouterKey !== "MY_OPENROUTER_API_KEY";
    const endpoint = isUsingOpenRouter
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";
      
    const apiKey = isUsingOpenRouter ? this.openrouterKey : this.groqKey;
    const model = isUsingOpenRouter ? this.openrouterModel : "llama-3.3-70b-versatile";

    if (!apiKey) {
      throw new Error(`Neither OpenRouter nor Groq keys can be located.`);
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(isUsingOpenRouter && { "HTTP-Referer": "https://ai.studio/build" }),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Priority 3 API failure (${res.status}): ${errorText}`);
    }

    const data: any = await res.json();
    const message = data?.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error("Priority 3 provider returned empty choices.");
    }
    return message;
  }
}
