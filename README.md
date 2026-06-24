# Glosc Chat
一款面向 Android、iOS 和桌面端的本地优先 AI 会话客户端。

用户可以自行接入 OpenAI-compatible、Anthropic、Gemini 或自定义 Provider，并在统一界面中管理模型、会话历史和本地数据。

## 当前实现

- Vue 3 + TypeScript + Vite 前端。
- Tauri 2 应用壳。
- 移动端优先 UI：聊天、会话抽屉、模型选择、Provider 配置、模型参数和设置页。
- 本地持久化会话、模型、Provider 元数据和偏好设置。
- 模拟流式输出、停止生成、重试、复制、引用和删除消息。
- API Key 仅记录安全存储引用和遮罩，不写入普通 localStorage 或导出 JSON。

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
