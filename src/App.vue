<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from "vue";
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
  ExternalLink,
  FileText,
  Image as ImageIcon,
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
  WifiOff,
  X,
} from "@lucide/vue";
import MarkdownIt from "markdown-it";
import { openUrl } from "@tauri-apps/plugin-opener";
import { defaultParameters, defaultSettings } from "./data/defaults";
import type {
  AppTab,
  ChatMessage,
  Conversation,
  MessageAttachment,
  ModelConfig,
  ModelParameters,
  PromptTemplate,
  ProviderConfig,
  ProviderType,
  UserSettings,
} from "./domain/types";
import { cancelChatStream, streamChatCompletion, type ChatStreamEvent } from "./services/chatService";
import { trackAppScreen } from "./services/firebaseAnalytics";
import { listProviderModels, type ProviderModelSummary } from "./services/providerService";
import { apiKeyExists, deleteApiKey, saveApiKey } from "./services/secretService";
import {
  clearPersistedState,
  exportPersistedState,
  loadPersistedState,
  savePersistedState,
  type PersistedState,
} from "./services/storageService";
import {
  checkForAppUpdate,
  getCurrentAppVersion,
  installDesktopUpdate,
  type AppUpdateAvailable,
} from "./services/updateService";

type ModelFilter = "all" | "chat" | "vision" | "tools";

type ChatConfig = {
  model: ModelConfig;
  provider: ProviderConfig;
};

const GLOSC_AI_PROVIDER_ID = "glosc-ai";
const GLOSC_AI_PROVIDER_NAME = "Glosc AI";
const GLOSC_AI_HOME_URL = "https://one.gloscai.com";
const GLOSC_AI_KEYS_URL = "https://one.gloscai.com/keys";
const GLOSC_AI_BASE_URL = "https://one.gloscai.com/v1";
const GLOSC_AI_DEFAULT_MODEL = "deepseek/deepseek-v4-flash";
const DEFAULT_PROVIDER_TYPE: ProviderType = "chat-completions";
const LEGACY_COMPATIBLE_PROVIDER_TYPE = "open" + "ai-compatible";

const tabs = [
  { id: "chat", label: "聊天", icon: MessageSquare },
  { id: "models", label: "模型", icon: Cpu },
  { id: "settings", label: "设置", icon: Settings },
] as const;

const providerTypeLabels: Record<ProviderType, string> = {
  "chat-completions": "Chat Completions",
  anthropic: "Anthropic",
  gemini: "Gemini",
  custom: "Custom",
};

const providerTypeDefaults: Record<ProviderType, string> = {
  "chat-completions": "https://api.example.com/v1",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  custom: "https://api.example.com/v1",
};

const providerChatPathDefaults: Record<ProviderType, string> = {
  "chat-completions": "/chat/completions",
  anthropic: "/v1/messages",
  gemini: "/models/{model}:streamGenerateContent?alt=sse",
  custom: "/chat/completions",
};

const providerModelsPathDefaults: Record<ProviderType, string> = {
  "chat-completions": "/models",
  anthropic: "/v1/models",
  gemini: "/models",
  custom: "/models",
};

const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
  typographer: false,
});

markdown.validateLink = (url) => isSafeMarkdownLink(url);

const defaultLinkOpen =
  markdown.renderer.rules.link_open ??
  ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  token.attrSet("target", "_blank");
  token.attrSet("rel", "noopener noreferrer");
  return defaultLinkOpen(tokens, index, options, env, self);
};

const activeTab = ref<AppTab>("chat");
const drawerOpen = ref(false);
const modelSheetOpen = ref(false);
const providerSheetOpen = ref(false);
const detailSheetOpen = ref(false);
const clearSheetOpen = ref(false);
const promptSheetOpen = ref(false);
const conversationSheetOpen = ref(false);
const historySearch = ref("");
const showArchived = ref(false);
const draft = ref("");
const pendingAttachments = ref<MessageAttachment[]>([]);
const modelFilter = ref<ModelFilter>("all");
const modelSearch = ref("");
const modelSheetSearch = ref("");
const toastText = ref("");
const toastVisible = ref(false);
const activeAbort = ref<AbortController | null>(null);
const activeAssistantId = ref<string | null>(null);
const messagesEl = ref<HTMLElement | null>(null);
const draftInput = ref<HTMLTextAreaElement | null>(null);
const editingMessageId = ref<string | null>(null);
const inlineEditDraft = ref("");
const activeStreamScrollToBottom = ref(true);
const toastTimer = ref<number | null>(null);
const saveTimer = ref<number | null>(null);
const longPressTimer = ref<number | null>(null);
const activeRequestId = ref<string | null>(null);
const importFileInput = ref<HTMLInputElement | null>(null);
const attachmentFileInput = ref<HTMLInputElement | null>(null);
const providerReturnTab = ref<AppTab>("models");
const syncingAllProviders = ref(false);
const onboardingSyncingModels = ref(false);
const onboardingModels = ref<ProviderModelSummary[]>([]);
const onboardingModelsFetched = ref(false);
const keyboardInset = ref(0);
const appHeight = ref(0);
const trackedViewport = ref<VisualViewport | null>(null);
const appVersion = ref("0.1.0");
const updateChecking = ref(false);
const updateStatusText = ref("未检查");
const updateProgress = ref<number | null>(null);
const availableUpdate = shallowRef<AppUpdateAvailable | null>(null);

const state = reactive<PersistedState>(createInitialState());
const stateHydrated = ref(false);

const providerForm = reactive({
  id: "",
  name: "",
  type: DEFAULT_PROVIDER_TYPE as ProviderType,
  baseUrl: providerTypeDefaults[DEFAULT_PROVIDER_TYPE],
  chatPath: providerChatPathDefaults[DEFAULT_PROVIDER_TYPE],
  modelsPath: providerModelsPathDefaults[DEFAULT_PROVIDER_TYPE],
  modelId: "",
  modelDisplayName: "",
  contextWindow: "自定义",
  apiKey: "",
  keyHint: "",
  showKey: false,
  customHeaders: "",
});

const onboardingForm = reactive({
  apiKey: "",
  showKey: false,
  modelId: "",
});

const promptForm = reactive({
  id: "",
  name: "",
  content: "",
});

const conversationForm = reactive({
  title: "",
  systemPrompt: "",
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

const selectableModels = computed(() => state.models.filter((model) => isSelectableModel(model)));

const updateRowValue = computed(() => {
  if (updateChecking.value) {
    return updateProgress.value === null ? "检查中" : `${updateProgress.value}%`;
  }
  if (availableUpdate.value) return `v${availableUpdate.value.version}`;
  return updateStatusText.value;
});

const updateActionLabel = computed(() => {
  if (!availableUpdate.value) return "检查更新";
  return availableUpdate.value.source === "desktop-updater" ? "安装更新" : "获取更新";
});

const modelSheetModels = computed(() => {
  const keyword = modelSheetSearch.value.trim().toLowerCase();
  if (!keyword) return selectableModels.value;

  return selectableModels.value.filter((model) => {
    const provider = state.providers.find((item) => item.id === model.providerId);
    return provider ? modelMatchesSearch(model, provider, keyword) : false;
  });
});

const currentModel = computed<ModelConfig | undefined>(() => {
  const conversation = currentConversation.value;
  const models = selectableModels.value;
  return (
    models.find((item) => item.id === conversation?.modelId) ??
    models.find((item) => item.id === state.settings.defaultModelId) ??
    models[0]
  );
});

const currentProvider = computed<ProviderConfig | undefined>(() => {
  return state.providers.find((item) => item.id === currentModel.value?.providerId);
});

const sendableProviderExists = computed(() => {
  return state.models.some((model) => {
    const provider = state.providers.find((item) => item.id === model.providerId);
    return isModelEnabled(model) && provider?.enabled && provider.hasApiKey;
  });
});

const showOnboarding = computed(() => {
  return stateHydrated.value && !state.settings.onboardingCompleted && !sendableProviderExists.value;
});

const syncableProviders = computed(() => state.providers.filter((provider) => provider.enabled && provider.hasApiKey));

const canSubmitDraft = computed(() => Boolean(activeAbort.value || draft.value.trim()));

const filteredConversations = computed(() => {
  const keyword = historySearch.value.trim().toLowerCase();
  const conversations = [...state.conversations].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });

  const visibleConversations = conversations.filter((conversation) => conversation.archived === showArchived.value);

  if (!keyword) return visibleConversations;

  return visibleConversations.filter((conversation) => {
    const preview = conversationPreview(conversation);
    return `${conversation.title} ${preview}`.toLowerCase().includes(keyword);
  });
});

const modelGroups = computed(() => {
  const keyword = modelSearch.value.trim().toLowerCase();
  return state.providers
    .map((provider) => {
      const models = state.models.filter((model) => model.providerId === provider.id && modelMatchesFilter(model) && modelMatchesSearch(model, provider, keyword));
      return { provider, models };
    })
    .filter((group) => group.models.length > 0);
});

watch(
  state,
  () => {
    if (!stateHydrated.value) return;
    if (saveTimer.value) window.clearTimeout(saveTimer.value);
    saveTimer.value = window.setTimeout(() => void savePersistedState(snapshotState()), 120);
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

watch(
  () => activeTab.value,
  (tab) => trackAppScreen(tab),
  { immediate: true },
);

watch(
  () => onboardingForm.apiKey,
  () => {
    onboardingModels.value = [];
    onboardingModelsFetched.value = false;
  },
);

onBeforeUnmount(() => {
  if (activeAbort.value) activeAbort.value.abort();
  if (toastTimer.value) window.clearTimeout(toastTimer.value);
  if (saveTimer.value) window.clearTimeout(saveTimer.value);
  if (longPressTimer.value) window.clearTimeout(longPressTimer.value);
  stopKeyboardTracking();
});

onMounted(async () => {
  startKeyboardTracking();
  appVersion.value = await getCurrentAppVersion();
  const persisted = await loadPersistedState();
  if (persisted) {
    Object.assign(state, normalizeImportedState(persisted));
    await refreshImportedProviderKeyState();
  }
  stateHydrated.value = true;
  void refreshAllProviderModels(false);
  if (state.settings.autoCheckUpdates) void checkForUpdates({ silent: true });
});

function createInitialState(): PersistedState {
  return clone({
    schemaVersion: 2,
    providers: [],
    models: [],
    conversations: [],
    messages: {},
    promptTemplates: [],
    settings: defaultSettings,
    selectedConversationId: null,
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
  conversationSheetOpen.value = false;
  contextMenu.open = false;
}

function startKeyboardTracking(): void {
  const viewport = window.visualViewport;
  window.addEventListener("resize", updateKeyboardGeometry);
  window.addEventListener("orientationchange", updateKeyboardGeometry);
  window.addEventListener("focusin", updateKeyboardGeometry);
  window.addEventListener("focusout", updateKeyboardGeometry);
  if (!viewport) {
    updateKeyboardGeometry();
    return;
  }

  trackedViewport.value = viewport;
  viewport.addEventListener("resize", updateKeyboardGeometry);
  viewport.addEventListener("scroll", updateKeyboardGeometry);
  updateKeyboardGeometry();
}

function stopKeyboardTracking(): void {
  const viewport = trackedViewport.value;
  window.removeEventListener("resize", updateKeyboardGeometry);
  window.removeEventListener("orientationchange", updateKeyboardGeometry);
  window.removeEventListener("focusin", updateKeyboardGeometry);
  window.removeEventListener("focusout", updateKeyboardGeometry);
  if (!viewport) return;

  viewport.removeEventListener("resize", updateKeyboardGeometry);
  viewport.removeEventListener("scroll", updateKeyboardGeometry);
  trackedViewport.value = null;
}

function updateKeyboardGeometry(): void {
  const viewport = window.visualViewport;
  if (!viewport) {
    appHeight.value = Math.round(window.innerHeight);
    keyboardInset.value = 0;
    return;
  }

  appHeight.value = Math.round(viewport.height);
  const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
  keyboardInset.value = inset > 80 ? inset : 0;
}

async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url, "inAppBrowser");
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

async function completeOnboarding(): Promise<void> {
  const apiKey = onboardingForm.apiKey.trim();
  const modelName = onboardingForm.modelId.trim();
  if (!apiKey) {
    showToast("请填写 Glosc AI API Key");
    return;
  }

  const id = resolveGloscProviderId();
  let keyHint = "";
  try {
    keyHint = await saveApiKey(id, apiKey);
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
    return;
  }

  const existing = state.providers.find((provider) => provider.id === id);
  const nextProvider = createGloscProviderConfig(id, keyHint, existing);

  if (existing) {
    Object.assign(existing, nextProvider);
  } else {
    state.providers.push(nextProvider);
  }
  const activeProvider = existing ?? nextProvider;

  let syncedModels: ProviderModelSummary[] = [];
  let toast = "初始化配置已完成";
  try {
    if (onboardingModelsFetched.value) {
      syncedModels = onboardingModels.value;
      applySyncedProviderModels(activeProvider, syncedModels);
    } else {
      syncedModels = await syncProviderModels(activeProvider);
    }
    toast = syncedModels.length ? `初始化完成，已从 API 同步 ${syncedModels.length} 个模型` : "初始化完成，但 API 没有返回模型列表";
  } catch (error) {
    toast = error instanceof Error ? `Provider 已保存，模型同步失败：${error.message}` : "Provider 已保存，模型同步失败";
  }

  const selectedModelName = chooseInitialModel(modelName, syncedModels);
  if (selectedModelName && !state.models.some((model) => model.id === `${id}:${selectedModelName}`)) {
    upsertModel(activeProvider, { id: selectedModelName, displayName: selectedModelName }, "自定义");
  }
  if (selectedModelName) state.settings.defaultModelId = `${id}:${selectedModelName}`;
  ensureDefaultModelExists(id);
  state.settings.onboardingCompleted = true;
  onboardingForm.apiKey = "";
  onboardingForm.showKey = false;
  onboardingForm.modelId = "";
  onboardingModels.value = [];
  onboardingModelsFetched.value = false;
  activeTab.value = "chat";

  if (!state.selectedConversationId) {
    newConversation();
  }

  showToast(toast);
}

async function fetchOnboardingModels(): Promise<void> {
  const apiKey = onboardingForm.apiKey.trim();
  if (!apiKey) {
    showToast("请先填写 Glosc AI API Key");
    return;
  }
  if (onboardingSyncingModels.value) return;

  onboardingSyncingModels.value = true;
  try {
    const id = resolveGloscProviderId();
    const keyHint = await saveApiKey(id, apiKey);
    const provider = createGloscProviderConfig(id, keyHint, state.providers.find((item) => item.id === id));
    const models = await listProviderModels(provider);
    onboardingModels.value = models;
    onboardingModelsFetched.value = true;

    const selectedModelName = chooseInitialModel(onboardingForm.modelId, models);
    if (selectedModelName) onboardingForm.modelId = selectedModelName;

    showToast(models.length ? `已获取 ${models.length} 个模型` : "API 没有返回模型列表，可填写备用模型 ID");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  } finally {
    onboardingSyncingModels.value = false;
  }
}

function createGloscProviderConfig(id: string, keyHint: string, existing?: ProviderConfig): ProviderConfig {
  const now = new Date().toISOString();
  return {
    id,
    name: GLOSC_AI_PROVIDER_NAME,
    type: DEFAULT_PROVIDER_TYPE,
    baseUrl: GLOSC_AI_BASE_URL,
    chatPath: providerChatPathDefaults[DEFAULT_PROVIDER_TYPE],
    modelsPath: providerModelsPathDefaults[DEFAULT_PROVIDER_TYPE],
    customHeaders: existing?.customHeaders,
    apiKeyRef: `secret://providers/${id}`,
    keyHint,
    hasApiKey: true,
    enabled: true,
    status: "offline",
    lastCheckedAt: existing?.lastCheckedAt,
    syncedModelIds: existing?.syncedModelIds,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function chooseInitialModel(requestedModelName: string, models: ProviderModelSummary[]): string | null {
  const normalizedRequestedModel = requestedModelName.trim();
  const availableIds = new Set(models.map((model) => model.id));
  if (normalizedRequestedModel && availableIds.has(normalizedRequestedModel)) return normalizedRequestedModel;
  if (availableIds.has(GLOSC_AI_DEFAULT_MODEL)) return GLOSC_AI_DEFAULT_MODEL;
  return models[0]?.id ?? (normalizedRequestedModel || null);
}

function useCustomProviderSetup(): void {
  state.settings.onboardingCompleted = true;
  providerReturnTab.value = "chat";
  setTab("providers");
  openProviderForm();
}

function openProviders(): void {
  if (activeTab.value !== "providers") providerReturnTab.value = activeTab.value;
  setTab("providers");
}

function closeProviders(): void {
  setTab(providerReturnTab.value === "providers" ? "models" : providerReturnTab.value);
}

function newConversation(): void {
  const model = currentModel.value;
  if (!model) {
    openProviders();
    showToast("请先添加 Provider 和模型");
    return;
  }
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
  pendingAttachments.value = [];
  nextTick(scrollToBottom);
}

function selectConversation(conversationId: string): void {
  state.selectedConversationId = conversationId;
  drawerOpen.value = false;
  activeTab.value = "chat";
  nextTick(scrollToBottom);
}

function toggleConversationPinned(conversationId: string): void {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) return;
  conversation.pinned = !conversation.pinned;
  conversation.updatedAt = new Date().toISOString();
  showToast(conversation.pinned ? "会话已置顶" : "已取消置顶");
}

function toggleConversationArchived(conversationId: string): void {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) return;
  conversation.archived = !conversation.archived;
  conversation.updatedAt = new Date().toISOString();
  if (conversation.archived && state.selectedConversationId === conversation.id) {
    state.selectedConversationId = state.conversations.find((item) => !item.archived && item.id !== conversation.id)?.id ?? null;
  }
  showToast(conversation.archived ? "会话已归档" : "会话已恢复");
}

function deleteConversation(conversationId: string): void {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) return;
  if (!window.confirm(`删除会话「${conversation.title}」？此操作不会删除 Provider 配置。`)) return;
  state.conversations = state.conversations.filter((item) => item.id !== conversationId);
  delete state.messages[conversationId];
  if (state.selectedConversationId === conversationId) {
    state.selectedConversationId = state.conversations.find((item) => !item.archived)?.id ?? null;
  }
  showToast("会话已删除");
}

function exportConversationMarkdown(conversationId: string): void {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) return;
  const messages = state.messages[conversationId] ?? [];
  const markdown = [
    `# ${conversation.title}`,
    "",
    `- Provider: ${providerName(conversation.providerId)}`,
    `- Model: ${state.models.find((model) => model.id === conversation.modelId)?.displayName ?? conversation.modelId}`,
    `- Created: ${conversation.createdAt}`,
    `- Updated: ${conversation.updatedAt}`,
    "",
    ...(conversation.systemPrompt ? ["## system prompt", "", conversation.systemPrompt, ""] : []),
    ...messages.flatMap((message) => [
      `## ${message.role} · ${message.status} · ${message.createdAt}`,
      "",
      ...(message.attachments?.length ? [`Attachments: ${message.attachments.map((attachment) => attachment.name).join(", ")}`, ""] : []),
      message.content,
      "",
    ]),
  ].join("\n");

  downloadText(`${safeFileName(conversation.title)}.md`, markdown, "text/markdown");
  showToast("会话 Markdown 已导出");
}

function ensureConversation(): Conversation | null {
  const existing = currentConversation.value;
  if (existing) return existing;

  const model = currentModel.value;
  if (!model) return null;

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
  return conversation;
}

function openModelSheet(): void {
  modelSheetSearch.value = "";
  modelSheetOpen.value = true;
}

function selectModel(model: ModelConfig): void {
  if (!isModelEnabled(model)) {
    showToast("模型已禁用");
    return;
  }

  const provider = state.providers.find((item) => item.id === model.providerId);
  if (!provider?.enabled) {
    showToast("模型所属 Provider 已禁用");
    return;
  }

  const conversation = currentConversation.value;
  if (conversation) {
    conversation.modelId = model.id;
    conversation.providerId = model.providerId;
    conversation.updatedAt = new Date().toISOString();
  }
  state.settings.defaultModelId = model.id;
  modelSheetOpen.value = false;
  modelSheetSearch.value = "";
  showToast(`已切换到 ${model.displayName}`);
}

function openConversationSettings(): void {
  const conversation = currentConversation.value;
  if (!conversation) {
    showToast("还没有当前会话");
    return;
  }

  conversationForm.title = conversation.title;
  conversationForm.systemPrompt = conversation.systemPrompt ?? "";
  conversationSheetOpen.value = true;
}

function saveConversationSettings(): void {
  const conversation = currentConversation.value;
  if (!conversation) return;

  const title = conversationForm.title.trim();
  conversation.title = title || "新会话";
  conversation.systemPrompt = conversationForm.systemPrompt.trim() || undefined;
  conversation.updatedAt = new Date().toISOString();
  conversationSheetOpen.value = false;
  showToast("会话设置已保存");
}

function openPromptForm(template?: PromptTemplate): void {
  promptForm.id = template?.id ?? "";
  promptForm.name = template?.name ?? "";
  promptForm.content = template?.content ?? "";
  promptSheetOpen.value = true;
}

function savePromptTemplate(): void {
  const name = promptForm.name.trim();
  const content = promptForm.content.trim();
  if (!name || !content) {
    showToast("请填写模板名称和内容");
    return;
  }

  const now = new Date().toISOString();
  const existing = state.promptTemplates.find((template) => template.id === promptForm.id);
  if (existing) {
    existing.name = name;
    existing.content = content;
    existing.updatedAt = now;
  } else {
    state.promptTemplates.push({
      id: `prompt-${crypto.randomUUID()}`,
      name,
      content,
      createdAt: now,
      updatedAt: now,
    });
  }

  promptSheetOpen.value = false;
  showToast("提示词模板已保存");
}

function deletePromptTemplate(templateId: string): void {
  const template = state.promptTemplates.find((item) => item.id === templateId);
  if (!template) return;
  if (!window.confirm(`删除提示词模板「${template.name}」？`)) return;
  state.promptTemplates = state.promptTemplates.filter((item) => item.id !== templateId);
  showToast("提示词模板已删除");
}

function insertPromptTemplate(template: PromptTemplate): void {
  const content = renderPromptTemplate(template.content);
  draft.value = draft.value ? `${draft.value}\n\n${content}` : content;
  activeTab.value = "chat";
  showToast(`已插入：${template.name}`);
}

function renderPromptTemplate(content: string): string {
  const now = new Date();
  const replacements: Record<string, string> = {
    date: new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now),
    time: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now),
    model: currentModel.value?.displayName ?? "",
    provider: currentProvider.value?.name ?? "",
    conversation_title: currentConversation.value?.title ?? "",
  };

  return content.replace(/\{\{\s*(date|time|model|provider|conversation_title)\s*\}\}/g, (_, key: string) => replacements[key] ?? "");
}

function submitDraft(): void {
  if (activeAbort.value) {
    stopStreaming();
    return;
  }

  sendMessage();
}

function sendMessage(): void {
  if (activeAbort.value) {
    stopStreaming();
    return;
  }

  const text = draft.value.trim();
  const outgoingAttachments = clone(pendingAttachments.value);
  if (!text) return;
  const conversation = ensureConversation();
  if (!conversation) return;
  const config = resolveChatConfig(outgoingAttachments);
  if (!config) return;

  clearDraftComposer();
  contextMenu.open = false;

  const now = new Date().toISOString();
  const userMessage: ChatMessage = {
    id: `msg-${crypto.randomUUID()}`,
    conversationId: conversation.id,
    role: "user",
    content: text,
    attachments: outgoingAttachments.length ? outgoingAttachments : undefined,
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
  void streamAssistantResponse(conversation, userMessage, assistantMessage, config);
}

function submitInlineEdit(): void {
  const message = editingMessageId.value ? findMessage(editingMessageId.value) : undefined;
  if (!message) return cancelInlineEdit();

  const content = inlineEditDraft.value.trim();
  if (!content) return;

  if (message.role === "assistant") {
    message.content = content;
    message.status = "done";
    message.errorCode = undefined;
    message.updatedAt = new Date().toISOString();
    truncateMessagesAfter(message);
    cancelInlineEdit();
    showToast("消息已更新");
    return;
  }

  const started = resendMessageInPlace(message, { content, attachments: clone(message.attachments ?? []) });
  if (started) cancelInlineEdit();
}

function clearDraftComposer(): void {
  draft.value = "";
  pendingAttachments.value = [];
  void nextTick(() => resizeDraftInput());
}

function cancelInlineEdit(): void {
  editingMessageId.value = null;
  inlineEditDraft.value = "";
}

function resolveChatConfig(outgoingAttachments: MessageAttachment[]): ChatConfig | null {
  const model = currentModel.value;
  const provider = currentProvider.value;
  if (!model || !provider) {
    openProviders();
    showToast("请先添加 Provider 和模型");
    return null;
  }
  if (outgoingAttachments.some((attachment) => attachment.kind === "image") && !model.supportsVision) {
    showToast("当前模型未启用视觉能力，请在模型详情中开启后再发送图片");
    return null;
  }
  return { model, provider };
}

async function streamAssistantResponse(
  conversation: Conversation,
  userMessage: ChatMessage,
  assistantMessage: ChatMessage,
  config: ChatConfig,
  options: { scrollToBottom?: boolean } = {},
): Promise<void> {
  const scrollToLatest = options.scrollToBottom ?? true;
  const now = new Date().toISOString();
  assistantMessage.content = "";
  assistantMessage.status = "streaming";
  assistantMessage.errorCode = undefined;
  assistantMessage.updatedAt = now;
  conversation.updatedAt = now;
  activeStreamScrollToBottom.value = scrollToLatest;
  if (scrollToLatest) await nextTick(scrollToBottom);
  else await nextTick();

  if (!config.provider.enabled || !config.provider.hasApiKey) {
    assistantMessage.status = "failed";
    assistantMessage.errorCode = "auth.invalid_key";
    assistantMessage.content = "当前模型的 Provider 未配置有效 API Key。请前往 Provider 配置补全密钥后重试。";
    assistantMessage.updatedAt = new Date().toISOString();
    activeStreamScrollToBottom.value = true;
    showToast("Provider 需要有效 API Key");
    return;
  }

  const requestId = `req-${crypto.randomUUID()}`;
  const controller = new AbortController();
  activeAbort.value = controller;
  activeAssistantId.value = assistantMessage.id;
  activeRequestId.value = requestId;

  try {
    await streamChatCompletion(
      {
        requestId,
        provider: config.provider,
        model: config.model,
        messages: buildContextMessages(conversation.id, userMessage),
        parameters: config.model.defaultParameters,
      },
      (event) => {
        handleStreamEvent(event, assistantMessage);
      },
      controller.signal,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      assistantMessage.status = assistantMessage.content ? "cancelled" : "failed";
      assistantMessage.errorCode = assistantMessage.content ? undefined : "stream.interrupted";
    } else {
      assistantMessage.status = "failed";
      assistantMessage.errorCode = "network.unreachable";
      assistantMessage.content ||= error instanceof Error ? error.message : "请求失败：网络不可达，请检查网络连接后重试。";
    }
  } finally {
    if (assistantMessage.status === "streaming") finishAssistantMessage(assistantMessage);
    assistantMessage.updatedAt = new Date().toISOString();
    activeAbort.value = null;
    activeAssistantId.value = null;
    activeRequestId.value = null;
    activeStreamScrollToBottom.value = true;
    conversation.updatedAt = new Date().toISOString();
    if (scrollToLatest) await nextTick(scrollToBottom);
  }
}

function finishAssistantMessage(assistantMessage: ChatMessage): void {
  if (assistantMessage.content.trim()) {
    assistantMessage.status = "done";
    return;
  }

  assistantMessage.status = "failed";
  assistantMessage.errorCode = "stream.empty_response";
  assistantMessage.content = "Provider 返回空响应，请重试或切换模型。";
}

function stopStreaming(): void {
  const message = activeAssistantId.value ? findMessage(activeAssistantId.value) : undefined;
  if (message?.status === "streaming") {
    message.status = "cancelled";
    message.updatedAt = new Date().toISOString();
  }
  if (activeRequestId.value) void cancelChatStream(activeRequestId.value);
  activeAbort.value?.abort();
  showToast("已停止生成");
}

function buildContextMessages(conversationId: string, latestUserMessage: ChatMessage, throughMessageId = latestUserMessage.id): ChatMessage[] {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  const contextLimit = clampContextMessageLimit(state.settings.contextMessageLimit);
  const conversationMessages = state.messages[conversationId] ?? [];
  const throughIndex = conversationMessages.findIndex((message) => message.id === throughMessageId);
  const scopedMessages = throughIndex >= 0 ? conversationMessages.slice(0, throughIndex + 1) : conversationMessages;
  const messages = scopedMessages
    .filter((message) => message.status === "done" && (message.role === "user" || message.role === "assistant"))
    .slice(-contextLimit);

  if (!messages.some((message) => message.id === latestUserMessage.id)) {
    messages.push(latestUserMessage);
  }
  while (messages.length > contextLimit) messages.shift();

  const systemPrompt = conversation?.systemPrompt?.trim();
  if (!systemPrompt) return messages;

  return [
    {
      id: `system-${conversationId}`,
      conversationId,
      role: "system",
      content: systemPrompt,
      status: "done",
      createdAt: conversation?.createdAt ?? latestUserMessage.createdAt,
      updatedAt: conversation?.updatedAt ?? latestUserMessage.updatedAt,
    },
    ...messages,
  ];
}

function clampContextMessageLimit(value: number): number {
  if (!Number.isFinite(value)) return defaultSettings.contextMessageLimit;
  return Math.min(64, Math.max(4, Math.round(value)));
}

function handleStreamEvent(event: ChatStreamEvent, assistantMessage: ChatMessage): void {
  if (assistantMessage.status !== "streaming") return;

  if (event.type === "content") {
    assistantMessage.content += event.text;
    assistantMessage.updatedAt = new Date().toISOString();
    if (activeStreamScrollToBottom.value) scrollToBottom();
    return;
  }

  if (event.type === "error") {
    const code = normalizeStreamErrorCode(event);
    assistantMessage.status = "failed";
    assistantMessage.errorCode = code;
    assistantMessage.content ||= event.message;
    assistantMessage.updatedAt = new Date().toISOString();
    if (code === "auth.invalid_key") markConversationProviderKeyMissing(assistantMessage.conversationId);
    return;
  }

  finishAssistantMessage(assistantMessage);
  assistantMessage.updatedAt = new Date().toISOString();
}

function normalizeStreamErrorCode(event: Extract<ChatStreamEvent, { type: "error" }>): string {
  if (event.code !== "unknown") return event.code;
  return /api\s*key|密钥|未找到 Provider API Key/i.test(event.message) ? "auth.invalid_key" : event.code;
}

function markConversationProviderKeyMissing(conversationId: string): void {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) return;
  const provider = state.providers.find((item) => item.id === conversation.providerId);
  if (!provider) return;

  provider.hasApiKey = false;
  provider.keyHint = "";
  provider.status = "error";
  provider.updatedAt = new Date().toISOString();
}

function errorDescription(code?: string): string {
  if (!code) return "请求失败，请检查 Provider 配置后重试。";
  if (code === "auth.invalid_key") return "API Key 无效或未保存。";
  if (code === "auth.forbidden") return "API Key 没有访问该模型的权限。";
  if (code === "model.not_found") return "模型 ID 不存在、无可用渠道，或当前 Provider 不支持。";
  if (code === "rate_limited") return "Provider 返回限流，请稍后重试。";
  if (code === "network.timeout") return "网络请求超时。";
  if (code === "network.unreachable") return "网络不可达或 Provider 地址无法连接。";
  if (code === "stream.interrupted") return "流式响应中断。";
  if (code === "stream.empty_response") return "Provider 返回空响应，请重试或切换模型。";
  if (code === "provider.bad_request") return "请求格式被 Provider 拒绝，请检查模型能力和参数。";
  if (code === "provider.server_error") return "Provider 服务端错误。";
  return code;
}

function shouldShowProviderAction(code?: string): boolean {
  return Boolean(code && (code.startsWith("auth.") || code.startsWith("model.") || code.startsWith("provider.")));
}

function recoveryActionLabel(code?: string): string {
  return code?.startsWith("model.") ? "模型" : "Provider";
}

function openRecoveryAction(code?: string): void {
  if (code?.startsWith("model.")) {
    openModelSheet();
    return;
  }
  openProviders();
}

function retrySourceMessage(message: ChatMessage): ChatMessage | undefined {
  if (message.role === "user") return message;

  const messages = state.messages[message.conversationId] ?? [];
  const targetIndex = messages.findIndex((item) => item.id === message.id);
  if (targetIndex < 0) return undefined;
  return [...messages.slice(0, targetIndex)].reverse().find((item) => item.role === "user");
}

function editableSourceMessage(message: ChatMessage): ChatMessage | undefined {
  if (message.role === "user" || message.role === "assistant") return message;
  return undefined;
}

function pairedAssistantMessage(userMessage: ChatMessage): ChatMessage | undefined {
  const messages = state.messages[userMessage.conversationId] ?? [];
  const userIndex = messages.findIndex((item) => item.id === userMessage.id);
  if (userIndex < 0) return undefined;

  for (const item of messages.slice(userIndex + 1)) {
    if (item.role === "user") return undefined;
    if (item.role === "assistant") return item;
  }

  return undefined;
}

function ensureAssistantResponseSlot(userMessage: ChatMessage): ChatMessage | undefined {
  const existing = pairedAssistantMessage(userMessage);
  if (existing) return existing;

  const messages = [...(state.messages[userMessage.conversationId] ?? [])];
  const userIndex = messages.findIndex((item) => item.id === userMessage.id);
  if (userIndex < 0) return undefined;

  const now = new Date().toISOString();
  const assistantMessage: ChatMessage = {
    id: `msg-${crypto.randomUUID()}`,
    conversationId: userMessage.conversationId,
    role: "assistant",
    content: "",
    status: "streaming",
    createdAt: now,
    updatedAt: now,
  };
  messages.splice(userIndex + 1, 0, assistantMessage);
  state.messages[userMessage.conversationId] = messages;
  return assistantMessage;
}

function truncateMessagesAfter(message: ChatMessage): void {
  const messages = state.messages[message.conversationId] ?? [];
  const index = messages.findIndex((item) => item.id === message.id);
  if (index < 0 || index === messages.length - 1) return;
  state.messages[message.conversationId] = messages.slice(0, index + 1);
}

function canRetryMessage(message: ChatMessage): boolean {
  return message.status !== "streaming" && Boolean(retrySourceMessage(message));
}

function retryMessage(message?: ChatMessage): void {
  const target = message ?? findMessage(contextMenu.messageId);
  if (!target) return;

  contextMenu.open = false;
  resendMessageInPlace(target);
}

function resendMessageInPlace(target: ChatMessage, replacement?: { content: string; attachments: MessageAttachment[] }): boolean {
  if (activeAbort.value) {
    stopStreaming();
    return false;
  }

  const conversation = state.conversations.find((item) => item.id === target.conversationId);
  const source = retrySourceMessage(target);
  if (!conversation || !source) return false;

  const content = (replacement?.content ?? source.content).trim();
  const outgoingAttachments = clone(replacement?.attachments ?? source.attachments ?? []);
  if (!content) return false;

  state.selectedConversationId = conversation.id;
  const config = resolveChatConfig(outgoingAttachments);
  if (!config) return false;

  truncateMessagesAfter(target.role === "assistant" ? target : source);

  const assistantMessage = target.role === "assistant" ? target : ensureAssistantResponseSlot(source);
  if (!assistantMessage) return false;

  if (replacement) {
    source.content = content;
    source.attachments = outgoingAttachments.length ? outgoingAttachments : undefined;
    source.status = "done";
    source.errorCode = undefined;
    source.updatedAt = new Date().toISOString();
  }

  contextMenu.open = false;
  void streamAssistantResponse(conversation, source, assistantMessage, config, { scrollToBottom: false });
  return true;
}

async function copyMessage(message?: ChatMessage): Promise<void> {
  const target = message ?? findMessage(contextMenu.messageId);
  if (!target?.content.trim()) return;
  await navigator.clipboard.writeText(target.content);
  contextMenu.open = false;
  showToast("消息已复制");
}

function editMessage(message?: ChatMessage): void {
  const target = message ?? findMessage(contextMenu.messageId);
  if (!target || target.status === "streaming") return;
  const source = editableSourceMessage(target);
  if (!source) return;
  editingMessageId.value = source.id;
  inlineEditDraft.value = source.content;
  contextMenu.open = false;
  void focusInlineEditInput();
}

async function focusDraftInput(): Promise<void> {
  await nextTick();
  resizeDraftInput();
  const input = draftInput.value;
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

async function focusInlineEditInput(): Promise<void> {
  await nextTick();
  const input = document.querySelector<HTMLTextAreaElement>(".inline-edit-input");
  if (!input) return;
  resizeInlineEditInput(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function quoteMessage(): void {
  const message = findMessage(contextMenu.messageId);
  if (!message) return;
  draft.value = `> ${message.content.replace(/\n/g, "\n> ")}\n\n`;
  contextMenu.open = false;
  void focusDraftInput();
  showToast("已引用到输入框");
}

function canEditMessage(message: ChatMessage): boolean {
  return message.status !== "streaming" && Boolean(editableSourceMessage(message)?.content.trim());
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
  const appRect = document.querySelector<HTMLElement>(".app-shell")?.getBoundingClientRect();
  const offsetX = appRect ? event.clientX - appRect.left : event.clientX;
  const offsetY = appRect ? event.clientY - appRect.top : event.clientY;
  const shellWidth = appRect?.width ?? window.innerWidth;
  const shellHeight = appRect?.height ?? window.innerHeight;

  contextMenu.open = true;
  contextMenu.x = Math.min(Math.max(offsetX, 12), Math.max(12, shellWidth - 170));
  contextMenu.y = Math.min(Math.max(offsetY, 12), Math.max(12, shellHeight - 170));
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
  resizeDraftInput(el);
}

function resizeDraftInput(target?: HTMLTextAreaElement | null): void {
  const el = target ?? draftInput.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
}

function resizeInlineEdit(event: Event): void {
  resizeInlineEditInput(event.target as HTMLTextAreaElement);
}

function resizeInlineEditInput(target: HTMLTextAreaElement): void {
  target.style.height = "auto";
  target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
}

function handleDraftKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitDraft();
  }
}

function handleInlineEditKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    cancelInlineEdit();
    return;
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitInlineEdit();
  }
}

function openAttachmentPicker(): void {
  attachmentFileInput.value?.click();
}

async function handleAttachmentFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  if (isImageAttachmentFile(file)) {
    if (!currentModel.value?.supportsVision) {
      showToast("当前模型未启用视觉能力，请先在模型详情中开启视觉");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("图片不能超过 8MB");
      return;
    }

    pendingAttachments.value = [
      ...pendingAttachments.value,
      {
        id: `att-${crypto.randomUUID()}`,
        name: file.name,
        mimeType: file.type || "image/png",
        size: file.size,
        kind: "image",
        dataUrl: await readFileAsDataUrl(file),
        createdAt: new Date().toISOString(),
      },
    ];
    showToast(`已添加图片：${file.name}`);
    return;
  }

  if (!isTextAttachment(file)) {
    showToast("当前版本支持文本/Markdown/JSON 和视觉模型图片附件");
    return;
  }

  const text = await file.text();
  const attachmentText = `\n\n---\n附件：${file.name}\n\n${text}\n---\n`;
  draft.value = `${draft.value}${attachmentText}`.trimStart();
  showToast(`已加入附件：${file.name}`);
}

function removePendingAttachment(attachmentId: string): void {
  pendingAttachments.value = pendingAttachments.value.filter((attachment) => attachment.id !== attachmentId);
}

function isImageAttachmentFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function isTextAttachment(file: File): boolean {
  return (
    file.type.startsWith("text/") ||
    ["application/json", "application/xml"].includes(file.type) ||
    /\.(txt|md|markdown|json|csv|tsv|xml|log)$/i.test(file.name)
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取附件失败"));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function conversationPreview(conversation: Conversation): string {
  const messages = state.messages[conversation.id] ?? [];
  const last = [...messages].reverse().find((message) => message.role !== "system");
  if (!last) return "还没有消息";
  return last.content.replace(/\s+/g, " ").slice(0, 42) || `${last.attachments?.length ?? 0} 个附件`;
}

function providerName(providerId: string): string {
  return state.providers.find((provider) => provider.id === providerId)?.name ?? "Unknown";
}

function providerInitial(provider: ProviderConfig): string {
  return provider.name.trim().slice(0, 1).toUpperCase() || "P";
}

function providerClass(provider?: ProviderConfig): string {
  if (!provider) return "custom";
  if (provider.type === "chat-completions") return "compatible";
  if (provider.type === "anthropic") return "anthropic";
  if (provider.type === "gemini") return "gemini";
  return "custom";
}

function statusLabel(provider: ProviderConfig): string {
  if (!provider.enabled) return "已禁用";
  if (provider.status === "testing") return "检测中";
  if (provider.status === "online") return "已连接";
  if (provider.status === "error") return "需检查";
  return "离线";
}

function openProviderForm(provider?: ProviderConfig): void {
  providerForm.id = provider?.id ?? "";
  providerForm.name = provider?.name ?? "";
  providerForm.type = provider?.type ?? DEFAULT_PROVIDER_TYPE;
  providerForm.baseUrl = provider?.baseUrl ?? providerTypeDefaults[providerForm.type];
  providerForm.chatPath = provider?.chatPath ?? providerChatPathDefaults[providerForm.type];
  providerForm.modelsPath = provider?.modelsPath ?? providerModelsPathDefaults[providerForm.type];
  providerForm.modelId = "";
  providerForm.modelDisplayName = "";
  providerForm.contextWindow = "自定义";
  providerForm.apiKey = "";
  providerForm.keyHint = provider?.keyHint ?? "";
  providerForm.showKey = false;
  providerForm.customHeaders = provider?.customHeaders ?? "";
  providerSheetOpen.value = true;
}

function changeProviderType(type: ProviderType): void {
  providerForm.type = type;
  providerForm.baseUrl = providerTypeDefaults[type];
  providerForm.chatPath = providerChatPathDefaults[type];
  providerForm.modelsPath = providerModelsPathDefaults[type];
}

async function saveProvider(): Promise<void> {
  const name = providerForm.name.trim();
  const baseUrl = providerForm.baseUrl.trim();
  const modelName = providerForm.modelId.trim();
  const apiKey = providerForm.apiKey.trim();
  if (!name || !baseUrl) {
    showToast("请填写名称和 Base URL");
    return;
  }
  if (!isValidHttpUrl(baseUrl)) {
    showToast("Base URL 必须是 http(s) 地址");
    return;
  }
  const customHeaderError = validateCustomHeaders(providerForm.customHeaders);
  if (customHeaderError) {
    showToast(customHeaderError);
    return;
  }
  if (!providerForm.id && !modelName && !apiKey) {
    showToast("请填写 API Key 用于同步模型，或填写备用模型 ID");
    return;
  }

  const id = providerForm.id || uniqueProviderId(name);
  const existing = state.providers.find((provider) => provider.id === id);
  let keyHint = existing?.keyHint ?? "";
  let hasApiKey = existing?.hasApiKey ?? false;
  let savedNewApiKey = false;

  if (apiKey) {
    try {
      keyHint = await saveApiKey(id, apiKey);
      hasApiKey = true;
      savedNewApiKey = true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
      return;
    }
  } else if (existing) {
    hasApiKey = await apiKeyExists(id);
  }

  const now = new Date().toISOString();
  const nextProvider: ProviderConfig = {
    id,
    name,
    type: providerForm.type,
    baseUrl,
    chatPath: providerForm.chatPath.trim() || providerChatPathDefaults[providerForm.type],
    modelsPath: providerForm.modelsPath.trim() || providerModelsPathDefaults[providerForm.type],
    customHeaders: providerForm.customHeaders.trim() || undefined,
    apiKeyRef: `secret://providers/${id}`,
    keyHint,
    hasApiKey,
    enabled: true,
    status: hasApiKey ? (savedNewApiKey ? "offline" : existing?.status ?? "offline") : "error",
    lastCheckedAt: existing?.lastCheckedAt,
    syncedModelIds: existing?.syncedModelIds,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    Object.assign(existing, nextProvider);
  } else {
    state.providers.push(nextProvider);
  }
  const activeProvider = existing ?? nextProvider;

  providerSheetOpen.value = false;

  let syncedModels: ProviderModelSummary[] = [];
  let syncError: unknown = null;
  if (hasApiKey) {
    try {
      syncedModels = await syncProviderModels(activeProvider);
    } catch (error) {
      syncError = error;
    }
  }

  if (modelName) {
    upsertModel(activeProvider, {
      id: modelName,
      displayName: providerForm.modelDisplayName.trim() || modelName,
    }, providerForm.contextWindow.trim() || "自定义");
  }

  const selectedModelName = chooseInitialModel(modelName, syncedModels);
  if (!state.settings.defaultModelId) {
    state.settings.defaultModelId = selectedModelName ? `${id}:${selectedModelName}` : null;
  }
  ensureDefaultModelExists(id);

  if (!state.selectedConversationId && state.settings.defaultModelId) {
    newConversation();
  }

  if (syncError) {
    showToast(syncError instanceof Error ? `Provider 已保存，模型同步失败：${syncError.message}` : "Provider 已保存，模型同步失败");
  } else if (hasApiKey) {
    showToast(syncedModels.length ? `Provider 已保存，已从 API 同步 ${syncedModels.length} 个模型` : "Provider 已保存，但 API 没有返回模型列表");
  } else {
    showToast("Provider 已保存，请补充 API Key 后同步模型");
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateCustomHeaders(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "自定义 Headers 必须是 JSON 对象";

    for (const [key, headerValue] of Object.entries(parsed as Record<string, unknown>)) {
      if (!key.trim()) return "Header 名称不能为空";
      if (["authorization", "x-api-key"].includes(key.toLowerCase())) return "Authorization 和 x-api-key 由应用管理";
      if (typeof headerValue !== "string") return `Header 值必须是字符串：${key}`;
    }

    return null;
  } catch {
    return "自定义 Headers 必须是有效 JSON";
  }
}

function upsertModel(provider: ProviderConfig, summary: ProviderModelSummary, contextWindow = "自定义"): void {
  const id = `${provider.id}:${summary.id}`;
  const existing = state.models.find((model) => model.id === id);
  const next: ModelConfig = {
    id,
    providerId: provider.id,
    name: summary.id,
    displayName: summary.displayName || summary.id,
    version: summary.id,
    enabled: existing?.enabled ?? true,
    supportsStreaming: existing?.supportsStreaming ?? true,
    supportsVision: existing?.supportsVision ?? false,
    supportsTools: existing?.supportsTools ?? false,
    contextWindow: existing?.contextWindow ?? contextWindow,
    defaultParameters: existing?.defaultParameters ?? { ...defaultParameters },
  };

  if (existing) {
    Object.assign(existing, next);
  } else {
    state.models.push({
      ...next,
    });
  }
}

async function syncProviderModels(provider: ProviderConfig): Promise<ProviderModelSummary[]> {
  provider.status = "testing";
  try {
    const models = await listProviderModels(provider);
    applySyncedProviderModels(provider, models);
    return models;
  } catch (error) {
    const checkedAt = new Date().toISOString();
    provider.status = "error";
    provider.lastCheckedAt = checkedAt;
    provider.updatedAt = checkedAt;
    throw error;
  }
}

function applySyncedProviderModels(provider: ProviderConfig, models: ProviderModelSummary[]): void {
  replaceSyncedProviderModels(provider, models);
  const checkedAt = new Date().toISOString();
  provider.status = "online";
  provider.hasApiKey = true;
  provider.lastCheckedAt = checkedAt;
  provider.updatedAt = checkedAt;
  ensureDefaultModelExists(provider.id);
}

function replaceSyncedProviderModels(provider: ProviderConfig, models: ProviderModelSummary[]): void {
  const previousSyncedIds = new Set(provider.syncedModelIds ?? []);
  const incomingSyncedIds = new Set(models.map((model) => model.id));
  models.forEach((model) => upsertModel(provider, model));

  if (previousSyncedIds.size) {
    state.models = state.models.filter((model) => model.providerId !== provider.id || !previousSyncedIds.has(model.name) || incomingSyncedIds.has(model.name));
  }

  provider.syncedModelIds = models.map((model) => model.id);
}

function ensureDefaultModelExists(preferredProviderId?: string): void {
  const models = state.models.filter((model) => isSelectableModel(model));
  if (state.settings.defaultModelId && models.some((model) => model.id === state.settings.defaultModelId)) return;
  const preferredProviderModel = preferredProviderId ? models.find((model) => model.providerId === preferredProviderId) : undefined;
  state.settings.defaultModelId = preferredProviderModel?.id ?? models[0]?.id ?? null;
}

async function refreshAllProviderModels(showResult = true): Promise<void> {
  if (syncingAllProviders.value) return;
  const providers = syncableProviders.value;
  if (!providers.length) {
    if (showResult) showToast("没有可同步的 Provider，请先保存 API Key");
    return;
  }

  syncingAllProviders.value = true;
  const results = await Promise.allSettled(providers.map((provider) => syncProviderModels(provider)));
  syncingAllProviders.value = false;

  if (!showResult) return;

  const syncedCount = results.reduce((sum, result) => (result.status === "fulfilled" ? sum + result.value.length : sum), 0);
  const failedCount = results.filter((result) => result.status === "rejected").length;
  if (failedCount) {
    showToast(`已同步 ${syncedCount} 个模型，${failedCount} 个 Provider 失败`);
    return;
  }
  showToast(syncedCount ? `已从 API 同步 ${syncedCount} 个模型` : "API 没有返回模型列表");
}

async function testConnection(providerId: string): Promise<void> {
  const provider = state.providers.find((item) => item.id === providerId);
  if (!provider) return;

  try {
    const models = await syncProviderModels(provider);
    showToast(models.length ? `连接正常，已从 API 同步 ${models.length} 个模型` : "连接正常，但 API 没有返回模型列表");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
}

async function disableProvider(providerId: string): Promise<void> {
  const provider = state.providers.find((item) => item.id === providerId);
  if (!provider) return;
  provider.enabled = false;
  provider.status = "offline";
  provider.updatedAt = new Date().toISOString();
  await deleteApiKey(providerId);
  provider.hasApiKey = false;
  provider.keyHint = "";
  showToast(`已禁用 ${provider.name}`);
}

function isModelEnabled(model: ModelConfig): boolean {
  return model.enabled !== false;
}

function isSelectableModel(model: ModelConfig): boolean {
  const provider = state.providers.find((item) => item.id === model.providerId);
  return isModelEnabled(model) && Boolean(provider?.enabled);
}

function modelMatchesFilter(model: ModelConfig): boolean {
  if (modelFilter.value === "all") return true;
  if (modelFilter.value === "chat") return true;
  if (modelFilter.value === "vision") return model.supportsVision;
  return model.supportsTools;
}

function modelMatchesSearch(model: ModelConfig, provider: ProviderConfig, keyword: string): boolean {
  if (!keyword) return true;
  return [model.displayName, model.name, model.version, model.contextWindow, provider.name].join(" ").toLowerCase().includes(keyword);
}

function openModelDetail(model: ModelConfig): void {
  detailModel.value = model;
  Object.assign(detailParameters, model.defaultParameters);
  detailSheetOpen.value = true;
}

function toggleModelEnabled(model: ModelConfig): void {
  model.enabled = !isModelEnabled(model);
  if (!model.enabled && state.settings.defaultModelId === model.id) {
    state.settings.defaultModelId = null;
  }
  ensureDefaultModelExists(model.providerId);
  showToast(`${model.enabled ? "已启用" : "已禁用"} ${model.displayName}`);
}

function removeModel(model: ModelConfig): void {
  if (!window.confirm(`移除模型「${model.displayName}」？此操作不会删除 Provider 配置。`)) return;

  const provider = state.providers.find((item) => item.id === model.providerId);
  if (provider?.syncedModelIds) {
    provider.syncedModelIds = provider.syncedModelIds.filter((id) => id !== model.name);
  }

  state.models = state.models.filter((item) => item.id !== model.id);
  if (state.settings.defaultModelId === model.id) {
    state.settings.defaultModelId = null;
  }
  ensureDefaultModelExists(model.providerId);

  const replacement = state.settings.defaultModelId ? state.models.find((item) => item.id === state.settings.defaultModelId) : undefined;
  if (replacement) {
    const updatedAt = new Date().toISOString();
    state.conversations.forEach((conversation) => {
      if (conversation.modelId !== model.id) return;
      conversation.modelId = replacement.id;
      conversation.providerId = replacement.providerId;
      conversation.updatedAt = updatedAt;
    });
  }

  if (detailModel.value?.id === model.id) {
    detailModel.value = null;
    detailSheetOpen.value = false;
  }

  showToast(`已移除 ${model.displayName}`);
}

function saveModelAsDefault(): void {
  const model = detailModel.value;
  if (!model) return;
  if (!isSelectableModel(model)) {
    showToast(isModelEnabled(model) ? "模型所属 Provider 已禁用" : "模型已禁用");
    return;
  }
  model.defaultParameters = { ...detailParameters };
  selectModel(model);
  detailSheetOpen.value = false;
}

function capabilityTags(model: ModelConfig): string[] {
  const tags = isModelEnabled(model) ? ["流式"] : ["已禁用", "流式"];
  if (model.supportsVision) tags.push("视觉");
  if (model.supportsTools) tags.push("工具调用");
  tags.push(model.contextWindow);
  return tags;
}

async function copyExport(): Promise<void> {
  if (!window.confirm("导出 JSON 会包含会话正文、系统提示词和附件数据，可能包含敏感信息。确认导出？")) return;
  downloadText(`glosc-chat-export-${new Date().toISOString().slice(0, 10)}.json`, exportPersistedState(snapshotState()), "application/json");
  showToast("已导出 JSON 文件，API Key 不包含在内");
}

async function handleImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text()) as Partial<PersistedState>;
    if (imported.schemaVersion !== 2) {
      showToast("导入文件 schema version 不兼容");
      return;
    }
    Object.assign(state, normalizeImportedState(imported));
    await refreshImportedProviderKeyState();
    showToast("已导入本地数据，缺失的 API Key 需要重新保存");
  } catch {
    showToast("导入文件不是有效的 Glosc Chat JSON");
  }
}

async function clearAllData(): Promise<void> {
  activeAbort.value?.abort();
  await Promise.allSettled(state.providers.map((provider) => deleteApiKey(provider.id)));
  await clearPersistedState();
  Object.assign(state, createInitialState());
  pendingAttachments.value = [];
  clearSheetOpen.value = false;
  activeTab.value = "chat";
  showToast("已清除本地数据");
}

function normalizeImportedState(imported: Partial<PersistedState>): PersistedState {
  return {
    schemaVersion: 2,
    providers: (imported.providers ?? []).map(normalizeProvider),
    models: (imported.models ?? []).map(normalizeModel),
    conversations: imported.conversations ?? [],
    messages: imported.messages ?? {},
    promptTemplates: imported.promptTemplates ?? [],
    settings: normalizeSettings(imported.settings),
    selectedConversationId: imported.selectedConversationId ?? null,
    exportedAt: imported.exportedAt,
  };
}

function normalizeProvider(provider: ProviderConfig): ProviderConfig {
  return {
    ...provider,
    type: normalizeProviderType(provider.type),
  };
}

function normalizeProviderType(type: unknown): ProviderType {
  if (type === LEGACY_COMPATIBLE_PROVIDER_TYPE) return DEFAULT_PROVIDER_TYPE;
  if (type === "chat-completions" || type === "anthropic" || type === "gemini" || type === "custom") return type;
  return "custom";
}

function normalizeModel(model: ModelConfig): ModelConfig {
  return {
    ...model,
    enabled: model.enabled ?? true,
    defaultParameters: {
      ...defaultParameters,
      ...(model.defaultParameters ?? {}),
    },
  };
}

function normalizeSettings(settings?: Partial<UserSettings>): UserSettings {
  return {
    ...defaultSettings,
    ...settings,
    contextMessageLimit: clampContextMessageLimit(settings?.contextMessageLimit ?? defaultSettings.contextMessageLimit),
  };
}

async function refreshImportedProviderKeyState(): Promise<void> {
  await Promise.all(
    state.providers.map(async (provider) => {
      const exists = await apiKeyExists(provider.id);
      provider.hasApiKey = exists;
      if (!exists) {
        provider.keyHint = "";
        provider.status = "error";
      } else if (provider.status === "error") {
        provider.status = "offline";
      }
    }),
  );
}

function adjustContextMessageLimit(delta: number): void {
  state.settings.contextMessageLimit = clampContextMessageLimit(state.settings.contextMessageLimit + delta);
}

function toggleDarkMode(): void {
  state.settings.darkMode = !state.settings.darkMode;
}

function cycleFontSize(): void {
  state.settings.fontSize = state.settings.fontSize === "small" ? "medium" : state.settings.fontSize === "medium" ? "large" : "small";
  showToast(`字体大小：${fontSizeLabel(state.settings.fontSize)}`);
}

function toggleAutoCheckUpdates(): void {
  state.settings.autoCheckUpdates = !state.settings.autoCheckUpdates;
  showToast(state.settings.autoCheckUpdates ? "已开启自动检查更新" : "已关闭自动检查更新");
  if (state.settings.autoCheckUpdates) void checkForUpdates({ silent: true });
}

async function checkForUpdates(options: { silent?: boolean } = {}): Promise<void> {
  if (updateChecking.value) return;

  updateChecking.value = true;
  updateProgress.value = null;
  updateStatusText.value = "检查中";

  try {
    const result = await checkForAppUpdate();
    appVersion.value = result.currentVersion;

    if (result.status === "available") {
      availableUpdate.value = result;
      updateStatusText.value = `发现 v${result.version}`;
      showToast(`发现新版本 v${result.version}`);
      return;
    }

    availableUpdate.value = null;
    updateStatusText.value = "已是最新";
    if (!options.silent) showToast("当前已是最新版本");
  } catch (error) {
    updateStatusText.value = "检查失败";
    if (!options.silent) showToast(formatUpdateError(error));
  } finally {
    updateChecking.value = false;
    updateProgress.value = null;
  }
}

async function installOrOpenUpdate(): Promise<void> {
  const update = availableUpdate.value;
  if (!update) {
    await checkForUpdates();
    return;
  }

  if (update.source === "github-release") {
    await openExternalUrl(update.downloadUrl);
    showToast(update.assetName ? "已打开 APK 下载" : "已打开 Release 页面");
    return;
  }

  if (!window.confirm(`安装 Glosc Chat v${update.version} 并重启应用？`)) return;

  updateChecking.value = true;
  updateStatusText.value = "下载中";
  updateProgress.value = 0;

  let downloadedBytes = 0;
  let contentLength = 0;

  try {
    await installDesktopUpdate(update, (event) => {
      if (event.event === "Started") {
        downloadedBytes = 0;
        contentLength = event.data.contentLength ?? 0;
        updateProgress.value = contentLength > 0 ? 0 : null;
        return;
      }

      if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        updateProgress.value = contentLength > 0 ? Math.min(99, Math.round((downloadedBytes / contentLength) * 100)) : null;
        return;
      }

      updateProgress.value = 100;
      updateStatusText.value = "安装中";
    });
    showToast("更新已安装，正在重启应用");
  } catch (error) {
    updateStatusText.value = "安装失败";
    showToast(formatUpdateError(error));
  } finally {
    updateChecking.value = false;
    updateProgress.value = null;
  }
}

function formatUpdateError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "更新操作失败";
}

function renderMarkdown(content: string): string {
  return markdown.render(content);
}

function isSafeMarkdownLink(url: string): boolean {
  return /^(https?:|mailto:)/i.test(url);
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

function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || "conversation";
}

function resolveGloscProviderId(): string {
  const existing = state.providers.find((provider) => provider.id === GLOSC_AI_PROVIDER_ID || provider.name === GLOSC_AI_PROVIDER_NAME);
  if (existing) return existing.id;
  if (!state.providers.some((provider) => provider.id === GLOSC_AI_PROVIDER_ID)) return GLOSC_AI_PROVIDER_ID;
  return uniqueProviderId(GLOSC_AI_PROVIDER_NAME);
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
  <main
    class="glosc-app"
    :class="[{ dark: state.settings.darkMode, 'keyboard-open': keyboardInset > 0 }, `font-${state.settings.fontSize}`]"
    :style="{ '--keyboard-inset': `${keyboardInset}px`, '--app-height': appHeight ? `${appHeight}px` : '100dvh' }"
  >
    <section class="app-shell" aria-label="Glosc Chat">
      <section v-if="showOnboarding" class="onboarding-screen" aria-label="初始化配置">
        <div class="onboarding-top">
          <div class="onboarding-mark">
            <KeyRound :size="28" />
          </div>
          <span class="onboarding-kicker">初始化配置</span>
          <h1>连接你的 AI 渠道</h1>
          <p>默认渠道商为 Glosc AI，保存 API Key 后会从 API 动态同步可用模型。</p>
        </div>

        <form class="onboarding-form" @submit.prevent="completeOnboarding">
          <div class="onboarding-provider">
            <span>
              <small>默认渠道商</small>
              <strong>{{ GLOSC_AI_PROVIDER_NAME }}</strong>
            </span>
            <button type="button" @click="openExternalUrl(GLOSC_AI_HOME_URL)">
              <ExternalLink :size="15" />
            </button>
          </div>

          <label class="field onboarding-field">
            <span>API Key</span>
            <span class="secret-input">
              <input
                v-model="onboardingForm.apiKey"
                :type="onboardingForm.showKey ? 'text' : 'password'"
                placeholder="输入 Glosc AI API Key"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
              />
              <button type="button" aria-label="切换密钥可见性" @click="onboardingForm.showKey = !onboardingForm.showKey">
                <EyeOff v-if="onboardingForm.showKey" :size="18" />
                <Eye v-else :size="18" />
              </button>
            </span>
            <button class="key-link" type="button" @click="openExternalUrl(GLOSC_AI_KEYS_URL)">
              没有key?现在获取
              <ExternalLink :size="13" />
            </button>
          </label>

          <label class="field onboarding-field">
            <span>备用模型 ID</span>
            <span class="model-id-control">
              <input
                v-model="onboardingForm.modelId"
                type="text"
                list="onboarding-model-options"
                placeholder="例如：deepseek/deepseek-v4-flash"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
              />
              <button class="model-fetch-btn" type="button" :disabled="onboardingSyncingModels" @click="fetchOnboardingModels">
                <RefreshCw :class="{ spin: onboardingSyncingModels }" :size="15" />
                {{ onboardingSyncingModels ? "获取中" : "获取模型" }}
              </button>
            </span>
            <datalist id="onboarding-model-options">
              <option v-for="model in onboardingModels" :key="model.id" :value="model.id">{{ model.displayName }}</option>
            </datalist>
            <div v-if="onboardingModels.length" class="onboarding-model-list" aria-label="已获取模型">
              <button v-for="model in onboardingModels.slice(0, 6)" :key="model.id" type="button" @click="onboardingForm.modelId = model.id">
                {{ model.displayName }}
              </button>
            </div>
            <small>
              {{
                onboardingModelsFetched
                  ? onboardingModels.length
                    ? `已获取 ${onboardingModels.length} 个模型，可从候选中切换。`
                    : "API 未返回模型列表，可手动填写备用模型 ID。"
                  : "可选；API 未返回模型列表时作为默认模型使用。"
              }}
            </small>
          </label>

          <div class="onboarding-actions">
            <button class="primary-btn" type="submit">完成初始化</button>
            <button class="secondary-btn" type="button" @click="useCustomProviderSetup">使用其他 Provider</button>
          </div>
        </form>
      </section>

      <template v-else>
      <template v-if="activeTab === 'chat'">
        <header class="chat-nav">
          <button class="icon-btn accent" type="button" aria-label="会话列表" @click="drawerOpen = true">
            <Menu :size="22" />
          </button>
          <div class="title-area">
            <div class="conv-title">{{ currentConversation?.title ?? "AI 助手" }}</div>
            <button class="model-badge" type="button" @click="openModelSheet">
              {{ currentModel?.displayName ?? "选择模型" }}
              <ChevronRight :size="12" />
            </button>
          </div>
          <button class="icon-btn" type="button" aria-label="会话详情" @click="openConversationSettings">
            <MoreHorizontal :size="22" />
          </button>
        </header>

        <section v-if="!sendableProviderExists" class="no-provider-state">
          <AlertTriangle :size="42" />
          <h2>还没有可用 Provider</h2>
          <p>添加 Provider 和 API Key 后会从 Models API 同步模型列表。</p>
          <button class="primary-action" type="button" @click="openProviders">添加 Provider</button>
        </section>

        <section v-else ref="messagesEl" class="messages" aria-live="polite">
          <div v-if="currentMessages.length === 0" class="empty-state">
            <div class="empty-icon"><Bot :size="34" /></div>
            <h2>今天想聊什么？</h2>
            <p>当前会话会保存在本地，发送后由你配置的 Provider 返回真实响应。</p>
            <div v-if="state.promptTemplates.length" class="prompt-template-list compact">
              <button v-for="template in state.promptTemplates" :key="template.id" type="button" @click="insertPromptTemplate(template)">
                {{ template.name }}
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
            <template v-if="editingMessageId === message.id">
              <div class="inline-edit" @pointerdown.stop>
                <div v-if="message.attachments?.length" class="message-attachments">
                  <div v-for="attachment in message.attachments" :key="attachment.id" class="message-attachment" :class="attachment.kind">
                    <img v-if="attachment.kind === 'image' && attachment.dataUrl" :src="attachment.dataUrl" :alt="attachment.name" />
                    <FileText v-else :size="15" />
                    <span>{{ attachment.name }}</span>
                  </div>
                </div>
                <textarea
                  v-model="inlineEditDraft"
                  class="inline-edit-input"
                  rows="1"
                  aria-label="编辑消息"
                  @input="resizeInlineEdit"
                  @keydown="handleInlineEditKeydown"
                ></textarea>
                <div class="inline-edit-actions">
                  <button type="button" aria-label="取消编辑" title="取消" @click.stop="cancelInlineEdit">
                    <X :size="14" />
                  </button>
                  <button type="button" class="confirm" aria-label="保存并重新发送" title="保存" :disabled="!inlineEditDraft.trim() || Boolean(activeAbort)" @click.stop="submitInlineEdit">
                    <Check :size="14" />
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="bubble">
                <div v-if="message.attachments?.length" class="message-attachments">
                  <div v-for="attachment in message.attachments" :key="attachment.id" class="message-attachment" :class="attachment.kind">
                    <img v-if="attachment.kind === 'image' && attachment.dataUrl" :src="attachment.dataUrl" :alt="attachment.name" />
                    <FileText v-else :size="15" />
                    <span>{{ attachment.name }}</span>
                  </div>
                </div>
                <div v-if="message.content.trim()" class="markdown-body" v-html="renderMarkdown(message.content)"></div>
                <span v-if="message.status === 'streaming' && message.id === activeAssistantId" class="streaming-cursor"></span>
              </div>
              <div class="message-actions" role="group" aria-label="消息操作">
                <button type="button" aria-label="复制" title="复制" :disabled="!message.content.trim()" @click.stop="copyMessage(message)">
                  <Copy :size="14" />
                </button>
                <button type="button" aria-label="编辑" title="编辑" :disabled="!canEditMessage(message)" @click.stop="editMessage(message)">
                  <Pencil :size="14" />
                </button>
                <button class="retry-action" type="button" aria-label="重试" title="重试" :disabled="Boolean(activeAbort) || !canRetryMessage(message)" @click.stop="retryMessage(message)">
                  <RotateCcw :size="14" />
                </button>
              </div>
              <div v-if="message.status === 'failed'" class="error-recovery">
                <span>{{ errorDescription(message.errorCode) }}</span>
                <button v-if="shouldShowProviderAction(message.errorCode)" type="button" @click.stop="openRecoveryAction(message.errorCode)">
                  {{ recoveryActionLabel(message.errorCode) }}
                </button>
              </div>
              <div class="message-meta">
                <span>{{ formatMessageTime(message.createdAt) }}</span>
                <span v-if="message.status === 'cancelled'">已停止</span>
                <span v-if="message.status === 'failed'">{{ message.errorCode }}</span>
              </div>
            </template>
          </article>
        </section>

        <form class="input-area" @submit.prevent="submitDraft()">
          <div v-if="pendingAttachments.length" class="pending-attachments">
            <div v-for="attachment in pendingAttachments" :key="attachment.id" class="pending-attachment">
              <img v-if="attachment.kind === 'image' && attachment.dataUrl" :src="attachment.dataUrl" :alt="attachment.name" />
              <span>
                <strong>{{ attachment.name }}</strong>
                <small>{{ formatFileSize(attachment.size) }}</small>
              </span>
              <button type="button" aria-label="移除附件" @click="removePendingAttachment(attachment.id)">×</button>
            </div>
          </div>
          <button class="attach-btn" type="button" aria-label="添加附件" @click="openAttachmentPicker">
            <Paperclip :size="20" />
          </button>
          <textarea
            ref="draftInput"
            v-model="draft"
            class="message-input"
            rows="1"
            placeholder="发送消息..."
            @input="resizeDraft"
            @keydown="handleDraftKeydown"
          ></textarea>
          <button class="send-btn" type="submit" :aria-label="activeAbort ? '停止' : '发送'" :disabled="!canSubmitDraft">
            <Square v-if="activeAbort" :size="17" />
            <Send v-else :size="18" />
          </button>
        </form>
      </template>

      <template v-else-if="activeTab === 'models'">
        <header class="nav-header">
          <div>
            <h1>模型</h1>
            <p>{{ state.models.length }} 个模型 · {{ state.providers.filter((item) => item.enabled).length }} 个 Provider{{ syncingAllProviders ? " · 同步中" : "" }}</p>
          </div>
          <div class="nav-actions">
            <button class="pill-btn" type="button" :disabled="syncingAllProviders || !syncableProviders.length" @click="refreshAllProviderModels()">
              <RefreshCw :size="15" />
              刷新
            </button>
            <button class="pill-btn" type="button" @click="openProviders">
              <KeyRound :size="15" />
              Provider
            </button>
          </div>
        </header>

        <label class="model-search">
          <Search :size="16" />
          <input v-model="modelSearch" type="search" placeholder="搜索模型或 Provider" autocomplete="off" autocapitalize="off" spellcheck="false" />
        </label>

        <div class="segmented" role="tablist" aria-label="模型筛选">
          <button :class="{ active: modelFilter === 'all' }" type="button" @click="modelFilter = 'all'">全部</button>
          <button :class="{ active: modelFilter === 'chat' }" type="button" @click="modelFilter = 'chat'">对话</button>
          <button :class="{ active: modelFilter === 'vision' }" type="button" @click="modelFilter = 'vision'">视觉</button>
          <button :class="{ active: modelFilter === 'tools' }" type="button" @click="modelFilter = 'tools'">工具</button>
        </div>

        <section class="content scrollable models-content">
          <div v-if="state.models.length === 0" class="content-empty-state">
            <Cpu :size="38" />
            <h2>还没有模型</h2>
            <p>保存 Provider API Key 后，应用会从配置的 Models Path 动态同步模型列表。</p>
            <button v-if="syncableProviders.length" class="primary-action" type="button" :disabled="syncingAllProviders" @click="refreshAllProviderModels()">
              <RefreshCw :size="16" />
              刷新模型
            </button>
            <button v-else class="primary-action" type="button" @click="openProviders">添加 Provider</button>
          </div>
          <div v-else-if="modelGroups.length === 0" class="content-empty-state">
            <Search :size="38" />
            <h2>没有匹配模型</h2>
            <p>换一个关键词，或切回全部能力筛选。</p>
            <button v-if="modelSearch" class="secondary-btn" type="button" @click="modelSearch = ''">清空搜索</button>
          </div>
          <div v-for="group in modelGroups" :key="group.provider.id" class="provider-group">
            <div class="provider-group-header">
              <div class="provider-icon small" :class="providerClass(group.provider)">{{ providerInitial(group.provider) }}</div>
              <span class="provider-group-name">{{ group.provider.name }}</span>
              <span class="provider-group-count">{{ group.models.length }} 个模型</span>
            </div>

            <div
              v-for="model in group.models"
              :key="model.id"
              class="model-swipe"
              :class="{ disabled: !isModelEnabled(model) }"
            >
              <div class="model-swipe-track">
                <button
                  class="model-card"
                  :class="{ selected: model.id === currentModel?.id, disabled: !isModelEnabled(model) }"
                  type="button"
                  @click="selectModel(model)"
                >
                  <span>
                    <strong>{{ model.displayName }}</strong>
                    <small>{{ model.version }}</small>
                  </span>
                  <span class="check-circle"><Check v-if="model.id === currentModel?.id" :size="15" /></span>
                  <span class="cap-tags">
                    <span
                      v-for="tag in capabilityTags(model)"
                      :key="tag"
                      class="cap-tag"
                      :class="{ context: tag.includes('K') || tag.includes('M'), disabled: tag === '已禁用' }"
                    >
                      {{ tag }}
                    </span>
                  </span>
                </button>
                <div class="model-swipe-actions" aria-label="模型操作">
                  <button type="button" @click="openModelDetail(model)">
                    <Pencil :size="15" />
                    <span>编辑</span>
                  </button>
                  <button class="warning" type="button" @click="toggleModelEnabled(model)">
                    <WifiOff :size="15" />
                    <span>{{ isModelEnabled(model) ? "禁用" : "启用" }}</span>
                  </button>
                  <button class="danger" type="button" @click="removeModel(model)">
                    <Trash2 :size="15" />
                    <span>移除</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="activeTab === 'providers'">
        <header class="nav-header compact">
          <button class="icon-btn accent" type="button" aria-label="返回上一页" @click="closeProviders">
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
              <button class="success" type="button" :disabled="provider.status === 'testing'" @click="testConnection(provider.id)"><RefreshCw :size="14" /> 同步</button>
              <button class="danger" type="button" @click="disableProvider(provider.id)"><WifiOff :size="14" /> 移除 Key</button>
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
              <button class="settings-row" type="button" @click="importFileInput?.click()">
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
            <div class="settings-group-title">对话</div>
            <div class="settings-card">
              <div class="settings-row settings-control-row">
                <span class="row-left"><ListFilter :size="18" /> 上下文消息数</span>
                <span class="stepper-control">
                  <button type="button" aria-label="减少上下文消息数" @click="adjustContextMessageLimit(-2)">-</button>
                  <strong>{{ state.settings.contextMessageLimit }}</strong>
                  <button type="button" aria-label="增加上下文消息数" @click="adjustContextMessageLimit(2)">+</button>
                </span>
              </div>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">提示词</div>
            <div class="settings-card prompt-card">
              <button class="settings-row" type="button" @click="openPromptForm()">
                <span class="row-left"><Plus :size="18" /> 新建提示词模板</span>
                <ChevronRight :size="16" />
              </button>
              <div v-if="state.promptTemplates.length" class="prompt-template-list">
                <div v-for="template in state.promptTemplates" :key="template.id" class="prompt-template-row">
                  <button type="button" @click="insertPromptTemplate(template)">
                    <strong>{{ template.name }}</strong>
                    <span>{{ template.content.slice(0, 60) }}</span>
                  </button>
                  <button type="button" @click="openPromptForm(template)">编辑</button>
                  <button class="danger" type="button" @click="deletePromptTemplate(template.id)">删除</button>
                </div>
              </div>
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
            <div class="settings-group-title">应用更新</div>
            <div class="settings-card">
              <button class="settings-row" type="button" :disabled="updateChecking" @click="installOrOpenUpdate">
                <span class="row-left"><Download :size="18" /> {{ updateActionLabel }}</span>
                <span class="row-value">{{ updateRowValue }} <ChevronRight :size="16" /></span>
              </button>
              <button class="settings-row" type="button" @click="toggleAutoCheckUpdates">
                <span class="row-left"><RefreshCw :size="18" /> 自动检查</span>
                <span class="toggle" :class="{ on: state.settings.autoCheckUpdates }"></span>
              </button>
              <button
                v-if="availableUpdate?.source === 'github-release'"
                class="settings-row"
                type="button"
                @click="openExternalUrl(availableUpdate.releaseUrl)"
              >
                <span class="row-left"><ExternalLink :size="18" /> Release 页面</span>
                <ChevronRight :size="16" />
              </button>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">关于</div>
            <div class="settings-card">
              <button class="settings-row" type="button" @click="showToast(`Glosc Chat v${appVersion} · Tauri 2 + Vue 3`)">
                <span class="row-left"><Info :size="18" /> 版本</span>
                <span class="row-value">{{ appVersion }} <ChevronRight :size="16" /></span>
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
      <aside v-if="drawerOpen" class="history-drawer open" aria-label="会话历史">
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
        <button class="archive-toggle" type="button" @click="showArchived = !showArchived">
          {{ showArchived ? "查看进行中的会话" : "查看归档会话" }}
        </button>
        <div
          v-for="conversation in filteredConversations"
          :key="conversation.id"
          class="conversation-item"
          :class="{ active: conversation.id === state.selectedConversationId, pinned: conversation.pinned }"
        >
          <button class="conversation-main" type="button" @click="selectConversation(conversation.id)">
            <span class="conversation-icon"><MessageSquare :size="18" /></span>
            <span class="conversation-copy">
              <strong>{{ conversation.title }}</strong>
              <small>{{ conversationPreview(conversation) }}</small>
            </span>
            <span class="conversation-time">{{ formatConversationTime(conversation.updatedAt) }}</span>
          </button>
          <div class="conversation-actions">
            <button type="button" @click="toggleConversationPinned(conversation.id)">
              {{ conversation.pinned ? "取消置顶" : "置顶" }}
            </button>
            <button type="button" @click="exportConversationMarkdown(conversation.id)">导出</button>
            <button type="button" @click="toggleConversationArchived(conversation.id)">
              {{ conversation.archived ? "恢复" : "归档" }}
            </button>
            <button class="danger" type="button" @click="deleteConversation(conversation.id)">删除</button>
          </div>
        </div>
        <div v-if="filteredConversations.length === 0" class="drawer-empty">
          {{ showArchived ? "没有归档会话" : "没有进行中的会话" }}
        </div>
      </aside>

      <div
        v-if="modelSheetOpen || providerSheetOpen || detailSheetOpen || clearSheetOpen || promptSheetOpen || conversationSheetOpen"
        class="sheet-overlay"
        @click="modelSheetOpen = providerSheetOpen = detailSheetOpen = clearSheetOpen = promptSheetOpen = conversationSheetOpen = false"
      ></div>

      <section v-if="conversationSheetOpen" class="bottom-sheet conversation-sheet open" aria-label="会话设置">
        <div class="sheet-handle"></div>
        <h2>会话设置</h2>
        <label class="field">
          <span>标题</span>
          <input v-model="conversationForm.title" type="text" placeholder="会话标题" />
        </label>
        <label class="field">
          <span>系统提示词</span>
          <textarea v-model="conversationForm.systemPrompt" rows="7" placeholder="角色、语气、边界或固定输出格式"></textarea>
        </label>
        <div class="sheet-actions">
          <button class="secondary-btn" type="button" @click="conversationSheetOpen = false">取消</button>
          <button class="primary-btn" type="button" @click="saveConversationSettings">保存</button>
        </div>
      </section>

      <section v-if="modelSheetOpen" class="bottom-sheet model-sheet open" aria-label="选择模型">
        <div class="sheet-handle"></div>
        <div class="sheet-title-row">
          <h2>选择模型</h2>
          <button class="icon-btn accent" type="button" aria-label="刷新模型列表" :disabled="syncingAllProviders || !syncableProviders.length" @click="refreshAllProviderModels()">
            <RefreshCw :size="18" />
          </button>
        </div>
        <label v-if="selectableModels.length" class="model-search sheet-search">
          <Search :size="16" />
          <input v-model="modelSheetSearch" type="search" placeholder="搜索模型或 Provider" autocomplete="off" autocapitalize="off" spellcheck="false" />
        </label>
        <div v-if="selectableModels.length === 0" class="sheet-empty-state">
          <Cpu :size="34" />
          <strong>{{ state.models.length ? "没有启用的模型" : "没有可选模型" }}</strong>
          <span>{{ state.models.length ? "请在模型页启用模型，或添加新的 Provider。" : "保存 Provider API Key 后会自动从 API 拉取模型列表。" }}</span>
          <button v-if="syncableProviders.length" class="primary-action" type="button" :disabled="syncingAllProviders" @click="refreshAllProviderModels()">刷新模型</button>
          <button v-else class="primary-action" type="button" @click="openProviders">添加 Provider</button>
        </div>
        <div v-else-if="modelSheetModels.length === 0" class="sheet-empty-state">
          <Search :size="34" />
          <strong>没有匹配模型</strong>
          <span>换一个关键词，或清空搜索后重新选择。</span>
          <button class="secondary-btn" type="button" @click="modelSheetSearch = ''">清空搜索</button>
        </div>
        <button v-for="model in modelSheetModels" :key="model.id" class="model-option" :class="{ selected: model.id === currentModel?.id }" type="button" @click="selectModel(model)">
          <span class="provider-icon small" :class="providerClass(state.providers.find((item) => item.id === model.providerId) ?? state.providers[0])">
            {{ providerName(model.providerId).slice(0, 1) }}
          </span>
          <span>
            <strong>{{ model.displayName }}</strong>
            <small>{{ providerName(model.providerId) }} · {{ model.contextWindow }} 上下文</small>
          </span>
          <Check v-if="model.id === currentModel?.id" :size="18" />
        </button>
      </section>

      <section v-if="providerSheetOpen" class="bottom-sheet provider-sheet open" aria-label="Provider 表单" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>
        <h2>{{ providerForm.id ? "编辑 Provider" : "添加 Provider" }}</h2>
        <form class="sheet-form provider-form" @submit.prevent="saveProvider">
          <div class="sheet-scroll provider-sheet-body">
            <label class="field">
              <span>类型</span>
              <select :value="providerForm.type" @change="changeProviderType(($event.target as HTMLSelectElement).value as ProviderType)">
                <option value="chat-completions">Chat Completions</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label class="field">
              <span>名称</span>
              <input v-model="providerForm.name" type="text" placeholder="例如：我的模型服务" autocomplete="off" />
            </label>
            <label class="field">
              <span>Base URL</span>
              <input v-model="providerForm.baseUrl" type="url" placeholder="https://api.example.com/v1" autocomplete="off" autocapitalize="off" spellcheck="false" />
            </label>
            <label class="field">
              <span>API Key</span>
              <span class="secret-input">
                <input
                  v-model="providerForm.apiKey"
                  :type="providerForm.showKey ? 'text' : 'password'"
                  :placeholder="providerForm.keyHint || 'sk-...'"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
                <button type="button" aria-label="切换密钥可见性" @click="providerForm.showKey = !providerForm.showKey">
                  <EyeOff v-if="providerForm.showKey" :size="18" />
                  <Eye v-else :size="18" />
                </button>
              </span>
              <small>保存时写入系统安全存储；普通本地数据只保存引用和遮罩。</small>
            </label>
            <label class="field">
              <span>Chat Path</span>
              <input v-model="providerForm.chatPath" type="text" placeholder="/chat/completions" autocomplete="off" autocapitalize="off" spellcheck="false" />
            </label>
            <label class="field">
              <span>Models Path</span>
              <input v-model="providerForm.modelsPath" type="text" placeholder="/models" autocomplete="off" autocapitalize="off" spellcheck="false" />
            </label>
            <label class="field">
              <span>备用模型 ID</span>
              <input v-model="providerForm.modelId" type="text" placeholder="例如：deepseek/deepseek-v4-flash" autocomplete="off" autocapitalize="off" spellcheck="false" />
              <small>可选；保存后会优先从 Models API 同步真实模型列表，只有 API 未返回时才需要备用模型。</small>
            </label>
            <label class="field">
              <span>显示名称</span>
              <input v-model="providerForm.modelDisplayName" type="text" placeholder="可选，例如：GPT-4o mini" autocomplete="off" />
            </label>
            <label class="field">
              <span>上下文窗口</span>
              <input v-model="providerForm.contextWindow" type="text" placeholder="例如：128K" autocomplete="off" autocapitalize="off" spellcheck="false" />
            </label>
            <label class="field">
              <span>自定义 Headers</span>
              <input v-model="providerForm.customHeaders" type="text" placeholder='{"X-Custom-Header":"value"}' autocomplete="off" autocapitalize="off" spellcheck="false" />
            </label>
          </div>
          <div class="sheet-actions provider-sheet-actions">
            <button class="secondary-btn" type="button" @click="providerSheetOpen = false">取消</button>
            <button class="primary-btn" type="submit">保存</button>
          </div>
        </form>
      </section>

      <section v-if="detailSheetOpen" class="bottom-sheet detail-sheet open" aria-label="模型详情">
        <div class="sheet-handle"></div>
        <template v-if="detailModel">
          <h2>{{ detailModel.displayName }}</h2>
          <p class="sheet-subtitle">{{ providerName(detailModel.providerId) }} · {{ detailModel.contextWindow }} 上下文</p>
          <div class="cap-tags spacious">
            <span v-for="tag in capabilityTags(detailModel)" :key="tag" class="cap-tag">{{ tag }}</span>
          </div>
          <div class="model-capability-editor">
            <button type="button" :class="{ active: detailModel.supportsVision }" @click="detailModel.supportsVision = !detailModel.supportsVision">
              <ImageIcon :size="15" /> 视觉
            </button>
            <button type="button" :class="{ active: detailModel.supportsTools }" @click="detailModel.supportsTools = !detailModel.supportsTools">
              <Cpu :size="15" /> 工具
            </button>
          </div>
          <label class="field">
            <span>上下文窗口</span>
            <input v-model="detailModel.contextWindow" type="text" placeholder="例如：128K" />
          </label>
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

      <section v-if="promptSheetOpen" class="bottom-sheet prompt-sheet open" aria-label="提示词模板">
        <div class="sheet-handle"></div>
        <h2>{{ promptForm.id ? "编辑提示词模板" : "新建提示词模板" }}</h2>
        <label class="field">
          <span>名称</span>
          <input v-model="promptForm.name" type="text" placeholder="例如：周报总结" />
        </label>
        <label class="field">
          <span>内容</span>
          <textarea v-model="promptForm.content" rows="8" placeholder="输入你自己的提示词模板，可包含变量说明"></textarea>
        </label>
        <div class="sheet-actions">
          <button class="secondary-btn" type="button" @click="promptSheetOpen = false">取消</button>
          <button class="primary-btn" type="button" @click="savePromptTemplate">保存</button>
        </div>
      </section>

      <section v-if="clearSheetOpen" class="bottom-sheet alert-sheet open" aria-label="清除数据确认">
        <div class="sheet-handle"></div>
        <h2>清除所有会话数据？</h2>
        <p>这会清空本地 Provider 元数据、模型、会话、消息和已保存 Provider 密钥。</p>
        <button class="sheet-danger" type="button" @click="clearAllData">清除所有会话数据</button>
        <button class="sheet-cancel" type="button" @click="clearSheetOpen = false">取消</button>
      </section>

      <div v-if="contextMenu.open" class="context-menu" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }">
        <button type="button" @click="copyMessage()"><Copy :size="15" /> 复制</button>
        <button type="button" @click="editMessage()"><Pencil :size="15" /> 编辑</button>
        <button type="button" @click="retryMessage()"><RotateCcw :size="15" /> 重试</button>
        <button type="button" @click="quoteMessage"><Quote :size="15" /> 引用</button>
        <button class="danger" type="button" @click="deleteMessage"><Trash2 :size="15" /> 删除</button>
      </div>

      <input
        ref="importFileInput"
        hidden
        type="file"
        accept="application/json,.json"
        @change="handleImportFile"
      />
      <input
        ref="attachmentFileInput"
        hidden
        type="file"
        accept="text/*,image/*,.txt,.md,.markdown,.json,.csv,.tsv,.xml,.log,.png,.jpg,.jpeg,.webp,.gif"
        @change="handleAttachmentFile"
      />
      </template>

      <div class="toast" :class="{ show: toastVisible }">{{ toastText }}</div>
    </section>
  </main>
</template>
