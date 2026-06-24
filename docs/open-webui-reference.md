# open-webui 参考映射

## 1. 参考目的

open-webui 是一个成熟的开源 AI Web UI 项目，适合作为 Glosc Chat 的产品能力参考。本文档记录哪些能力值得借鉴、哪些能力不适合照搬，以及如何转译到 Glosc Chat 的移动端优先架构中。

参考来源：

- GitHub: <https://github.com/open-webui/open-webui>
- Docs: <https://docs.openwebui.com/>
- Features: <https://docs.openwebui.com/features/>

## 2. 项目差异

| 维度 | open-webui | Glosc Chat |
| --- | --- | --- |
| 主要形态 | 自托管 Web 平台 | 移动端优先 AI 客户端 |
| 部署方式 | 服务端部署 | 本地应用，后续可移动端发布 |
| 用户模式 | 支持多人和管理能力 | 个人 BYOK 优先 |
| 数据存储 | 服务端数据库为主 | 本地存储为主 |
| 模型连接 | 面向多模型和兼容接口 | 先做 OpenAI-compatible，再扩展 |
| 高级能力 | 知识库、工具、函数、权限等 | 按移动端价值逐步引入 |

## 3. 可借鉴能力

| open-webui 能力方向 | 对 Glosc Chat 的启发 | 建议落地 |
| --- | --- | --- |
| 多模型统一入口 | 用户不应在不同 App 间切换模型 | 设计 Provider Adapter 和 Model Registry |
| OpenAI-compatible 兼容 | 兼容接口能覆盖大量模型网关 | MVP 优先支持 OpenAI-compatible |
| 会话管理 | 长期使用需要历史、搜索、归档 | MVP 保存本地会话，V1 增加搜索和导出 |
| 知识库/RAG | 用户希望用自己的资料对话 | 规划阶段预留 KnowledgeSource 和 RetrievalResult |
| 工具/函数调用 | 模型能力可通过外部工具增强 | 先定义 ToolDefinition，后续再开放执行 |
| 设置体系 | 模型、参数、隐私、界面需要集中管理 | 设置页拆分为模型、数据、安全、外观 |
| 响应式 UI | AI 对话需要适配不同屏幕 | 移动端单列优先，桌面端可三栏 |
| 管理和权限 | 对团队有价值 | 短期不做完整后台，仅支持配置导入 |

## 4. 不直接照搬的部分

### 4.1 多人后台

open-webui 的多人管理、角色和后台能力适合自托管平台。Glosc Chat MVP 面向个人移动端使用，不应先建设用户系统和管理后台。

替代方案：

- 本地用户设置。
- Provider 配置导入导出。
- 后续如果需要团队能力，再设计团队配置文件或私有同步服务。

### 4.2 服务端数据库架构

open-webui 的服务端架构不适合作为 Glosc Chat 的第一架构。移动端客户端应优先解决本地数据库、安全存储和离线可用。

替代方案：

- 本地 SQLite 或 IndexedDB。
- 系统安全存储保存 API Key。
- 同步作为独立模块，而不是默认服务端依赖。

### 4.3 完整插件市场

插件生态需要安全模型、权限模型、审核机制和兼容承诺。Glosc Chat 初期不应将插件市场作为核心路线。

替代方案：

- 先支持内置工具。
- 再支持受限的本地工具定义。
- 最后再考虑插件分发。

### 4.4 复杂 RAG 管线

知识库能力有价值，但会引入解析、分块、嵌入、索引、引用和同步复杂度。它不应阻塞基础聊天能力。

替代方案：

- MVP 只预留数据模型和 UI 入口。
- V1 后做本地文件导入和轻量检索。
- 稳定后再做多知识库和高级引用。

## 5. 能力映射路线

### 5.1 MVP

| 目标 | 参考 open-webui | Glosc Chat 实现方式 |
| --- | --- | --- |
| 可配置模型 | 模型连接和设置体系 | Provider 配置页 |
| 可持续聊天 | Chat UI 和历史会话 | 本地 Conversation/Message 存储 |
| 流式输出 | Chat completion streaming | Provider Adapter 输出 AsyncIterable |
| 基础参数 | 模型参数配置 | 温度、max tokens、system prompt |

### 5.2 V1

| 目标 | 参考 open-webui | Glosc Chat 实现方式 |
| --- | --- | --- |
| 多供应商 | 多模型入口 | Provider Registry |
| 提示词模板 | Workspace/Prompt 类能力 | 本地 Prompt Template |
| 附件输入 | 多模态/文件能力 | 按模型能力启用附件 |
| 会话导出 | 数据管理 | Markdown/JSON 导出 |

### 5.3 V2+

| 目标 | 参考 open-webui | Glosc Chat 实现方式 |
| --- | --- | --- |
| 知识库 | Knowledge/RAG | 本地文档索引和引用展示 |
| 工具调用 | Tools/Functions | 受控 ToolDefinition 和授权执行 |
| 同步 | 平台化数据管理 | 端到端加密同步或文件同步 |
| 团队配置 | Admin/Workspace 思路 | 可导入组织 Provider 配置 |

## 6. 设计决策记录

### DDR-001：MVP 优先 OpenAI-compatible

决策：MVP 只强制支持 OpenAI-compatible Provider。

原因：

- 覆盖范围大。
- 请求和流式响应模型相对统一。
- 用户容易理解 Base URL、API Key 和模型名。
- 可以为其他供应商适配打样。

影响：

- Anthropic、Gemini 等原生接口延后。
- Provider Adapter 必须设计为可扩展，避免和 OpenAI payload 绑死。

### DDR-002：本地优先，不默认服务端

决策：Glosc Chat 不在 MVP 中建设服务端。

原因：

- 产品定位是个人移动端客户端。
- BYOK 模式下服务端托管密钥会增加安全和信任成本。
- 当前仓库技术栈更适合先完成本地应用闭环。

影响：

- 同步、团队管理和远程知识库延后。
- 本地存储和安全存储需要尽早设计。

### DDR-003：高级能力预留接口，不阻塞聊天闭环

决策：RAG、工具调用和插件只在设计上预留，不进入 MVP 必需范围。

原因：

- 基础聊天质量决定产品可用性。
- 高级能力复杂，过早实现会拖慢发布。
- 清晰接口足以避免后续大规模返工。

影响：

- 数据模型保留 `KnowledgeSource`、`ToolDefinition` 等扩展概念。
- UI 可以预留入口，但默认隐藏或标注为后续能力。

## 7. 检查清单

从 open-webui 借鉴能力时，逐项检查：

- 这项能力是否适合个人移动端？
- 是否需要服务端才能稳定实现？
- 是否会让 API Key 或会话内容离开本机？
- 是否会显著增加 MVP 复杂度？
- 是否可以通过接口预留而不是立即实现？
- 是否有清晰的失败状态和用户恢复路径？

只有同时满足移动端价值明确、隐私边界清晰、实现成本可控的能力，才应进入近期版本。
