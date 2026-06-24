import type {
  ChatMessage,
  Conversation,
  ModelConfig,
  ModelParameters,
  ProviderConfig,
  UserSettings,
} from "../domain/types";

export const nowIso = () => new Date().toISOString();

export const defaultParameters: ModelParameters = {
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  presencePenalty: 0,
  frequencyPenalty: 0,
};

export const seedProviders: ProviderConfig[] = [
  provider("openai", "OpenAI", "openai-compatible", "https://api.openai.com/v1", "sk-...4o", true, "online"),
  provider("anthropic", "Anthropic", "anthropic", "https://api.anthropic.com", "sk-ant-...net", true, "online"),
  provider(
    "gemini",
    "Google Gemini",
    "gemini",
    "https://generativelanguage.googleapis.com/v1beta",
    "",
    true,
    "error",
  ),
  provider("deepseek", "DeepSeek", "openai-compatible", "https://api.deepseek.com/v1", "", false, "offline"),
];

export const seedModels: ModelConfig[] = [
  model("gpt-4o", "openai", "GPT-4o", "gpt-4o-2024-08-06", "128K", true, true, true),
  model("gpt-4o-mini", "openai", "GPT-4o mini", "gpt-4o-mini-2024-07-18", "128K", true, true, true),
  model("gpt-4-turbo", "openai", "GPT-4 Turbo", "gpt-4-turbo-2024-04-09", "128K", true, false, true),
  model("gpt-3-5-turbo", "openai", "GPT-3.5 Turbo", "gpt-3.5-turbo-0125", "16K", true, false, false),
  model("claude-4-sonnet", "anthropic", "Claude 4 Sonnet", "claude-sonnet-4-6", "200K", true, true, true),
  model("claude-4-haiku", "anthropic", "Claude 4 Haiku", "claude-haiku-4-5", "200K", true, true, false),
  model("claude-4-opus", "anthropic", "Claude 4 Opus", "claude-opus-4-8", "200K", true, true, true),
  model("gemini-2-5-pro", "gemini", "Gemini 2.5 Pro", "gemini-2.5-pro-exp", "1M", true, true, true),
  model("gemini-2-5-flash", "gemini", "Gemini 2.5 Flash", "gemini-2.5-flash", "1M", true, true, false),
  model("deepseek-v3", "deepseek", "DeepSeek V3", "deepseek-chat", "64K", true, false, false),
  model("deepseek-r1", "deepseek", "DeepSeek R1", "deepseek-reasoner", "64K", true, false, false),
];

export const seedConversations: Conversation[] = [
  conversation("conv-main", "AI 助手", "openai", "gpt-4o", true, -1),
  conversation("conv-architecture", "项目架构讨论", "openai", "gpt-4o", true, -2),
  conversation("conv-python", "Python 脚本调试", "anthropic", "claude-4-sonnet", false, -3),
  conversation("conv-api", "API 接口设计", "openai", "gpt-4o-mini", false, -7),
  conversation("conv-docs", "技术文档翻译", "gemini", "gemini-2-5-pro", false, -9),
];

export const seedMessages: Record<string, ChatMessage[]> = {
  "conv-main": [
    message("msg-1", "conv-main", "user", "解释一下量子计算的基本原理", "done", -45),
    message(
      "msg-2",
      "conv-main",
      "assistant",
      "量子计算用量子比特表示信息。和传统比特只能是 0 或 1 不同，量子比特可以处在叠加态，并通过纠缠让多个量子比特形成相关状态。\n\n直观理解：它不是同时尝试所有答案后直接读出结果，而是通过量子门设计干涉过程，让错误路径相互抵消、正确路径概率变高。真正的价值来自适合量子算法的问题，例如分解、搜索、模拟分子结构等。",
      "done",
      -44,
    ),
  ],
  "conv-architecture": [
    message("msg-3", "conv-architecture", "user", "Glosc Chat 的分层应该怎么切？", "done", -1440),
    message(
      "msg-4",
      "conv-architecture",
      "assistant",
      "建议保持 UI、状态、服务、Provider 适配和存储五层边界。UI 不直接拼请求，Provider 不接触页面状态，API Key 只通过安全存储引用进入请求路径。",
      "done",
      -1438,
    ),
  ],
  "conv-python": [],
  "conv-api": [],
  "conv-docs": [],
};

export const seedSettings: UserSettings = {
  darkMode: false,
  fontSize: "medium",
  redactLogs: true,
  localOnly: true,
  defaultModelId: "gpt-4o",
};

function provider(
  id: string,
  name: ProviderConfig["name"],
  type: ProviderConfig["type"],
  baseUrl: string,
  keyHint: string,
  enabled: boolean,
  status: ProviderConfig["status"],
): ProviderConfig {
  const date = nowIso();

  return {
    id,
    name,
    type,
    baseUrl,
    apiKeyRef: `secret://providers/${id}`,
    keyHint,
    hasApiKey: Boolean(keyHint),
    enabled,
    status,
    lastCheckedAt: status === "online" || status === "error" ? date : undefined,
    createdAt: date,
    updatedAt: date,
  };
}

function model(
  id: string,
  providerId: string,
  displayName: string,
  version: string,
  contextWindow: string,
  streaming: boolean,
  vision: boolean,
  tools: boolean,
): ModelConfig {
  return {
    id,
    providerId,
    name: id,
    displayName,
    version,
    supportsStreaming: streaming,
    supportsVision: vision,
    supportsTools: tools,
    contextWindow,
    defaultParameters: { ...defaultParameters },
  };
}

function conversation(
  id: string,
  title: string,
  providerId: string,
  modelId: string,
  pinned: boolean,
  daysOffset: number,
): Conversation {
  const date = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString();

  return {
    id,
    title,
    providerId,
    modelId,
    pinned,
    archived: false,
    createdAt: date,
    updatedAt: date,
  };
}

function message(
  id: string,
  conversationId: string,
  role: ChatMessage["role"],
  content: string,
  status: ChatMessage["status"],
  minutesOffset: number,
): ChatMessage {
  const date = new Date(Date.now() + minutesOffset * 60 * 1000).toISOString();

  return {
    id,
    conversationId,
    role,
    content,
    status,
    createdAt: date,
    updatedAt: date,
  };
}
