# Glosc Chat
一款面向 Android、iOS 和桌面端的本地优先 AI 会话客户端。

用户可以自行接入 OpenAI-compatible、Anthropic、Gemini 或自定义 Provider，并在统一界面中管理模型、会话历史和本地数据。

## 当前实现

- Vue 3 + TypeScript + Vite 前端。
- Tauri 2 应用壳。
- 移动端优先 UI：聊天、会话抽屉、模型选择、Provider 配置、模型参数和设置页。
- IndexedDB 本地持久化会话、模型、Provider 元数据和偏好设置。
- OpenAI-compatible、Anthropic、Gemini 和 custom 真实 Provider 流式聊天、停止生成、重试、复制、引用和删除消息。
- API Key 写入 Tauri/Rust 系统安全存储；普通本地数据和导出 JSON 只保存引用与遮罩。
- 会话 Markdown 导出、全量 JSON 导入导出，不包含 API Key。
- 当前会话系统提示词、上下文消息数控制和提示词模板变量填充。
- 文本/Markdown/JSON 附件会作为上下文加入下一条真实请求；图片附件会按模型视觉能力发送。

## 运行

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
