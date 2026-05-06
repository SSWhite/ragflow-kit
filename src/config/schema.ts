// RAGFlow Kit - Config Schema
// 负责配置默认值、验证

import { AgentAccess, TeamAccess } from "../types";

/**
 * Default configuration values
 */
export const defaultConfig = {
  ragflow: {
    api_url: "",
    api_key: "",
  },
  retrieval: {
    chunk_size: 6,
    min_similarity: 0.2,
  },
  access: {
    agents: {
      "main": { search_kbs: [], upload_kbs: [], delete_kbs: [] } as AgentAccess,
    },
    teams: {} as Record<string, TeamAccess>,
  },
};

/**
 * Validate the configuration and return errors if invalid
 */
export function validateConfig(config: {
  ragflow: { api_url: string; api_key: string };
  retrieval: { chunk_size?: number; min_similarity?: number };
  access?: {
    agents?: Record<string, AgentAccess>;
    teams?: Record<string, TeamAccess>;
  };
}): string[] {
  const errors: string[] = [];

  if (!config.ragflow.api_url) {
    errors.push("ragflow.api_url is required");
  } else {
    try {
      new URL(config.ragflow.api_url);
    } catch {
      errors.push("ragflow.api_url is not a valid URL");
    }
  }

  if (!config.ragflow.api_key) {
    errors.push("ragflow.api_key is required");
  }

  if (config.retrieval.chunk_size !== undefined &&
    (config.retrieval.chunk_size < 1 || config.retrieval.chunk_size > 100)) {
    errors.push("retrieval.chunk_size must be between 1 and 100");
  }

  if (config.retrieval.min_similarity !== undefined &&
    (config.retrieval.min_similarity < 0 || config.retrieval.min_similarity > 1)) {
    errors.push("retrieval.min_similarity must be between 0 and 1");
  }

  return errors;
}
