# Glosc Chat

Glosc Chat 是一款移动端优先、本地优先的多模型 AI 聊天客户端。你可以接入自己已有的 OpenAI-compatible、Anthropic、Gemini 或自定义模型服务，在一个应用里统一聊天、切换模型、管理会话和导出数据。

它采用 BYOK 模式，也就是由你自己提供 API Key。应用不托管你的密钥，会话和配置默认保存在本机，适合希望自己掌控模型来源、密钥和历史数据的用户。

## 适合谁

- 想在手机上使用多个 AI 模型，并快速切换的用户。
- 已经拥有模型服务 API Key，希望使用统一聊天客户端的用户。
- 使用 OpenAI-compatible 网关、本地模型代理或企业内部模型 API 的技术用户。
- 需要长期保留会话、整理提示词、导出聊天内容的创作者和重度 AI 用户。

## 你可以做什么

- 添加多个 Provider，并为每个 Provider 配置 API 地址、API Key 和模型。
- 使用 OpenAI-compatible、Anthropic、Gemini 或自定义 Provider 发起真实流式对话。
- 在聊天中停止生成、重试回复、复制消息、引用消息或删除消息。
- 管理会话历史，包括搜索、置顶、归档、删除和 Markdown 导出。
- 为当前会话设置系统提示词、上下文消息数量和常用提示词模板变量。
- 上传文本、Markdown、JSON 或图片附件，让支持的模型结合附件内容回复。
- 通过 JSON 导入导出本地数据，便于备份和恢复。

## 数据与隐私

Glosc Chat 的默认设计是本地优先：

- 会话、消息、模型配置和偏好设置保存在本机。
- API Key 通过 Tauri/Rust 接入系统安全存储，不写入普通本地数据库。
- 导出的 JSON 数据不包含 API Key，只保留密钥引用和遮罩信息。
- 应用不会默认建设服务端，也不会默认把你的会话上传到额外平台。

你仍然需要确认所接入模型服务的隐私政策，因为聊天请求会发送到你配置的 Provider。

## 当前状态

当前仓库已经是可运行的移动端优先 MVP，核心聊天闭环已经打通：

- 支持多 Provider 配置和模型管理。
- 支持真实流式聊天、停止生成、失败重试和错误提示。
- 支持本地会话历史、模型参数、提示词和附件输入。
- 支持桌面端 Tauri 调试和构建。
- Android 和 iOS 方向已作为目标形态规划，真机签名和发布流程仍需继续验证。

后续规划包括知识库/RAG、工具调用、插件能力、跨设备同步和更完整的移动端发布流程。

## 本地体验

```bash
npm install
npm run dev
```

浏览器预览地址：

```text
http://127.0.0.1:1420
```

Tauri 桌面调试：

```bash
npm run tauri:dev
```

生产构建验证：

```bash
npm run build
cd src-tauri && cargo check
```

## GitHub Releases 自动更新

应用已对接 GitHub Releases：

- 桌面端通过 Tauri updater 检查 `https://github.com/glosc-ai/Glosc-Chat/releases/latest/download/latest.json`，下载签名更新包后安装并重启。
- Android 端通过 GitHub Releases API 检查最新 tag，发现新版后打开 Release 中的 APK 下载链接。
- 设置页支持手动检查更新，也会按默认设置在启动后自动检查。

桌面端发布需要配置更新签名私钥。当前公钥已写入 `src-tauri/tauri.conf.json`，对应私钥在本机：

```text
/Users/xiaom/.tauri/glosc-chat-updater.key
```

将该私钥内容配置到 GitHub Secrets：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

当前私钥未设置密码，因此 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 可以留空。Android Release 仍使用现有签名 Secrets：`ANDROID_KEY_BASE64`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`。

发布新版时，保持 `src-tauri/tauri.conf.json` 与 `src-tauri/Cargo.toml` 中的版本一致，然后推送 tag：

```bash
git tag v0.1.1
git push origin v0.1.1
```

tag workflow 会把桌面 updater 产物、`latest.json`、Android APK/AAB 上传到同一个 GitHub Release。

更多产品范围、设计取舍和开发说明见 [docs](./docs/README.md)。
