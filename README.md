[English](./README.md) | [中文](./README_CN.md)

# RAGFlow Kit

> RAGFlow Knowledge Base Retrieval Plugin for OpenClaw


---

## Overview

RAGFlow Kit is an OpenClaw plugin that enables agents to search, upload, and delete documents in RAGFlow knowledge bases through natural language queries. It supports per-agent and per-team access control with fine-grained permissions.

## Features

- **Knowledge Base Search** — Query RAGFlow knowledge bases using natural language
- **Document Upload** — Upload text files to knowledge bases with auto-parsing
- **Document Delete** — Delete documents from knowledge bases
- **Access Control** — Configure which agents can search / upload / delete on which knowledge bases
- **Team Support** — Manage knowledge base permissions by teams
- **Similarity Filtering** — Filter search results by minimum similarity threshold
- **Hot Reload** — Configuration changes take effect without restarting OpenClaw

## Tools

| Tool | Description |
|------|-------------|
| `rag_search` | Search documents in configured knowledge bases |
| `rag_upload` | Upload files to a knowledge base (auto-triggers parsing) |
| `rag_delete` | Delete a document from a knowledge base |

---


## Installation

### Install via OpenClaw CLI

```bash
openclaw plugins install clawhub:ragflow-kit
```

### Build from source

```bash
# Clone the repository
git clone https://github.com/SSWhite/ragflow-kit.git
cd ragflow-kit

# Install dependencies and build
npm install
npm run build

# Install to OpenClaw plugins directory
openclaw plugins install ./
```

---

## Configuration

Edit your OpenClaw configuration file (`openclaw.json`):

```json
{
  "plugins": {
    "entries": {
      "ragflow-kit": {
        "enabled": true,
        "config": {
          "ragflow": {
            "api_url": "https://your-ragflow-server.com",
            "api_key": "your-api-key-here"
          },
          "retrieval": {
            "chunk_size": 6,
            "min_similarity": 0.2
          },
          "access": {
            "agents": {
              "main": {
                "search_kbs": ["kb_name_1"],
                "upload_kbs": ["kb_name_1"],
                "delete_kbs": ["kb_name_1"]
              }
            },
            "teams": {
              "team_alpha": {
                "search_agents": ["agent_id_1", "agent_id_2"],
                "search_kbs": ["shared_kb"],
                "upload_agents": ["agent_id_1"],
                "upload_kbs": ["shared_kb"],
                "delete_agents": [],
                "delete_kbs": []
              }
            }
          }
        }
      }
    }
  }
}
```

### Configuration Reference

#### `ragflow` — RAGFlow connection

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `api_url` | string | Yes | — | RAGFlow server URL |
| `api_key` | string | Yes | — | RAGFlow API key |
| `knowledge_base` | string | No | — | Default knowledge base name |

#### `retrieval` — Search behavior

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `chunk_size` | number | No | `6` | Maximum number of chunks to return |
| `min_similarity` | number | No | `0.2` | Minimum similarity threshold (0–1) |

#### `access` — Permission control

| Field | Type | Description |
|-------|------|-------------|
| `access.agents` | object | Map of `agentId → AgentAccess` |
| `access.teams` | object | Map of `teamId → TeamAccess` |

**`AgentAccess` structure:**

```ts
{
  search_kbs: string[];   // KB names/IDs this agent can search
  upload_kbs: string[];    // KB names/IDs this agent can upload to
  delete_kbs: string[];   // KB names/IDs this agent can delete from
}
```

**`TeamAccess` structure:**

```ts
{
  search_agents: string[];  // Agent IDs in this team (for search)
  search_kbs: string[];     // KB names/IDs this team can search
  upload_agents: string[]; // Agent IDs in this team (for upload)
  upload_kbs: string[];    // KB names/IDs this team can upload
  delete_agents: string[];// Agent IDs in this team (for delete)
  delete_kbs: string[];    // KB names/IDs this team can delete
}
```

---

## Usage

### rag_search

Search for relevant documents in configured knowledge bases.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query text |

**Example:**

```json
{
  "tool": "rag_search",
  "params": {
    "query": "What is the company policy on remote work?"
  }
}
```

**Response format:**

```json
{
  "content": [{
    "type": "text",
    "text": "{...JSON with chunks...}\n\n[Provenance Requirements]\nYou must cite sources using [X] format..."
  }]
}
```

---

### rag_upload

Upload a text file to a knowledge base. Triggers parsing automatically.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `kb_name` | string | Yes | Target knowledge base name |
| `file_name` | string | Yes | File name |
| `file_content` | string | Yes | File content (text) |

**Example:**

```json
{
  "tool": "rag_upload",
  "params": {
    "kb_name": "company-policies",
    "file_name": "remote-work.txt",
    "file_content": "Remote work policy content here..."
  }
}
```

**Without parameters** — lists all available knowledge bases for the agent.

---

### rag_delete

Delete a document from a knowledge base.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `kb_name` | string | Yes | Knowledge base name |
| `document_id` | string | Yes | Document ID to delete |

**Example:**

```json
{
  "tool": "rag_delete",
  "params": {
    "kb_name": "company-policies",
    "document_id": "doc-xxx-123"
  }
}
```

---

## File Structure

```
ragflow-kit/
├── src/
│   ├── index.ts           # Plugin entry, registers three tools
│   ├── modules/
│   │   ├── auth.ts        # RAGFlowClient HTTP client
│   │   ├── query.ts       # Search logic, permissions, KB resolver
│   │   ├── upload.ts      # Upload & delete file operations
│   │   └── config.ts      # Config loading & hot reload
│   ├── config/
│   │   └── schema.ts      # Default values & validation
│   ├── types/
│   │   └── index.ts       # TypeScript type definitions
│   └── utils/
│       └── index.ts       # normalizeUrl, buildResultText, etc.
├── dist/                  # Compiled JavaScript (published to npm)
├── openclaw.plugin.json   # Plugin manifest
├── package.json
├── tsconfig.json
└── README.md
```

---

## Architecture Notes

### KB Name → ID Resolution

Knowledge base names are resolved to IDs lazily on first use and cached (max 100 entries). The cache is cleared when `api_url`, `api_key`, or access credentials change.

### Hot Reload

Config is reloaded on every tool call (not at startup). If the config file is modified, changes take effect on the next tool call without restarting OpenClaw.

### Permission Merging

Agent-level and team-level permissions are merged. A KB is accessible if **any** permission source grants access (union, not intersection).

---

## License

MIT License
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
