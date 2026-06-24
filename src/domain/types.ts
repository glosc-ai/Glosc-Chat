export type AppTab = "chat" | "models" | "providers" | "settings";

export type ProviderType = "openai-compatible" | "anthropic" | "gemini" | "custom";

export type ProviderStatus = "online" | "offline" | "error" | "testing";

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyRef: string;
  keyHint: string;
  hasApiKey: boolean;
  enabled: boolean;
  status: ProviderStatus;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelParameters {
  temperature: number;
  topP: number;
  maxTokens: number;
  presencePenalty: number;
  frequencyPenalty: number;
}

export interface ModelConfig {
  id: string;
  providerId: string;
  name: string;
  displayName: string;
  version: string;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  contextWindow: string;
  defaultParameters: ModelParameters;
}

export interface Conversation {
  id: string;
  title: string;
  providerId: string;
  modelId: string;
  systemPrompt?: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "system" | "user" | "assistant" | "tool";

export type MessageStatus = "pending" | "streaming" | "done" | "failed" | "cancelled";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  darkMode: boolean;
  fontSize: "small" | "medium" | "large";
  redactLogs: boolean;
  localOnly: boolean;
  defaultModelId: string;
}
