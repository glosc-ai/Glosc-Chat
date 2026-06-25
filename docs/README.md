# Glosc Chat 文档中心

本目录是 Glosc Chat 的项目文档入口，覆盖产品范围、设计方案、开发流程和对 open-webui 的参考映射。

Glosc Chat 当前仓库是一个基于 Vue 3、Vite 和 Tauri 2 的可运行移动端优先原型。文档中的能力状态分为三类：

- `已实现`：当前代码仓库中已经存在的能力。
- `MVP`：第一版可用 AI 会话应用应优先完成的能力。
- `规划`：参考 open-webui 后适合后续扩展的能力。

## 文档地图

| 文档 | 用途 | 适合读者 |
| --- | --- | --- |
| [项目文档](./project-documentation.md) | 说明产品定位、目标用户、功能范围、里程碑和风险 | 产品、设计、开发、测试 |
| [设计文档](./design-documentation.md) | 说明信息架构、应用架构、核心模块、数据模型、安全和扩展设计 | 开发、架构、测试 |
| [开发文档](./development-documentation.md) | 说明本地环境、工程结构、开发规范、调试、构建和发布流程 | 开发、测试、维护者 |
| [open-webui 参考映射](./open-webui-reference.md) | 记录从 open-webui 借鉴的方向、取舍和落地建议 | 产品、设计、架构 |

## 当前项目快照

- 项目名称：Glosc Chat
- 当前版本：`0.1.0`
- 当前技术栈：Vue 3、TypeScript、Vite、Tauri 2、Rust
- 当前状态：已实现 OpenAI-compatible、Anthropic、Gemini 和 custom 真实聊天闭环、Provider 配置、安全存储、IndexedDB 会话历史、模型管理、系统提示词、附件输入、会话导出和设置页
- 目标形态：面向 Android 和 iOS 的自带 API Key 多模型 AI 会话应用，同时保留 Tauri 桌面端构建能力

## 参考来源

本文档参考了 open-webui 的公开项目与文档，重点借鉴其多模型接入、会话体验、知识库/RAG、工具扩展和设置体系：

- Open WebUI GitHub: <https://github.com/open-webui/open-webui>
- Open WebUI Docs: <https://docs.openwebui.com/>
- Open WebUI Features: <https://docs.openwebui.com/features/>

Glosc Chat 不直接复制 open-webui 的服务端架构。open-webui 更偏自托管 Web 平台，Glosc Chat 更偏移动端本地应用，因此本文档将参考点转译为移动端优先、本地优先和 BYOK 优先的设计。

## 文档维护规则

1. 修改功能实现时，同步更新项目文档和设计文档中的状态。
2. 新增模块、目录或构建脚本时，同步更新开发文档。
3. 引入外部参考项目时，在参考映射文档中说明借鉴点和不采用的部分。
4. 涉及密钥、隐私、数据同步和远程调用的变更，必须同步更新安全设计。
5. 文档中不要把未实现能力描述为已经上线。
