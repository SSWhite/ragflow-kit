// RAGFlow Kit - Upload Module
// 负责文件上传到知识库

import { RAGFlowKitConfig, PluginContext, ToolResult } from "../types";
import { normalizeUrl } from "../utils";
import { ensureKbResolverDirect, getAvailableKbs, hasPermission } from "./query";

/**
 * Delete a document from a knowledge base
 */
export async function deleteFile(
  apiUrl: string,
  apiKey: string,
  kbName: string,
  documentId: string,
  config: RAGFlowKitConfig,
  ctx: PluginContext
): Promise<ToolResult> {
  // Ensure KB resolver is called first to populate kbNameToId cache
  await ensureKbResolverDirect(apiUrl, apiKey);

  // Get KB ID from name
  const availableKbs = getAvailableKbs(config, ctx);
  const targetKb = availableKbs.find((kb) => kb.name === kbName);

  if (!targetKb) {
    return {
      content: [
        {
          type: "text",
          text: `Knowledge base "${kbName}" not found or not accessible. Use rag_upload without parameters to see available knowledge bases.`,
        },
      ],
    };
  }

  // Check delete permission
  if (!hasPermission(config, ctx, "delete", targetKb.id)) {
    return {
      content: [
        {
          type: "text",
          text: `Permission denied: agent does not have delete permission on knowledge base "${kbName}".`,
        },
      ],
    };
  }

  try {
    // RAGFlow delete API: DELETE /api/v1/datasets/{kb_id}/documents
    const deleteUrl = normalizeUrl(apiUrl) + "api/v1/datasets/" + targetKb.id + "/documents";

    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: [documentId] }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { code: number; message?: string };

    if (data.code !== 0) {
      throw new Error(data.message || "Delete failed");
    }

    return {
      content: [
        {
          type: "text",
          text: `Document "${documentId}" deleted successfully from knowledge base "${kbName}".`,
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: "Delete failed: " + (err instanceof Error ? err.message : String(err)),
        },
      ],
    };
  }
}

/**
 * Upload file to a knowledge base using multipart/form-data
 */
export async function uploadFile(
  apiUrl: string,
  apiKey: string,
  kbName: string,
  fileName: string,
  fileContent: string,
  config: RAGFlowKitConfig,
  ctx: PluginContext
): Promise<ToolResult> {
  // Ensure KB resolver is called first to populate kbNameToId cache
  await ensureKbResolverDirect(apiUrl, apiKey);

  // Get KB ID from name
  const availableKbs = getAvailableKbs(config, ctx);
  const targetKb = availableKbs.find((kb) => kb.name === kbName);

  if (!targetKb) {
    return {
      content: [
        {
          type: "text",
          text: `Knowledge base "${kbName}" not found or not accessible. Use rag_upload without parameters to see available knowledge bases.`,
        },
      ],
    };
  }

  // Check upload permission
  if (!hasPermission(config, ctx, "upload", targetKb.id)) {
    return {
      content: [
        {
          type: "text",
          text: `Permission denied: agent does not have upload permission on knowledge base "${kbName}".`,
        },
      ],
    };
  }

  try {
    // RAGFlow upload API: POST /v1/document/upload
    // Uses multipart/form-data
    const normalizedUrl = normalizeUrl(apiUrl) + "v1/document/upload";

    const formData = new FormData();
    formData.append("kb_id", targetKb.id);
    formData.append("file", new Blob([fileContent], { type: "text/plain" }), fileName);

    const response = await fetch(normalizedUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
      },
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { code: number; message?: string; data?: Array<{ id: string; name: string }> };

    if (data.code !== 0) {
      throw new Error(data.message || "Upload failed");
    }

    const docId = data.data?.[0]?.id || "unknown";

    // Trigger document parsing after upload
    // RAGFlow API: POST /api/v1/datasets/{kb_id}/chunks with document_ids
    try {
      const parseUrl = normalizeUrl(apiUrl) + "api/v1/datasets/" + targetKb.id + "/chunks";
      const parseResponse = await fetch(parseUrl, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ document_ids: [docId] }),
        signal: AbortSignal.timeout(10000),
      });

      if (parseResponse.ok) {
        console.log("[ragflow-kit] Document parsing started for:", docId);
      } else {
        console.log("[ragflow-kit] Document parsing trigger failed:", parseResponse.status);
      }
    } catch (parseErr) {
      console.log("[ragflow-kit] Document parsing trigger error:", parseErr instanceof Error ? parseErr.message : String(parseErr));
    }

    return {
      content: [
        {
          type: "text",
          text: `File "${fileName}" uploaded successfully to knowledge base "${kbName}".\nDocument ID: ${docId}\nParsing started automatically.`,
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: "Upload failed: " + (err instanceof Error ? err.message : String(err)),
        },
      ],
    };
  }
}
