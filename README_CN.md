# RAGFlow Kit

> RAGFlow 知识库检索插件 for OpenClaw


---

## 简介

RAGFlow Kit 是 OpenClaw 的插件，使 Agent 能够通过自然语言对 RAGFlow 知识库进行搜索、上传和删除文档。支持按 Agent 和按团队进行细粒度权限控制。

## 功能

- **知识库检索** — 使用自然语言查询 RAGFlow 知识库
- **文档上传** — 上传文本文件到知识库，自动触发解析
- **文档删除** — 从知识库删除文档
- **访问控制** — 配置哪些 Agent 可以搜索 / 上传 / 删除哪些知识库
- **团队支持** — 按团队管理知识库权限
- **相似度过滤** — 按最低相似度阈值过滤搜索结果
- **热重载** — 修改配置后无需重启 OpenClaw

## 工具

| 工具 | 说明 |
|------|------|
| `rag_search` | 在已配置的知识库中搜索文档 |
| `rag_upload` | 上传文件到知识库（自动触发解析） |
## 安装

### 通过 OpenClaw 命令安装

```bash
openclaw plugins install clawhub:ragflow-kit
```

### 从源码编译安装

```bash
# 克隆仓库
git clone https://github.com/SSWhite/ragflow-kit.git
cd ragflow-kit

# 安装依赖并编译
npm install
npm run build

# 安装到 OpenClaw 插件目录
openclaw plugins install ./
```

---

## 配置
编辑 OpenClaw 配置文件（`openclaw.json`）：

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
            "min_similarity": 0.6
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

### 配置说明

#### `ragflow` — RAGFlow 连接

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `api_url` | string | 是 | — | RAGFlow 服务器地址 |
| `api_key` | string | 是 | — | RAGFlow API 密钥 |
| `knowledge_base` | string | 否 | — | 默认知识库名称 |

#### `retrieval` — 检索行为

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `chunk_size` | number | 否 | `6` | 最大返回片段数量 |
| `min_similarity` | number | 否 | `0.6` | 最低相似度阈值（0–1） |

#### `access` — 权限控制

| 字段 | 类型 | 说明 |
|------|------|------|
| `access.agents` | object | Agent ID → AgentAccess 的映射 |
| `access.teams` | object | Team ID → TeamAccess 的映射 |

**`AgentAccess` 结构：**

```ts
{
  search_kbs: string[];   // 该 Agent 可搜索的知识库名称/ID
  upload_kbs: string[];    // 该 Agent 可上传的知识库名称/ID
  delete_kbs: string[];   // 该 Agent 可删除的知识库名称/ID
}
```

**`TeamAccess` 结构：**

```ts
{
  search_agents: string[];  // 该团队中可搜索的 Agent ID 列表
  search_kbs: string[];    // 该团队可搜索的知识库名称/ID
  upload_agents: string[]; // 该团队中可上传的 Agent ID 列表
  upload_kbs: string[];    // 该团队可上传的知识库
  delete_agents: string[];// 该团队中可删除的 Agent ID 列表
  delete_kbs: string[];    // 该团队可删除的知识库
}
```

---

## 使用方法

### rag_search

在已配置的知识库中搜索相关文档。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | 搜索查询文本 |

**示例：**

```json
{
  "tool": "rag_search",
  "params": {
    "query": "公司远程办公政策是什么？"
  }
}
```

**响应格式：**

```json
{
  "content": [{
    "type": "text",
    "text": "{...JSON 格式的片段数据...}\n\n[Provenance Requirements]\nYou must cite sources using [X] format..."
  }]
}
```

---

### rag_upload

上传文本文件到知识库，自动触发解析。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `kb_name` | string | 是 | 目标知识库名称 |
| `file_name` | string | 是 | 文件名 |
| `file_content` | string | 是 | 文件内容（文本） |

**示例：**

```json
{
  "tool": "rag_upload",
  "params": {
    "kb_name": "company-policies",
    "file_name": "remote-work.txt",
    "file_content": "远程办公政策内容..."
  }
}
```

**不带参数调用** — 列出当前 Agent 可用的所有知识库。

---

### rag_delete

从知识库删除文档。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `kb_name` | string | 是 | 知识库名称 |
| `document_id` | string | 是 | 要删除的文档 ID |

**示例：**

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

## 项目结构

```
ragflow-kit/
├── src/
│   ├── index.ts           # 插件入口，注册三个工具
│   ├── modules/
│   │   ├── auth.ts        # RAGFlowClient HTTP 客户端
│   │   ├── query.ts       # 检索逻辑、权限判断、KB 名称解析
│   │   ├── upload.ts      # 文件上传与删除
│   │   └── config.ts      # 配置加载与热重载
│   ├── config/
│   │   └── schema.ts      # 默认值与验证逻辑
│   ├── types/
│   │   └── index.ts       # TypeScript 类型定义
│   └── utils/
│       └── index.ts        # normalizeUrl、buildResultText 等工具函数
├── dist/                  # 编译后的 JavaScript（发布到 npm）
├── openclaw.plugin.json   # 插件清单
├── package.json
├── tsconfig.json
└── README.md
```

---


## 架构说明

### KB 名称 → ID 解析

知识库名称在首次使用时懒解析为 ID 并缓存（最多 100 条）。当 `api_url`、`api_key` 或访问凭证发生变化时，缓存会被清除。

### 热重载

配置在每次工具调用时重新加载（而非启动时）。修改配置文件后，下一次工具调用即生效，无需重启 OpenClaw。

### 权限合并

Agent 级和团队级权限会合并计算。只要**任意**权限来源授予了访问权限，该 KB 即视为可访问（取并集而非交集）。

---

## 许可证

MIT License
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
