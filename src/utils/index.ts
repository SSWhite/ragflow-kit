// RAGFlow Kit - Utilities

/**
 * Normalize URL to ensure it ends with a single slash
 */
export function normalizeUrl(baseUrl: string): string {
  const url = baseUrl.trim();
  if (!url) return url;
  return url.replace(/\/+$/, "") + "/";
}

/**
 * Check if a value is a valid object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Safe error message extractor
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

/**
 * Build the result text from chunks
 * Matches old version format with JSON + provenance
 */
export function buildResultText(chunks: Array<{
  docnm_kwd?: string;
  document_name?: string;
  page_number?: number;
  positions?: number[][];
  similarity?: number;
  content_ltks?: string;
  content_with_weight?: string;
  content?: string;
  kb_name?: string;
}>): string {
  if (chunks.length === 0) {
    return "(No results found)";
  }

  // Build JSON output (matching old version format)
  const docJson = JSON.stringify(
    {
      total: chunks.length,
      chunks: chunks.map((c, i) => ({
        id: i + 1,
        knowledge_base: c.kb_name || "Unknown",
        document_name: c.docnm_kwd || c.document_name || "Unknown document",
        page_number: c.positions?.[0]?.[0],
        line_no: c.positions?.[0]?.[1],
        similarity: c.similarity ?? 0,
        content: c.content_with_weight || c.content_ltks || c.content || "",
      })),
    },
    null,
    2
  );

  // Build reference list
  const references = chunks
    .map((c, i) => {
      const kbName = c.kb_name || "Unknown";
      const docName = c.docnm_kwd || c.document_name || "Unknown document";
      const pageNum = c.positions?.[0]?.[0];
      const refText = pageNum !== undefined
        ? kbName + " | " + docName + " | Page " + pageNum
        : kbName + " | " + docName;
      return `  [${i + 1}] ${refText}`;
    })
    .join("\n");

  const provenanceInstruction = `
[Provenance Requirements]
You must cite sources using [X] format in your answer. Each citation corresponds to a number in the document list above.
Only list references you actually used in your answer. Do not list unused references.
At the end of your answer, **you must list a complete "References" section. Use the original format from the output below. If there are web links, you must include them. If not, do not add them.** Format as follows:

References:
${references}`;

  return docJson + provenanceInstruction;
}
