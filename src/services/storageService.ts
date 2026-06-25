import type { ChatMessage, Conversation, ModelConfig, PromptTemplate, ProviderConfig, UserSettings } from "../domain/types";
import { defaultSettings } from "../data/defaults";

const DB_NAME = "glosc-chat";
const DB_VERSION = 1;
const STORE_NAME = "app_state";
const STATE_KEY = "state.v2";

export interface PersistedState {
  schemaVersion: 2;
  providers: ProviderConfig[];
  models: ModelConfig[];
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  promptTemplates: PromptTemplate[];
  settings: UserSettings;
  selectedConversationId: string | null;
  exportedAt?: string;
}

export async function loadPersistedState(): Promise<PersistedState | null> {
  const db = await openDatabase();
  const value = await requestToPromise<unknown>(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STATE_KEY));
  if (!isPersistedState(value)) return null;
  return {
    ...value,
    promptTemplates: value.promptTemplates ?? [],
    settings: {
      ...defaultSettings,
      ...value.settings,
    },
  };
}

export async function savePersistedState(state: PersistedState): Promise<void> {
  const db = await openDatabase();
  await requestToPromise(
    db.transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(sanitizeState(state), STATE_KEY),
  );
}

export async function clearPersistedState(): Promise<void> {
  const db = await openDatabase();
  await requestToPromise(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(STATE_KEY));
}

export function exportPersistedState(state: PersistedState): string {
  return JSON.stringify(
    {
      ...sanitizeState(state),
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开 IndexedDB"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 操作失败"));
  });
}

function isPersistedState(value: unknown): value is PersistedState {
  return Boolean(
    value &&
      typeof value === "object" &&
      "schemaVersion" in value &&
      (value as { schemaVersion?: unknown }).schemaVersion === 2,
  );
}

function sanitizeState(state: PersistedState): PersistedState {
  return {
    ...state,
    providers: state.providers.map((provider) => ({
      ...provider,
      apiKeyRef: provider.apiKeyRef || `secret://providers/${provider.id}`,
      keyHint: provider.hasApiKey ? provider.keyHint : "",
    })),
  };
}
