// RAGFlow Kit - Auth Module
// 负责 API 认证、URL 规范化、超时控制

import { RAGFlowKitConfig } from "../types";
import { normalizeUrl } from "../utils";

const DEFAULT_TIMEOUT_MS = 30000;

export class RAGFlowClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(config: RAGFlowKitConfig) {
    this.apiUrl = normalizeUrl(config.ragflow.api_url);
    this.apiKey = config.ragflow.api_key;
  }

  /**
   * Make an authenticated request to RAGFlow API
   */
  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: Record<string, unknown>;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const { method = "POST", body, timeout = DEFAULT_TIMEOUT_MS } = options;

    const url = this.apiUrl + path;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: "Bearer " + this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get the base API URL
   */
  getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Get the API key
   */
  getApiKey(): string {
    return this.apiKey;
  }
}
