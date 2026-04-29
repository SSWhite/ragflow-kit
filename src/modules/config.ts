// RAGFlow Kit - Config Module
// 负责配置加载、热重载、验证

import { defaultConfig, validateConfig } from "../config/schema";
import { RAGFlowKitConfig } from "../types";
import { isObject, getErrorMessage } from "../utils";

// Re-export defaultConfig and validateConfig from schema
export { defaultConfig, validateConfig } from "../config/schema";

// Config cache for hot reload
let cachedConfig: RAGFlowKitConfig = { ...defaultConfig };
let lastConfigMtime: number = 0;
let lastConfigPath: string = "";

/**
 * Parse ragflow config from openclaw.json
 */
function parseRagflowConfig(userCfg: Record<string, unknown>): RAGFlowKitConfig["ragflow"] {
  const ragflow = isObject(userCfg.ragflow) ? userCfg.ragflow : {};
  return {
    api_url:
      typeof ragflow.api_url === "string" ? ragflow.api_url : defaultConfig.ragflow.api_url,
    api_key:
      typeof ragflow.api_key === "string" ? ragflow.api_key : defaultConfig.ragflow.api_key,
    knowledge_base:
      typeof ragflow.knowledge_base === "string" ? ragflow.knowledge_base : undefined,
  };
}

/**
 * Parse retrieval config from openclaw.json
 */
function parseRetrievalConfig(userCfg: Record<string, unknown>): RAGFlowKitConfig["retrieval"] {
  const retrieval = isObject(userCfg.retrieval) ? userCfg.retrieval : {};
  return {
    chunk_size:
      typeof retrieval.chunk_size === "number"
        ? retrieval.chunk_size
        : defaultConfig.retrieval.chunk_size,
    min_similarity:
      typeof retrieval.min_similarity === "number"
        ? retrieval.min_similarity
        : defaultConfig.retrieval.min_similarity,
  };
}

/**
 * Parse access config from openclaw.json
 */
function parseAccessConfig(userCfg: Record<string, unknown>): RAGFlowKitConfig["access"] {
  const access = isObject(userCfg.access) ? userCfg.access : {};
  return {
    agents: isObject(access.agents)
      ? (access.agents as RAGFlowKitConfig["access"]["agents"])
      : defaultConfig.access.agents,
    teams: isObject(access.teams)
      ? (access.teams as RAGFlowKitConfig["access"]["teams"])
      : defaultConfig.access.teams,
  };
}

/**
 * Hash config to detect changes in api_url or api_key
 */
function hashRagflowConfig(config: RAGFlowKitConfig): string {
  return JSON.stringify({
    api_url: config.ragflow.api_url,
    api_key: config.ragflow.api_key,
    agents: config.access?.agents,
    teams: config.access?.teams,
  });
}

/**
 * Reset KB cache - called when config changes
 */
function resetKbCache(): void {
  try {
    const { resetKbResolver } = require("./query");
    resetKbResolver();
    console.log("[ragflow-kit] KB cache reset due to config change");
  } catch {
    // query module may not be loaded yet
  }
}

/**
 * Load configuration from openclaw.json with hot reload support
 */
export function loadConfig(): RAGFlowKitConfig {
  const openclawHome = process.env.OPENCLAW_HOME || 
    (process.env.HOME ? `${process.env.HOME}/.openclaw` : "/home/node/.openclaw");
  const configPaths = [
    `${openclawHome}/openclaw.json`,
    "/etc/openclaw/openclaw.json",
  ];

  let configPath = "";
  let userCfg: Record<string, unknown> = {};

  for (const path of configPaths) {
    try {
      const fs = require("fs");
      if (fs.existsSync(path)) {
        const stats = fs.statSync(path);
        const mtime = stats.mtimeMs;

        // Check if we need to reload
        if (configPath && mtime === lastConfigMtime && path === lastConfigPath) {
          return cachedConfig;
        }

        const content = fs.readFileSync(path, "utf-8");
        userCfg = JSON.parse(content);
        configPath = path;
        lastConfigMtime = mtime;
        lastConfigPath = path;

        // Extract ragflow-kit specific config from plugins.entries["ragflow-kit"].config
        const pluginConfig = (userCfg as Record<string, unknown>).plugins as Record<string, unknown>;
        const ragflowKitEntry = pluginConfig?.entries as Record<string, unknown>;
        const ragflowKitConfig = ragflowKitEntry?.["ragflow-kit"] as Record<string, unknown>;
        if (ragflowKitConfig?.config) {
          userCfg = ragflowKitConfig.config as Record<string, unknown>;
        }
        break;
      }
    } catch (err) {
      console.log(`[ragflow-kit] Error reading config from ${path}:`, getErrorMessage(err));
    }
  }

  const newConfig: RAGFlowKitConfig = {
    ragflow: parseRagflowConfig(userCfg),
    retrieval: parseRetrievalConfig(userCfg),
    access: parseAccessConfig(userCfg),
  };

  // Check if critical config changed
  const newHash = hashRagflowConfig(newConfig);
  const oldHash = hashRagflowConfig(cachedConfig);

  if (cachedConfig && newHash !== oldHash) {
    console.log("[ragflow-kit] Config changed, resetting KB cache");
    resetKbCache();
  }

  cachedConfig = newConfig;
  return newConfig;
}
