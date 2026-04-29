// RAGFlow Knowledge Base Retrieval Plugin for OpenClaw

import { loadConfig, validateConfig } from "./modules/config";
import { RAGFlowClient } from "./modules/auth";
import { performSearch, getAvailableKbs } from "./modules/query";
import { uploadFile, deleteFile } from "./modules/upload";
import { PluginContext, ToolResult } from "./types";

export { register };

// ============ Plugin Registration ============

function register(api: { registerTool: (handler: (ctx: PluginContext) => any) => void }): void {
  // Load initial config
  const initialConfig = loadConfig();
  const validationErrors = validateConfig(initialConfig);

  if (validationErrors.length > 0) {
    console.warn("[ragflow-kit] ⚠ Config validation failed:");
    validationErrors.forEach((err) => {
      console.warn(`  ${err}`);
    });
  }

  // Register rag_search tool
  api.registerTool((ctx: PluginContext) => {
    return {
      name: "rag_search",
      description:
        "RAGFlow document retrieval tool. Cite sources using [X] format and list references at the end.\n[X] Document name | Page X",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
      async execute(_id: string, params: { query?: string }): Promise<ToolResult> {
        const query = params.query || "";

        if (!query) {
          return { content: [{ type: "text", text: "query cannot be empty" }] };
        }

        // Hot reload config on each tool call
        const config = loadConfig();
        const client = new RAGFlowClient(config);

        return performSearch(client, query, config, ctx);
      },
    };
  });

  // Register rag_upload tool
  api.registerTool((ctx: PluginContext) => {
    return {
      name: "rag_upload",
      description:
        "Upload files to RAGFlow knowledge bases. Without parameters, returns available knowledge bases.",
      parameters: {
        type: "object",
        properties: {
          kb_name: { type: "string", description: "Knowledge base name to upload to" },
          file_name: { type: "string", description: "File name" },
          file_content: { type: "string", description: "File content (text)" },
        },
      },
      async execute(_id: string, params: { kb_name?: string; file_name?: string; file_content?: string }): Promise<ToolResult> {
        const { kb_name, file_name, file_content } = params;

        // Hot reload config on each tool call
        const config = loadConfig();

        // If no parameters, return available KBs (deduplicated by ID)
        if (!kb_name && !file_name && !file_content) {
          const availableKbs = getAvailableKbs(config, ctx);

          // Deduplicate KBs by ID (same KB may appear via agents and teams)
          const uniqueKbs = Array.from(
            new Map(availableKbs.map((kb) => [kb.id, kb])).values()
          );

          if (uniqueKbs.length === 0) {
            return {
              content: [{ type: "text", text: "No knowledge bases available for this agent." }],
            };
          }

          const list = uniqueKbs
            .map((kb, i) => `[${i + 1}] ${kb.name} (ID: ${kb.id})`)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `Available Knowledge Bases:\n\n${list}\n\nTo upload a file, use:\nrag_upload kb_name="knowledge_base_name" file_name="example.txt" file_content="content here"`,
              },
            ],
          };
        }

        // If kb_name provided but no file info, it's an error
        if (kb_name && (!file_name || !file_content)) {
          return {
            content: [{ type: "text", text: "Both file_name and file_content are required when uploading" }],
          };
        }

        return uploadFile(
          config.ragflow.api_url,
          config.ragflow.api_key,
          kb_name!,
          file_name!,
          file_content!,
          config,
          ctx
        );
      },
    };
  });

  // Register rag_delete tool
  api.registerTool((ctx: PluginContext) => {
    return {
      name: "rag_delete",
      description:
        "Delete documents from RAGFlow knowledge bases. Use rag_delete kb_name='kb_name' document_id='doc_id' to delete.",
      parameters: {
        type: "object",
        properties: {
          kb_name: { type: "string", description: "Knowledge base name" },
          document_id: { type: "string", description: "Document ID to delete" },
        },
        required: ["kb_name", "document_id"],
      },
      async execute(_id: string, params: { kb_name: string; document_id: string }): Promise<ToolResult> {
        // Hot reload config on each tool call
        const config = loadConfig();

        return deleteFile(
          config.ragflow.api_url,
          config.ragflow.api_key,
          params.kb_name,
          params.document_id,
          config,
          ctx
        );
      },
    };
  });

  console.log("[ragflow-kit] ✓ Registered: rag_search, rag_upload, rag_delete");
}
