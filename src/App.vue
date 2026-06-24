<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  Info,
  KeyRound,
  ListFilter,
  LockKeyhole,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Quote,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from "@lucide/vue";
import { defaultParameters, seedConversations, seedMessages, seedModels, seedProviders, seedSettings } from "./data/seed";
import type { AppTab, ChatMessage, Conversation, ModelConfig, ModelParameters, ProviderConfig, ProviderType } from "./domain/types";
import { streamMockAssistantReply } from "./services/chatService";
import {
  clearPersistedState,
  exportPersistedState,
  loadPersistedState,
  savePersistedState,
  type PersistedState,
} from "./services/storageService";

type ModelFilter = "all" | "chat" | "vision" | "tools";
type MessageBlock = { type: "paragraph"; text: string } | { type: "code"; lang: string; text: string };
type InlinePart = { type: "text" | "code"; text: string };

const tabs = [
  { id: "chat", label: "聊天", icon: MessageSquare },
  { id: "models", label: "模型", icon: Cpu },
  { id: "settings", label: "设置", icon: Settings },
] as const;

const quickPrompts = ["量子计算原理", "写 Python 代码", "翻译技术文档", "总结文章要点"];

const providerTypeLabels: Record<ProviderType, string> = {
  "openai-compatible": "OpenAI-compatible",
  anthropic: "Anthropic",
  gemini: "Gemini",
  custom: "Custom",
};

const providerTypeDefaults: Record<ProviderType, string> = {
  "openai-compatible": "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  custom: "https://api.example.com/v1",
};

const activeTab = ref<AppTab>("chat");
const drawerOpen = ref(false);
const modelSheetOpen = ref(false);
const providerSheetOpen = ref(false);
const detailSheetOpen = ref(false);
const clearSheetOpen = ref(false);
const historySearch = ref("");
const draft = ref("");
const modelFilter = ref<ModelFilter>("all");
const toastText = ref("");
const toastVisible = ref(false);
const activeAbort = ref<AbortController | null>(null);
const activeAssistantId = ref<string | null>(null);
const messagesEl = ref<HTMLElement | null>(null);
const toastTimer = ref<number | null>(null);
const saveTimer = ref<number | null>(null);
const longPressTimer = ref<number | null>(null);

const state = reactive<PersistedState>(loadPersistedState() ?? createInitialState());

const providerForm = reactive({
  id: "",
  name: "",
  type: "openai-compatible" as ProviderType,
  baseUrl: providerTypeDefaults["openai-compatible"],
  apiKey: "",
  keyHint: "",
  showKey: false,
  customHeaders: "",
});

const detailModel = ref<ModelConfig | null>(null);
const detailParameters = reactive<ModelParameters>({ ...defaultParameters });

const contextMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  messageId: "",
});

const currentConversation = computed<Conversation | undefined>(() => {
  return state.conversations.find((item) => item.id === state.selectedConversationId) ?? state.conversations[0];
});

const currentMessages = computed<ChatMessage[]>(() => {
  const conversation = currentConversation.value;
  if (!conversation) return [];
  return state.messages[conversation.id] ?? [];
});

const currentModel = computed<ModelConfig>(() => {
  const conversation = currentConversation.value;
  return (
    state.models.find((item) => item.id === conversation?.modelId) ??
    state.models.find((item) => item.id === state.settings.defaultModelId) ??
    state.models[0]!
  );
});

const currentProvider = computed<ProviderConfig | undefined>(() => {
  return state.providers.find((item) => item.id === currentModel.value.providerId);
});

const sendableProviderExists = computed(() => {
  return state.providers.some((provider) => provider.enabled && provider.hasApiKey && provider.status !== "error");
});

const filteredConversations = computed(() => {
  const keyword = historySearch.value.trim().toLowerCase();
  const conversations = [...state.conversations].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });

  if (!keyword) return conversations;

  return conversations.filter((conversation) => {
    const preview = conversationPreview(conversation);
    return `${conversation.title} ${preview}`.toLowerCase().includes(keyword);
  });
});

const modelGroups = computed(() => {
  return state.providers
    .map((provider) => {
      const models = state.models.filter((model) => model.providerId === provider.id && modelMatchesFilter(model));
      return { provider, models };
    })
    .filter((group) => group.models.length > 0);
});

watch(
  state,
  () => {
    if (saveTimer.value) window.clearTimeout(saveTimer.value);
    saveTimer.value = window.setTimeout(() => savePersistedState(snapshotState()), 120);
  },
  { deep: true },
);

watch(
  () => state.settings.darkMode,
  (enabled) => {
    document.documentElement.style.colorScheme = enabled ? "dark" : "light";
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (activeAbort.value) activeAbort.value.abort();
  if (toastTimer.value) window.clearTimeout(toastTimer.value);
  if (saveTimer.value) window.clearTimeout(saveTimer.value);
  if (longPressTimer.value) window.clearTimeout(longPressTimer.value);
});

function createInitialState(): PersistedState {
  return clone({
    schemaVersion: 1,
    providers: seedProviders,
    models: seedModels,
    conversations: seedConversations,
    messages: seedMessages,
    settings: seedSettings,
    selectedConversationId: "conv-main",
  });
}

function snapshotState(): PersistedState {
  return clone(state);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setTab(tab: AppTab): void {
  activeTab.value = tab;
  drawerOpen.value = false;
  modelSheetOpen.value = false;
  detailSheetOpen.value = false;
  providerSheetOpen.value = false;
  contextMenu.open = false;
}

function openProviders(): void {
  activeTab.value = "providers";
  detailSheetOpen.value = false;
}

function newConversation(): void {
  const model = currentModel.value;
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: `conv-${crypto.randomUUID()}`,
    title: "新会话",
    providerId: model.providerId,
    modelId: model.id,
    pinned: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  state.conversations.unshift(conversation);
  state.messages[conversation.id] = [];
  state.selectedConversationId = conversation.id;
  activeTab.value = "chat";
  drawerOpen.value = false;
  draft.value = "";
  nextTick(scrollToBottom);
}

function selectConversation(conversationId: string): void {
  state.selectedConversationId = conversationId;
  drawerOpen.value = false;
  activeTab.value = "chat";
  nextTick(scrollToBottom);
}

function selectModel(model: ModelConfig): void {
  const conversation = currentConversation.value;
  if (conversation) {
    conversation.modelId = model.id;
    conversation.providerId = model.providerId;
    conversation.updatedAt = new Date().toISOString();
  }
  state.settings.defaultModelId = model.id;
  modelSheetOpen.value = false;
  showToast(`已切换到 ${model.displayName}`);
}

async function sendQuick(label: string): Promise<void> {
  const map: Record<string, string> = {
    量子计算原理: "解释一下量子计算的基本原理",
    "写 Python 代码": "帮我写一段 Python 代码，演示如何整理列表数据",
    翻译技术文档: "翻译这段文字到英文，并保留技术语气",
    总结文章要点: "总结这篇文章的要点，并列出后续行动",
  };

  await sendMessage(map[label] ?? label);
}

async function sendMessage(forcedText?: string): Promise<void> {
  if (activeAbort.value) {
    stopStreaming();
    return;
  }

  const text = (forcedText ?? draft.value).trim();
  const conversation = currentConversation.value;
  if (!text || !conversation) return;

  draft.value = "";
  contextMenu.open = false;

  const now = new Date().toISOString();
  const userMessage: ChatMessage = {
    id: `msg-${crypto.randomUUID()}`,
    conversationId: conversation.id,
    role: "user",
    content: text,
    status: "done",
    createdAt: now,
    updatedAt: now,
  };
  const assistantMessage: ChatMessage = {
    id: `msg-${crypto.randomUUID()}`,
    conversationId: conversation.id,
    role: "assistant",
    content: "",
    status: "streaming",
    createdAt: now,
    updatedAt: now,
  };

  state.messages[conversation.id] = [...(state.messages[conversation.id] ?? []), userMessage, assistantMessage];
  conversation.updatedAt = now;
  if (conversation.title === "新会话") conversation.title = titleFromPrompt(text);
  await nextTick(scrollToBottom);

  const provider = currentProvider.value;
  if (!provider?.enabled || !provider.hasApiKey || provider.status === "error") {
    assistantMessage.status = "failed";
    assistantMessage.errorCode = "auth.invalid_key";
    assistantMessage.content = "当前模型的 Provider 未配置有效 API Key。请前往 Provider 配置补全密钥后重试。";
    assistantMessage.updatedAt = new Date().toISOString();
    showToast("Provider 需要有效 API Key");
    return;
  }

  const controller = new AbortController();
  activeAbort.value = controller;
  activeAssistantId.value = assistantMessage.id;

  try {
    await streamMockAssistantReply(
      text,
      currentModel.value.displayName,
      (chunk) => {
        assistantMessage.content += chunk;
        assistantMessage.updatedAt = new Date().toISOString();
        scrollToBottom();
      },
      controller.signal,
    );
    assistantMessage.status = "done";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      assistantMessage.status = assistantMessage.content ? "cancelled" : "failed";
      assistantMessage.errorCode = assistantMessage.content ? undefined : "stream.interrupted";
    } else {
      assistantMessage.status = "failed";
      assistantMessage.errorCode = "network.unreachable";
      assistantMessage.content ||= "请求失败：网络不可达，请检查网络连接后重试。";
    }
  } finally {
    assistantMessage.updatedAt = new Date().toISOString();
    activeAbort.value = null;
    activeAssistantId.value = null;
    conversation.updatedAt = new Date().toISOString();
    await nextTick(scrollToBottom);
  }
}

function stopStreaming(): void {
  activeAbort.value?.abort();
  showToast("已停止生成");
}

function retryMessage(): void {
  const targetId = contextMenu.messageId;
  const conversation = currentConversation.value;
  if (!conversation || !targetId) return;

  const messages = state.messages[conversation.id] ?? [];
  const targetIndex = messages.findIndex((message) => message.id === targetId);
  const previousUser = [...messages.slice(0, targetIndex)].reverse().find((message) => message.role === "user");
  contextMenu.open = false;
  if (previousUser) void sendMessage(previousUser.content);
}

async function copyMessage(): Promise<void> {
  const message = findMessage(contextMenu.messageId);
  if (!message) return;
  await navigator.clipboard.writeText(message.content);
  contextMenu.open = false;
  showToast("消息已复制");
}

function quoteMessage(): void {
  const message = findMessage(contextMenu.messageId);
  if (!message) return;
  draft.value = `> ${message.content.replace(/\n/g, "\n> ")}\n\n`;
  contextMenu.open = false;
  showToast("已引用到输入框");
}

function deleteMessage(): void {
  const conversation = currentConversation.value;
  if (!conversation) return;
  state.messages[conversation.id] = (state.messages[conversation.id] ?? []).filter((message) => message.id !== contextMenu.messageId);
  contextMenu.open = false;
  showToast("消息已删除");
}

function openMessageMenu(event: MouseEvent | PointerEvent, message: ChatMessage): void {
  event.preventDefault();
  const appRect = document.querySelector(".phone-shell")?.getBoundingClientRect();
  const offsetX = appRect ? event.clientX - appRect.left : event.clientX;
  const offsetY = appRect ? event.clientY - appRect.top : event.clientY;

  contextMenu.open = true;
  contextMenu.x = Math.min(Math.max(offsetX, 16), 260);
  contextMenu.y = Math.min(Math.max(offsetY, 80), 700);
  contextMenu.messageId = message.id;
}

function startLongPress(event: PointerEvent, message: ChatMessage): void {
  if (longPressTimer.value) window.clearTimeout(longPressTimer.value);
  longPressTimer.value = window.setTimeout(() => openMessageMenu(event, message), 520);
}

function cancelLongPress(): void {
  if (longPressTimer.value) window.clearTimeout(longPressTimer.value);
}

function findMessage(messageId: string): ChatMessage | undefined {
  return Object.values(state.messages)
    .flat()
    .find((message) => message.id === messageId);
}

function scrollToBottom(): void {
  requestAnimationFrame(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  });
}

function resizeDraft(event: Event): void {
  const el = event.target as HTMLTextAreaElement;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
}

function handleDraftKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void sendMessage();
  }
}

function conversationPreview(conversation: Conversation): string {
  const messages = state.messages[conversation.id] ?? [];
  const last = [...messages].reverse().find((message) => message.role !== "system");
  return last?.content.replace(/\s+/g, " ").slice(0, 42) || "还没有消息";
}

function providerName(providerId: string): string {
  return state.providers.find((provider) => provider.id === providerId)?.name ?? "Unknown";
}

function providerInitial(provider: ProviderConfig): string {
  return provider.name.trim().slice(0, 1).toUpperCase() || "P";
}

function providerClass(provider: ProviderConfig): string {
  if (provider.id.includes("openai")) return "openai";
  if (provider.type === "anthropic") return "anthropic";
  if (provider.type === "gemini") return "gemini";
  return "custom";
}

function statusLabel(provider: ProviderConfig): string {
  if (!provider.enabled) return "已禁用";
  if (provider.status === "testing") return "检测中";
  if (provider.status === "online") return "已连接";
  if (provider.status === "error") return "Key 失效";
  return "离线";
}

function openProviderForm(provider?: ProviderConfig): void {
  providerForm.id = provider?.id ?? "";
  providerForm.name = provider?.name ?? "";
  providerForm.type = provider?.type ?? "openai-compatible";
  providerForm.baseUrl = provider?.baseUrl ?? providerTypeDefaults[providerForm.type];
  providerForm.apiKey = "";
  providerForm.keyHint = provider?.keyHint ?? "";
  providerForm.showKey = false;
  providerForm.customHeaders = "";
  providerSheetOpen.value = true;
}

function changeProviderType(type: ProviderType): void {
  providerForm.type = type;
  providerForm.baseUrl = providerTypeDefaults[type];
}

function saveProvider(): void {
  const name = providerForm.name.trim();
  const baseUrl = providerForm.baseUrl.trim();
  if (!name || !baseUrl) {
    showToast("请填写名称和 Base URL");
    return;
  }

  const id = providerForm.id || uniqueProviderId(name);
  const existing = state.providers.find((provider) => provider.id === id);
  const keyHint = providerForm.apiKey ? maskKey(providerForm.apiKey) : existing?.keyHint ?? "";
  const hasApiKey = Boolean(providerForm.apiKey || existing?.hasApiKey);
  const now = new Date().toISOString();
  const nextProvider: ProviderConfig = {
    id,
    name,
    type: providerForm.type,
    baseUrl,
    apiKeyRef: `secret://providers/${id}`,
    keyHint,
    hasApiKey,
    enabled: true,
    status: hasApiKey ? "online" : "error",
    lastCheckedAt: now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    Object.assign(existing, nextProvider);
  } else {
    state.providers.push(nextProvider);
    state.models.push({
      id: `${id}-default`,
      providerId: id,
      name: `${id}-chat`,
      displayName: `${name} Chat`,
      version: "custom-model",
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: false,
      contextWindow: "自定义",
      defaultParameters: { ...defaultParameters },
    });
  }

  providerSheetOpen.value = false;
  showToast(hasApiKey ? "Provider 已保存" : "Provider 已保存，请补充 API Key");
}

async function testConnection(providerId: string): Promise<void> {
  const provider = state.providers.find((item) => item.id === providerId);
  if (!provider) return;

  provider.status = "testing";
  await new Promise((resolve) => window.setTimeout(resolve, 800));
  provider.status = provider.hasApiKey ? "online" : "error";
  provider.lastCheckedAt = new Date().toISOString();
  provider.updatedAt = provider.lastCheckedAt;
  showToast(provider.hasApiKey ? `${provider.name} 连接正常` : `${provider.name} 缺少 API Key`);
}

function disableProvider(providerId: string): void {
  const provider = state.providers.find((item) => item.id === providerId);
  if (!provider) return;
  provider.enabled = false;
  provider.status = "offline";
  provider.updatedAt = new Date().toISOString();
  showToast(`已禁用 ${provider.name}`);
}

function modelMatchesFilter(model: ModelConfig): boolean {
  if (modelFilter.value === "all") return true;
  if (modelFilter.value === "chat") return true;
  if (modelFilter.value === "vision") return model.supportsVision;
  return model.supportsTools;
}

function openModelDetail(model: ModelConfig): void {
  detailModel.value = model;
  Object.assign(detailParameters, model.defaultParameters);
  detailSheetOpen.value = true;
}

function saveModelAsDefault(): void {
  if (!detailModel.value) return;
  detailModel.value.defaultParameters = { ...detailParameters };
  selectModel(detailModel.value);
  detailSheetOpen.value = false;
}

function capabilityTags(model: ModelConfig): string[] {
  const tags = ["流式"];
  if (model.supportsVision) tags.push("视觉");
  if (model.supportsTools) tags.push("工具调用");
  tags.push(model.contextWindow);
  return tags;
}

async function copyExport(): Promise<void> {
  await navigator.clipboard.writeText(exportPersistedState(snapshotState()));
  showToast("已复制导出数据，API Key 不包含在内");
}

function clearAllData(): void {
  activeAbort.value?.abort();
  clearPersistedState();
  Object.assign(state, createInitialState());
  clearSheetOpen.value = false;
  activeTab.value = "chat";
  showToast("已恢复初始本地数据");
}

function toggleDarkMode(): void {
  state.settings.darkMode = !state.settings.darkMode;
}

function cycleFontSize(): void {
  state.settings.fontSize = state.settings.fontSize === "small" ? "medium" : state.settings.fontSize === "medium" ? "large" : "small";
  showToast(`字体大小：${fontSizeLabel(state.settings.fontSize)}`);
}

function parseMessageBlocks(content: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  const fencePattern = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(content))) {
    const before = content.slice(lastIndex, match.index).trim();
    if (before) blocks.push(...before.split(/\n{2,}/).map((text) => ({ type: "paragraph" as const, text })));
    blocks.push({ type: "code", lang: match[1] ?? "", text: match[2].trimEnd() });
    lastIndex = match.index + match[0].length;
  }

  const after = content.slice(lastIndex).trim();
  if (after) blocks.push(...after.split(/\n{2,}/).map((text) => ({ type: "paragraph" as const, text })));
  return blocks.length ? blocks : [{ type: "paragraph", text: content }];
}

function parseInlineCode(text: string): InlinePart[] {
  return text.split(/(`[^`]+`)/g).filter(Boolean).map((part) => {
    if (part.startsWith("`") && part.endsWith("`")) return { type: "code", text: part.slice(1, -1) };
    return { type: "text", text: part };
  });
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function formatConversationTime(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 24 * 60 * 60 * 1000) return formatMessageTime(value);
  if (diff < 48 * 60 * 60 * 1000) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

function fontSizeLabel(value: string): string {
  if (value === "small") return "小";
  if (value === "large") return "大";
  return "中";
}

function titleFromPrompt(text: string): string {
  return text.replace(/\s+/g, " ").slice(0, 14);
}

function uniqueProviderId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "custom";
  let id = base;
  let index = 1;
  while (state.providers.some((provider) => provider.id === id)) {
    id = `${base}-${index++}`;
  }
  return id;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function showToast(text: string): void {
  toastText.value = text;
  toastVisible.value = true;
  if (toastTimer.value) window.clearTimeout(toastTimer.value);
  toastTimer.value = window.setTimeout(() => {
    toastVisible.value = false;
  }, 2100);
}
</script>

<template>
  <main class="glosc-app" :class="[{ dark: state.settings.darkMode }, `font-${state.settings.fontSize}`]">
    <section class="phone-shell" aria-label="Glosc Chat">
      <div class="dynamic-island"></div>

      <div class="status-bar">
        <span class="status-time">9:41</span>
        <span class="status-icons" aria-hidden="true">
          <Wifi :size="14" />
          <span class="battery"></span>
        </span>
      </div>

      <template v-if="activeTab === 'chat'">
        <header class="chat-nav">
          <button class="icon-btn accent" type="button" aria-label="会话列表" @click="drawerOpen = true">
            <Menu :size="22" />
          </button>
          <div class="title-area">
            <div class="conv-title">{{ currentConversation?.title ?? "AI 助手" }}</div>
            <button class="model-badge" type="button" @click="modelSheetOpen = true">
              {{ currentModel.displayName }}
              <ChevronRight :size="12" />
            </button>
          </div>
          <button class="icon-btn" type="button" aria-label="会话详情" @click="showToast('会话信息已在本地保存')">
            <MoreHorizontal :size="22" />
          </button>
        </header>

        <section v-if="!sendableProviderExists" class="no-provider-state">
          <AlertTriangle :size="42" />
          <h2>还没有可用 Provider</h2>
          <p>添加 OpenAI-compatible、Anthropic、Gemini 或自定义 Provider 后即可开始对话。</p>
          <button class="primary-action" type="button" @click="openProviders">添加 Provider</button>
        </section>

        <section v-else ref="messagesEl" class="messages" aria-live="polite">
          <div v-if="currentMessages.length === 0" class="empty-state">
            <div class="empty-icon"><Bot :size="34" /></div>
            <h2>今天想聊什么？</h2>
            <p>选择模型、输入问题，或从常用提示开始。</p>
            <div class="quick-prompts">
              <button v-for="prompt in quickPrompts" :key="prompt" class="quick-prompt" type="button" @click="sendQuick(prompt)">
                {{ prompt }}
              </button>
            </div>
          </div>

          <article
            v-for="message in currentMessages"
            :key="message.id"
            class="message"
            :class="[message.role, message.status]"
            @contextmenu="openMessageMenu($event, message)"
            @pointerdown="startLongPress($event, message)"
            @pointerup="cancelLongPress"
            @pointerleave="cancelLongPress"
          >
            <div class="bubble">
              <template v-for="(block, index) in parseMessageBlocks(message.content)" :key="`${message.id}-${index}`">
                <pre v-if="block.type === 'code'"><code>{{ block.text }}</code></pre>
                <p v-else>
                  <template v-for="(part, partIndex) in parseInlineCode(block.text)" :key="partIndex">
                    <code v-if="part.type === 'code'">{{ part.text }}</code>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </p>
              </template>
              <span v-if="message.status === 'streaming' && message.id === activeAssistantId" class="streaming-cursor"></span>
            </div>
            <div class="message-meta">
              <span>{{ formatMessageTime(message.createdAt) }}</span>
              <span v-if="message.status === 'cancelled'">已停止</span>
              <span v-if="message.status === 'failed'">{{ message.errorCode }}</span>
            </div>
          </article>
        </section>

        <form class="input-area" @submit.prevent="sendMessage()">
          <button class="attach-btn" type="button" aria-label="添加附件" @click="showToast('附件功能已预留')">
            <Paperclip :size="20" />
          </button>
          <textarea
            v-model="draft"
            class="message-input"
            rows="1"
            placeholder="发送消息..."
            @input="resizeDraft"
            @keydown="handleDraftKeydown"
          ></textarea>
          <button class="send-btn" type="submit" :aria-label="activeAbort ? '停止' : '发送'" :disabled="!draft.trim() && !activeAbort">
            <Square v-if="activeAbort" :size="17" />
            <Send v-else :size="18" />
          </button>
        </form>
      </template>

      <template v-else-if="activeTab === 'models'">
        <header class="nav-header">
          <div>
            <h1>模型</h1>
            <p>{{ state.models.length }} 个模型 · {{ state.providers.filter((item) => item.enabled).length }} 个 Provider</p>
          </div>
          <button class="pill-btn" type="button" @click="openProviders">
            <KeyRound :size="15" />
            Provider
          </button>
        </header>

        <div class="segmented" role="tablist" aria-label="模型筛选">
          <button :class="{ active: modelFilter === 'all' }" type="button" @click="modelFilter = 'all'">全部</button>
          <button :class="{ active: modelFilter === 'chat' }" type="button" @click="modelFilter = 'chat'">对话</button>
          <button :class="{ active: modelFilter === 'vision' }" type="button" @click="modelFilter = 'vision'">视觉</button>
          <button :class="{ active: modelFilter === 'tools' }" type="button" @click="modelFilter = 'tools'">工具</button>
        </div>

        <section class="content scrollable">
          <div v-for="group in modelGroups" :key="group.provider.id" class="provider-group">
            <div class="provider-group-header">
              <div class="provider-icon small" :class="providerClass(group.provider)">{{ providerInitial(group.provider) }}</div>
              <span class="provider-group-name">{{ group.provider.name }}</span>
              <span class="provider-group-count">{{ group.models.length }} 个模型</span>
            </div>

            <button
              v-for="model in group.models"
              :key="model.id"
              class="model-card"
              :class="{ selected: model.id === state.settings.defaultModelId }"
              type="button"
              @click="openModelDetail(model)"
            >
              <span>
                <strong>{{ model.displayName }}</strong>
                <small>{{ model.version }}</small>
              </span>
              <span class="check-circle"><Check v-if="model.id === state.settings.defaultModelId" :size="15" /></span>
              <span class="cap-tags">
                <span v-for="tag in capabilityTags(model)" :key="tag" class="cap-tag" :class="{ context: tag.includes('K') || tag.includes('M') }">
                  {{ tag }}
                </span>
              </span>
            </button>
          </div>
        </section>
      </template>

      <template v-else-if="activeTab === 'providers'">
        <header class="nav-header compact">
          <button class="icon-btn accent" type="button" aria-label="返回模型" @click="setTab('models')">
            <ChevronLeft :size="24" />
          </button>
          <div>
            <h1>Provider 配置</h1>
            <p>密钥只保留安全存储引用</p>
          </div>
        </header>

        <section class="content scrollable">
          <article v-for="provider in state.providers" :key="provider.id" class="provider-card" :class="{ disabled: !provider.enabled }">
            <div class="provider-card-header">
              <div class="provider-icon" :class="providerClass(provider)">{{ providerInitial(provider) }}</div>
              <div class="provider-info">
                <strong>{{ provider.name }}</strong>
                <span>{{ provider.baseUrl.replace(/^https?:\/\//, "") }} · {{ providerTypeLabels[provider.type] }}</span>
              </div>
              <div class="provider-status" :class="provider.status">
                <span class="status-dot"></span>
                {{ statusLabel(provider) }}
              </div>
            </div>
            <div class="provider-key-row">
              <LockKeyhole :size="14" />
              <span>{{ provider.hasApiKey ? provider.keyHint || "已保存密钥引用" : "未配置 API Key" }}</span>
            </div>
            <div class="provider-actions">
              <button type="button" @click="openProviderForm(provider)"><Pencil :size="14" /> 编辑</button>
              <button class="success" type="button" @click="testConnection(provider.id)"><RefreshCw :size="14" /> 测试</button>
              <button class="danger" type="button" @click="disableProvider(provider.id)"><WifiOff :size="14" /> 禁用</button>
            </div>
          </article>

          <button class="add-provider" type="button" @click="openProviderForm()">
            <Plus :size="20" />
            添加 Provider
          </button>
        </section>
      </template>

      <template v-else>
        <header class="nav-header">
          <div>
            <h1>设置</h1>
            <p>本地优先 · 数据可导出</p>
          </div>
        </header>

        <section class="content scrollable settings-content">
          <div class="settings-group">
            <div class="settings-group-title">数据与隐私</div>
            <div class="settings-card">
              <button class="settings-row" type="button" @click="showToast('API Key 不写入普通本地存储')">
                <span class="row-left"><ShieldCheck :size="18" /> 密钥存储</span>
                <span class="row-value">安全存储引用 <ChevronRight :size="16" /></span>
              </button>
              <button class="settings-row" type="button" @click="state.settings.redactLogs = !state.settings.redactLogs">
                <span class="row-left"><FileText :size="18" /> 日志脱敏</span>
                <span class="toggle" :class="{ on: state.settings.redactLogs }"></span>
              </button>
              <button class="settings-row" type="button" @click="showToast('会话数据默认保存在本机')">
                <span class="row-left"><Database :size="18" /> 数据位置</span>
                <span class="row-value">仅本地 <ChevronRight :size="16" /></span>
              </button>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">导入导出</div>
            <div class="settings-card">
              <button class="settings-row" type="button" @click="copyExport">
                <span class="row-left"><Download :size="18" /> 导出会话数据</span>
                <span class="row-value">不含密钥 <ChevronRight :size="16" /></span>
              </button>
              <button class="settings-row" type="button" @click="showToast('导入入口已预留，后续接入文件选择')">
                <span class="row-left"><Upload :size="18" /> 导入会话数据</span>
                <ChevronRight :size="16" />
              </button>
              <button class="settings-row" type="button" @click="showToast('Provider 配置可从导出 JSON 中恢复')">
                <span class="row-left"><KeyRound :size="18" /> Provider 配置</span>
                <span class="row-value">不含密钥 <ChevronRight :size="16" /></span>
              </button>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">外观</div>
            <div class="settings-card">
              <button class="settings-row" type="button" @click="toggleDarkMode">
                <span class="row-left"><Moon :size="18" /> 深色模式</span>
                <span class="toggle" :class="{ on: state.settings.darkMode }"></span>
              </button>
              <button class="settings-row" type="button" @click="cycleFontSize">
                <span class="row-left"><ListFilter :size="18" /> 字体大小</span>
                <span class="row-value">{{ fontSizeLabel(state.settings.fontSize) }} <ChevronRight :size="16" /></span>
              </button>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">关于</div>
            <div class="settings-card">
              <button class="settings-row" type="button" @click="showToast('Glosc Chat v0.1.0 · Tauri 2 + Vue 3')">
                <span class="row-left"><Info :size="18" /> 版本</span>
                <span class="row-value">0.1.0 <ChevronRight :size="16" /></span>
              </button>
              <button class="settings-row danger" type="button" @click="clearSheetOpen = true">
                <span class="row-left"><Trash2 :size="18" /> 清除所有会话数据</span>
                <ChevronRight :size="16" />
              </button>
            </div>
          </div>
        </section>
      </template>

      <nav v-if="activeTab !== 'providers'" class="bottom-nav" aria-label="主导航">
        <button v-for="tab in tabs" :key="tab.id" class="nav-item" :class="{ active: activeTab === tab.id }" type="button" @click="setTab(tab.id)">
          <component :is="tab.icon" :size="22" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <div v-if="drawerOpen" class="overlay" @click="drawerOpen = false"></div>
      <aside class="history-drawer" :class="{ open: drawerOpen }" aria-label="会话历史">
        <div class="drawer-header">
          <strong>会话</strong>
          <button class="icon-btn accent" type="button" aria-label="新建会话" @click="newConversation">
            <Plus :size="20" />
          </button>
        </div>
        <label class="drawer-search">
          <Search :size="16" />
          <input v-model="historySearch" type="search" placeholder="搜索会话" />
        </label>
        <button
          v-for="conversation in filteredConversations"
          :key="conversation.id"
          class="conversation-item"
          :class="{ active: conversation.id === state.selectedConversationId, pinned: conversation.pinned }"
          type="button"
          @click="selectConversation(conversation.id)"
        >
          <span class="conversation-icon"><MessageSquare :size="18" /></span>
          <span class="conversation-copy">
            <strong>{{ conversation.title }}</strong>
            <small>{{ conversationPreview(conversation) }}</small>
          </span>
          <span class="conversation-time">{{ formatConversationTime(conversation.updatedAt) }}</span>
        </button>
      </aside>

      <div v-if="modelSheetOpen || providerSheetOpen || detailSheetOpen || clearSheetOpen" class="sheet-overlay" @click="modelSheetOpen = providerSheetOpen = detailSheetOpen = clearSheetOpen = false"></div>

      <section class="bottom-sheet model-sheet" :class="{ open: modelSheetOpen }" aria-label="选择模型">
        <div class="sheet-handle"></div>
        <h2>选择模型</h2>
        <button v-for="model in state.models" :key="model.id" class="model-option" :class="{ selected: model.id === currentModel.id }" type="button" @click="selectModel(model)">
          <span class="provider-icon small" :class="providerClass(state.providers.find((item) => item.id === model.providerId)!)">
            {{ providerName(model.providerId).slice(0, 1) }}
          </span>
          <span>
            <strong>{{ model.displayName }}</strong>
            <small>{{ providerName(model.providerId) }} · {{ model.contextWindow }} 上下文</small>
          </span>
          <Check v-if="model.id === currentModel.id" :size="18" />
        </button>
      </section>

      <section class="bottom-sheet provider-sheet" :class="{ open: providerSheetOpen }" aria-label="Provider 表单">
        <div class="sheet-handle"></div>
        <h2>{{ providerForm.id ? "编辑 Provider" : "添加 Provider" }}</h2>
        <label class="field">
          <span>类型</span>
          <select :value="providerForm.type" @change="changeProviderType(($event.target as HTMLSelectElement).value as ProviderType)">
            <option value="openai-compatible">OpenAI-compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label class="field">
          <span>名称</span>
          <input v-model="providerForm.name" type="text" placeholder="例如：我的 OpenAI" />
        </label>
        <label class="field">
          <span>Base URL</span>
          <input v-model="providerForm.baseUrl" type="url" placeholder="https://api.openai.com/v1" />
        </label>
        <label class="field">
          <span>API Key</span>
          <span class="secret-input">
            <input v-model="providerForm.apiKey" :type="providerForm.showKey ? 'text' : 'password'" :placeholder="providerForm.keyHint || 'sk-...'" />
            <button type="button" aria-label="切换密钥可见性" @click="providerForm.showKey = !providerForm.showKey">
              <EyeOff v-if="providerForm.showKey" :size="18" />
              <Eye v-else :size="18" />
            </button>
          </span>
          <small>保存时只记录安全存储引用和遮罩，不把密钥写入普通本地存储。</small>
        </label>
        <label class="field">
          <span>自定义 Headers</span>
          <input v-model="providerForm.customHeaders" type="text" placeholder='{"X-Custom-Header":"value"}' />
        </label>
        <div class="sheet-actions">
          <button class="secondary-btn" type="button" @click="providerSheetOpen = false">取消</button>
          <button class="primary-btn" type="button" @click="saveProvider">保存</button>
        </div>
      </section>

      <section class="bottom-sheet detail-sheet" :class="{ open: detailSheetOpen }" aria-label="模型详情">
        <div class="sheet-handle"></div>
        <template v-if="detailModel">
          <h2>{{ detailModel.displayName }}</h2>
          <p class="sheet-subtitle">{{ providerName(detailModel.providerId) }} · {{ detailModel.contextWindow }} 上下文</p>
          <div class="cap-tags spacious">
            <span v-for="tag in capabilityTags(detailModel)" :key="tag" class="cap-tag">{{ tag }}</span>
          </div>
          <div class="param-card">
            <label>
              <span>Temperature <strong>{{ detailParameters.temperature.toFixed(1) }}</strong></span>
              <input v-model.number="detailParameters.temperature" type="range" min="0" max="2" step="0.1" />
            </label>
            <label>
              <span>Top P <strong>{{ detailParameters.topP.toFixed(2) }}</strong></span>
              <input v-model.number="detailParameters.topP" type="range" min="0" max="1" step="0.05" />
            </label>
            <label>
              <span>Max Tokens <strong>{{ detailParameters.maxTokens }}</strong></span>
              <input v-model.number="detailParameters.maxTokens" type="range" min="256" max="32768" step="256" />
            </label>
          </div>
          <div class="sheet-actions">
            <button class="secondary-btn" type="button" @click="detailSheetOpen = false">取消</button>
            <button class="primary-btn" type="button" @click="saveModelAsDefault">设为默认</button>
          </div>
        </template>
      </section>

      <section class="bottom-sheet alert-sheet" :class="{ open: clearSheetOpen }" aria-label="清除数据确认">
        <div class="sheet-handle"></div>
        <h2>清除所有会话数据？</h2>
        <p>这会恢复本地演示数据。Provider 密钥不会出现在导出文件或普通存储中。</p>
        <button class="sheet-danger" type="button" @click="clearAllData">清除所有会话数据</button>
        <button class="sheet-cancel" type="button" @click="clearSheetOpen = false">取消</button>
      </section>

      <div v-if="contextMenu.open" class="context-menu" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }">
        <button type="button" @click="copyMessage"><Copy :size="15" /> 复制</button>
        <button type="button" @click="retryMessage"><RotateCcw :size="15" /> 重试</button>
        <button type="button" @click="quoteMessage"><Quote :size="15" /> 引用</button>
        <button class="danger" type="button" @click="deleteMessage"><Trash2 :size="15" /> 删除</button>
      </div>

      <div class="toast" :class="{ show: toastVisible }">{{ toastText }}</div>
    </section>
  </main>
</template>
