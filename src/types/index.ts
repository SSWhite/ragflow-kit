// RAGFlow Kit - Shared Types

export interface RagFlowConfig {
  api_url: string;
  api_key: string;
  knowledge_base?: string;
}

export interface RetrievalConfig {
  chunk_size: number;
  min_similarity: number;
}

export interface AgentAccess {
  search_kbs: string[];
  upload_kbs: string[];
  delete_kbs: string[];
}

export interface TeamAccess {
  search_agents: string[];
  upload_agents: string[];
  delete_agents: string[];
  search_kbs: string[];
  upload_kbs: string[];
  delete_kbs: string[];
}

export interface AccessConfig {
  agents: {
    [agentId: string]: AgentAccess;
  };
  teams: {
    [teamId: string]: TeamAccess;
  };
}

export interface RAGFlowKitConfig {
  ragflow: RagFlowConfig;
  retrieval: RetrievalConfig;
  access: AccessConfig;
}

export interface ChunkData {
  chunk_id: string;
  // RAGFlow API fields
  docnm_kwd?: string;        // Document name (RAGFlow field)
  content_ltks?: string;     // Content (RAGFlow field)
  content_with_weight?: string; // Alternative content field
  kb_id?: string;           // Knowledge base ID (RAGFlow field)
  // Optional fields
  document_name?: string;    // Alias for compatibility
  content?: string;          // Alias for compatibility
  location?: unknown;
  page_number?: number;
  pos_text?: string;
  similarity?: number;
  vector?: number[];
}

export interface ToolResult {
  content: { type: string; text: string }[];
}

export interface PluginContext {
  agentId?: string;
}

// RAGFlow API response types
export interface KbListResponse {
  code: number;
  data?: {
    kbs?: Array<{ name: string; id: string }>;
  };
}

export interface ChunkRetrievalResponse {
  code: number;
  message?: string;
  data?: {
    chunks?: ChunkData[];
  };
}

export interface KbCreateResponse {
  code: number;
  data?: {
    kb_id: string;
  };
  message?: string;
}

export interface UploadResponse {
  code: number;
  data?: {
    document_id: string;
    name: string;
  };
  message?: string;
}
