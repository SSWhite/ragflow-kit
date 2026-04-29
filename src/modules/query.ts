// RAGFlow Kit - Query Module
// 负责知识库检索

import { RAGFlowClient } from "./auth";
import {
  RAGFlowKitConfig,
  PluginContext,
  ToolResult,
  ChunkData,
  ChunkRetrievalResponse,
  KbListResponse,
} from "../types";
import { buildResultText, normalizeUrl } from "../utils";

const KB_CACHE_MAX_SIZE = 100;
const DEFAULT_TIMEOUT_MS = 30000;

// KB name -> ID resolver (lazy loading, with cache limit)
let kbNameToId: Map<string, string> = new Map();
let kbResolverDone = false;

/**
 * Operation types for permission checking
 */
export type OperationType = "search" | "upload" | "delete";

/**
 * Merged permission result for all operations
 */
export interface MergedPermissions {
  search: string[];
  upload: string[];
  delete: string[];
}

/**
 * Get all allowed KB IDs for all operations in a single pass
 * Merges agent and team permissions
 */
export function getMergedPermissions(
  config: RAGFlowKitConfig,
  ctx: PluginContext
): MergedPermissions {
  const agentId = ctx?.agentId || "unknown";
  const searchKbs = new Set<string>();
  const uploadKbs = new Set<string>();
  const deleteKbs = new Set<string>();

  // Helper to add KB (name -> ID resolved)
  const addKb = (kb: string, set: Set<string>) => {
    if (kbNameToId.has(kb)) {
      set.add(kbNameToId.get(kb)!);
    } else {
      set.add(kb);
    }
  };

  // From direct agent access
  const agentAccess = config.access?.agents?.[agentId];
  if (agentAccess) {
    if (Array.isArray(agentAccess.search_kbs)) {
      for (const kb of agentAccess.search_kbs) addKb(kb, searchKbs);
    }
    if (Array.isArray(agentAccess.upload_kbs)) {
      for (const kb of agentAccess.upload_kbs) addKb(kb, uploadKbs);
    }
    if (Array.isArray(agentAccess.delete_kbs)) {
      for (const kb of agentAccess.delete_kbs) addKb(kb, deleteKbs);
    }
  }

  // From teams - merge permissions in single pass
  const teams = config.access?.teams || {};
  for (const team of Object.values(teams)) {
    if (!team) continue;

    // Search permission
    if (Array.isArray(team.search_agents) && team.search_agents.includes(agentId)) {
      if (Array.isArray(team.search_kbs)) {
        for (const kb of team.search_kbs) addKb(kb, searchKbs);
      }
    }
    // Upload permission
    if (Array.isArray(team.upload_agents) && team.upload_agents.includes(agentId)) {
      if (Array.isArray(team.upload_kbs)) {
        for (const kb of team.upload_kbs) addKb(kb, uploadKbs);
      }
    }
    // Delete permission
    if (Array.isArray(team.delete_agents) && team.delete_agents.includes(agentId)) {
      if (Array.isArray(team.delete_kbs)) {
        for (const kb of team.delete_kbs) addKb(kb, deleteKbs);
      }
    }
  }

  return {
    search: Array.from(searchKbs),
    upload: Array.from(uploadKbs),
    delete: Array.from(deleteKbs),
  };
}

/**
 * Get allowed KB IDs for a specific operation (uses merged permissions internally)
 */
export function getAllowedKbIds(
  config: RAGFlowKitConfig,
  ctx: PluginContext,
  operation: OperationType
): string[] {
  const perms = getMergedPermissions(config, ctx);
  return perms[operation];
}

/**
 * Check if agent has permission for a specific operation on a specific KB
 */
export function hasPermission(
  config: RAGFlowKitConfig,
  ctx: PluginContext,
  operation: OperationType,
  kbIdOrName: string
): boolean {
  const allowedKbs = getAllowedKbIds(config, ctx, operation);
  // Fast path: direct ID match
  if (allowedKbs.includes(kbIdOrName)) return true;
  // Resolve name to ID and check
  const resolvedId = kbNameToId.get(kbIdOrName);
  return resolvedId ? allowedKbs.includes(resolvedId) : false;
}

/**
 * Reset KB resolver cache - called when config changes
 */
export function resetKbResolver(): void {
  kbNameToId.clear();
  kbResolverDone = false;
  console.log("[ragflow-kit] KB resolver cache reset");
}

/**
 * Fetch KB list from RAGFlow API
 */
async function fetchKbList(apiUrl: string, apiKey: string): Promise<void> {
  const url = apiUrl + "v1/kb/list";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as KbListResponse;

  if (data.code === 0 && data.data && Array.isArray(data.data.kbs)) {
    // Clear old cache if getting too big
    if (kbNameToId.size > KB_CACHE_MAX_SIZE) {
      kbNameToId.clear();
    }

    for (const kb of data.data.kbs) {
      if (typeof kb.name === "string" && typeof kb.id === "string") {
        kbNameToId.set(kb.name, kb.id);
      }
    }
    console.log("[ragflow-kit] KB resolver ready, cached:", kbNameToId.size);
  }
}

/**
 * Resolve KB names to IDs using RAGFlow API
 */
export async function ensureKbResolver(client: RAGFlowClient): Promise<void> {
  console.log("[ragflow-kit] ensureKbResolver called, kbResolverDone=", kbResolverDone);
  if (kbResolverDone) {
    console.log("[ragflow-kit] KB resolver already done, skipping");
    return;
  }

  try {
    await fetchKbList(client.getApiUrl(), client.getApiKey());
  } catch (err) {
    console.log("[ragflow-kit] KB resolver failed:", err instanceof Error ? err.message : String(err));
  }

  kbResolverDone = true;
  console.log("[ragflow-kit] KB resolver completed, cached KBs:", kbNameToId.size);
}

/**
 * Resolve KB names to IDs using RAGFlow API (direct parameters version)
 */
export async function ensureKbResolverDirect(apiUrl: string, apiKey: string): Promise<void> {
  console.log("[ragflow-kit] ensureKbResolverDirect called, kbResolverDone=", kbResolverDone);
  if (kbResolverDone) {
    console.log("[ragflow-kit] KB resolver already done, skipping");
    return;
  }

  try {
    const normalizedUrl = normalizeUrl(apiUrl);
    await fetchKbList(normalizedUrl, apiKey);
  } catch (err) {
    console.log("[ragflow-kit] KB resolver failed:", err instanceof Error ? err.message : String(err));
  }

  kbResolverDone = true;
  console.log("[ragflow-kit] KB resolver completed, cached KBs:", kbNameToId.size);
}

/**
 * Get available knowledge bases for an agent (for listing)
 */
export function getAvailableKbs(config: RAGFlowKitConfig, ctx: PluginContext): Array<{ name: string; id: string }> {
  // Single pass: get all permissions merged
  const perms = getMergedPermissions(config, ctx);
  const allKbIds = new Set([...perms.search, ...perms.upload, ...perms.delete]);
  const result: Array<{ name: string; id: string }> = [];

  for (const [name, id] of kbNameToId.entries()) {
    if (allKbIds.has(id)) {
      result.push({ name, id });
    }
  }

  // Also include KBs that are IDs directly (not resolved)
  const seenIds = new Set(result.map((k) => k.id));
  for (const kbId of allKbIds) {
    if (!seenIds.has(kbId)) {
      result.push({ name: kbId, id: kbId });
    }
  }

  return result;
}

/**
 * Perform knowledge base search
 */
export async function performSearch(
  client: RAGFlowClient,
  query: string,
  config: RAGFlowKitConfig,
  ctx: PluginContext
): Promise<ToolResult> {
  await ensureKbResolver(client);

  const agentKbs = getAllowedKbIds(config, ctx, "search");

  if (!agentKbs || agentKbs.length === 0) {
    console.log("[ragflow-kit] tool: no KBs for agent:", ctx?.agentId || "unknown");
    return {
      content: [{ type: "text", text: "Agent has no knowledge bases configured" }],
    };
  }

  const allChunksFromAllKBs: ChunkData[] = [];

  try {
    for (const kbId of agentKbs) {
      try {
        const data = await client.request<ChunkRetrievalResponse>("v1/chunk/retrieval_test", {
          body: {
            kb_id: kbId,
            question: query,
            size: config.retrieval.chunk_size,
          },
        });

        // Skip KBs that haven't been parsed yet (code 100 with KeyError)
        if (data.code === 100) {
          console.log("[ragflow-kit] KB", kbId, "not parsed yet, skipping");
          continue;
        }

        if (data.code !== 0) {
          throw new Error(data.message || "RAGFlow API error");
        }

        allChunksFromAllKBs.push(...(data.data?.chunks ?? []));
        console.log("[ragflow-kit] KB", kbId, "returned", (data.data?.chunks ?? []).length, "chunks");
      } catch (kbErr) {
        const msg = kbErr instanceof Error ? kbErr.message : String(kbErr);
        if (msg.includes("KeyError") || msg.includes("not parsed")) {
          console.log("[ragflow-kit] KB", kbId, "not ready, skipping:", msg);
          continue;
        }
        throw kbErr;
      }
    }

    // Filter by similarity
    const filtered = allChunksFromAllKBs.filter(
      (c) => (c.similarity ?? 0) >= config.retrieval.min_similarity
    );

    // Dedupe by chunk_id
    const seen = new Set<string>();
    const unique = filtered.filter((c) => {
      if (seen.has(c.chunk_id)) return false;
      seen.add(c.chunk_id);
      return true;
    });

    // Sort by similarity descending
    unique.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    const ragflowChunks = unique.slice(0, config.retrieval.chunk_size);

    if (ragflowChunks.length === 0) {
      return {
        content: [{ type: "text", text: "No relevant documents found." }],
      };
    }

    // Add KB name to each chunk
    const idToKbName = new Map<string, string>();
    for (const [name, id] of kbNameToId.entries()) {
      idToKbName.set(id, name);
    }
    const chunksWithKbName = ragflowChunks.map((c) => ({
      ...c,
      kb_name: idToKbName.get(c.kb_id || "") || c.kb_id || "Unknown",
    }));

    return {
      content: [
        {
          type: "text",
          text: buildResultText(chunksWithKbName),
        },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: "RAG retrieval failed: " + (err instanceof Error ? err.message : String(err)) }],
    };
  }
}
