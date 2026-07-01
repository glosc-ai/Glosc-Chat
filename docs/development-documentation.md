# Glosc Chat 开发文档

## 1. 开发环境

### 1.1 必要工具

- Node.js：建议 20 LTS 或更新的稳定 LTS。
- npm：当前仓库提交 `package-lock.json`，Tauri 配置使用 `npm run dev` 和 `npm run build`。
- Rust：建议使用 `rustup` 安装稳定版。
- Tauri 依赖：按 Tauri 2 官方要求安装系统依赖。
- Android Studio：开发 Android 版本时需要。
- Xcode：开发 iOS 版本时需要 macOS 和 Xcode。

## 2. 快速开始

```bash
npm install
npm run dev
```

启动 Tauri 桌面开发模式：

```bash
npm run tauri:dev
```

构建前端：

```bash
npm run build
```

构建 Tauri 应用：

```bash
npm run tauri:build
```

预览前端构建结果：

```bash
npm run preview
```

## 3. 当前脚本

`package.json` 中已有脚本：

| 脚本 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 运行 `vue-tsc --noEmit` 并构建前端 |
| `npm run preview` | 预览 Vite 构建结果 |
| `npm run tauri` | 调用 Tauri CLI |
| `npm run tauri:dev` | 启动 Tauri 桌面开发模式 |
| `npm run tauri:build` | 构建 Tauri 桌面应用 |
| `npm run tauri:ios:dev` | 启动 Tauri iOS 开发流程 |
| `npm run tauri:android:dev` | 启动 Tauri Android 开发流程 |

Tauri 开发服务器端口固定为 `1420`，配置见 `vite.config.ts`。如果端口被占用，Tauri 开发模式会失败。

## 4. 当前工程结构

```text
.
  README.md
  docs/
  index.html
  package-lock.json
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  public/
  src/
    App.vue
    main.ts
    assets/
    vite-env.d.ts
  src-tauri/
    Cargo.toml
    build.rs
    tauri.conf.json
    capabilities/
    icons/
    src/
      lib.rs
      main.rs
```

当前 `src/App.vue` 已替换为 Glosc Chat 移动端优先界面，覆盖聊天、模型、Provider、提示词和设置主流程。领域类型、默认配置、聊天服务、Provider 服务、安全存储服务和本地存储已拆分到 `src/domain/`、`src/data/` 和 `src/services/`，后续可继续把大型视图拆成组件。

## 5. 推荐演进结构

```text
src/
  app/              # 应用入口、路由、整体布局
  components/       # 可复用组件
  domain/           # 类型、枚举、领域模型
  providers/        # 模型供应商适配器
  services/         # 业务流程
  stores/           # 状态管理
  storage/          # 持久化和迁移
  styles/           # 全局样式和主题
  utils/            # 通用工具
```

`src-tauri/src/` 推荐演进为：

```text
src-tauri/src/
  commands/         # 暴露给前端的 Tauri commands
  secrets/          # API Key 安全存储
  storage/          # SQLite 或文件存储
  network/          # 需要隐藏密钥时的网络代理
```

## 6. 编码规范

### 6.1 TypeScript

- 保持 `strict: true`。
- 不使用隐式 `any`。
- 外部 API 响应必须经过解析或类型守卫后再进入领域层。
- Provider 请求和响应类型放在 `providers/`，统一领域类型放在 `domain/`。
- 不在 Vue 组件中直接拼接模型供应商 payload。

### 6.2 Vue

- 使用组合式 API。
- 页面组件负责布局和组合。
- 业务逻辑放在 service 或 store 中。
- 组件 props 和 emits 明确定义类型。
- 长列表消息渲染应考虑虚拟滚动或分页加载。

### 6.3 Rust/Tauri

- Tauri command 应保持小而明确。
- Rust 层不要返回包含 API Key 的错误信息。
- 涉及文件、网络和安全存储的命令需要统一错误类型。
- 发布前收紧 capabilities 和 CSP。

### 6.4 文档和命名

- 文档中使用 `Provider` 指代模型供应商配置。
- 使用 `Model` 指代具体模型。
- 使用 `Conversation` 指代会话。
- 使用 `Message` 指代单条消息。
- 未实现能力必须标注为 `MVP` 或 `规划`。

## 7. 添加 Provider 的开发流程

1. 在 `domain/provider.ts` 中确认是否需要新增 `ProviderType`。
2. 在 `providers/` 中新增适配器文件。
3. 实现统一接口：
   - `testConnection`
   - `listModels`
   - `streamChat`
4. 将供应商错误映射到统一错误码。
5. 在 `providerRegistry` 注册适配器。
6. 在设置 UI 中增加该 Provider 的配置项。
7. 为错误映射和请求 payload 添加单元测试。
8. 手动验证正常响应、鉴权失败、限流和中断。

MVP 建议先实现 `chat-completions`，因为它能覆盖主流聊天补全接口、兼容代理和大量第三方模型网关。

## 8. 添加聊天功能的开发流程

1. 建立领域模型：`Conversation`、`ChatMessage`、`ModelConfig`。
2. 建立本地存储接口，至少支持：
   - 创建会话
   - 读取会话列表
   - 读取消息
   - 新增消息
   - 更新消息状态和内容
3. 建立 `ChatService.sendMessage`。
4. 在 UI 中实现消息列表、输入区、发送/停止按钮。
5. 接入 Provider 适配器流式响应。
6. 实现重试、停止生成和失败恢复。
7. 增加 Markdown 渲染和代码复制。
8. 添加测试和手动验收。

## 9. 添加 Tauri Command 的流程

Rust 示例：

```rust
#[tauri::command]
fn command_name(input: String) -> Result<String, String> {
    Ok(input)
}
```

注册命令：

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![command_name])
```

前端调用：

```ts
import { invoke } from "@tauri-apps/api/core";

const result = await invoke<string>("command_name", { input: "value" });
```

约定：

- command 名称使用小写 snake_case。
- 输入输出使用可序列化结构。
- Rust 错误映射为前端可展示的错误码和消息。
- 不通过 command 返回敏感明文，除非 UI 当前操作必须显示。

## 10. 密钥管理开发要求

API Key 处理是发布前必须完成的安全工作。

禁止：

- 将 API Key 保存到 localStorage。
- 将 API Key 写入普通数据库字段。
- 在 console 或日志中输出 API Key。
- 在导出文件中包含 API Key。

推荐：

- 使用系统安全存储保存 API Key。
- Provider 配置只保存 `apiKeyRef`。
- 网络请求如果由 Rust 代理发出，前端只传 Provider ID。
- 错误信息统一脱敏。

## 11. 存储开发要求

推荐抽象：

```ts
export interface ConversationRepository {
  list(): Promise<Conversation[]>;
  get(id: string): Promise<Conversation | null>;
  create(input: CreateConversationInput): Promise<Conversation>;
  update(id: string, patch: Partial<Conversation>): Promise<Conversation>;
  delete(id: string): Promise<void>;
}

export interface MessageRepository {
  listByConversation(conversationId: string): Promise<ChatMessage[]>;
  create(input: CreateMessageInput): Promise<ChatMessage>;
  update(id: string, patch: Partial<ChatMessage>): Promise<ChatMessage>;
}
```

存储规则：

- 服务层依赖 repository 接口，不依赖具体数据库实现。
- 数据库 schema 变更必须提供迁移。
- 导入导出必须包含 schema version。
- 删除会话前二次确认。
- 大附件不要直接塞进消息表。

## 12. 环境变量

当前仓库还没有 `.env.example`。后续如需要环境变量，建议使用以下命名：

```text
VITE_APP_ENV=development
VITE_DEFAULT_PROVIDER_BASE_URL=
VITE_ENABLE_DEBUG_PANEL=false
```

注意：

- `VITE_` 变量会进入前端构建产物，不能放 API Key。
- 生产密钥只能通过用户输入、安全存储或原生层管理。
- 本地调试用的默认配置必须避免提交真实 Key。

## 13. 测试策略

当前仓库未配置测试框架。建议后续加入：

- Vitest：单元测试。
- Vue Test Utils：组件测试。
- Playwright：关键 UI 流程测试。
- Rust 单元测试：Tauri command 和存储逻辑。

优先测试：

- Provider 错误映射。
- Chat Completions 兼容 payload 构造。
- 流式响应合并。
- 停止生成和重试。
- 会话导出不包含 API Key。

推荐新增脚本：

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "vue-tsc --noEmit"
  }
}
```

## 14. 调试指南

### 14.1 Vite 页面调试

```bash
npm run dev
```

打开 Vite 输出的本地地址，适合调 UI 和纯前端逻辑。

### 14.2 Tauri 桌面调试

```bash
npm run tauri:dev
```

适合调 Tauri command、窗口行为、文件系统和原生能力。

### 14.3 常见问题

| 问题 | 可能原因 | 处理 |
| --- | --- | --- |
| `1420` 端口占用 | Vite 固定端口 | 停掉占用进程或修改配置 |
| Tauri 启动失败 | Rust/Tauri 依赖缺失 | 重新检查 Tauri 环境 |
| 前端类型检查失败 | `strict` 规则或未使用变量 | 修复类型，不建议关闭 strict |
| Provider 请求失败 | Key、Base URL、模型名或网络错误 | 使用连通性测试定位 |
| 流式输出不更新 | 响应解析或状态更新问题 | 单独测试 provider adapter |

## 15. 移动端开发注意事项

Android/iOS 尚未在当前仓库中配置。进入移动端阶段时需要：

- 初始化 Tauri mobile。
- 配置 Android 包名和 iOS Bundle ID。
- 验证安全区、软键盘、输入法和滚动行为。
- 验证应用切后台后请求状态。
- 验证系统安全存储插件在双平台可用。
- 验证深浅色和系统字号。
- 建立真机测试清单。

移动端 UI 不应简单复用桌面三栏布局。聊天、历史和设置需要按小屏幕重新组织。

## 16. 构建与发布

### 16.1 桌面构建

```bash
npm run build
npm run tauri:build
```

构建产物位于 Tauri 默认输出目录中。

### 16.2 发布前检查

- `npm run build` 通过。
- TypeScript 无错误。
- 模板 UI 已替换。
- 应用标识符已确认。
- `tauri.conf.json` 中 CSP 已配置。
- API Key 使用安全存储。
- capabilities 已最小化。
- 数据导出不包含密钥。
- 桌面和移动端手动验收通过。

## 17. Git 与协作规范

推荐分支：

- `main`：稳定分支。
- `feature/*`：功能开发。
- `fix/*`：缺陷修复。
- `docs/*`：文档更新。

提交建议：

- `feat: add chat completions provider`
- `fix: handle stream interruption`
- `docs: add development guide`
- `refactor: split chat service`
- `test: cover provider error mapping`

## 18. 文档更新要求

以下变更必须同步更新 docs：

- 新增或删除用户功能。
- 修改 Provider 配置方式。
- 修改存储结构或迁移策略。
- 修改 API Key 管理方式。
- 修改构建、测试或发布流程。
- 引入新的外部服务或同步能力。
