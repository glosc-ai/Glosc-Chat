import type { ChatMessage, Conversation, ModelConfig, ProviderConfig, UserSettings } from "../domain/types";

const STORAGE_KEY = "glosc-chat.state.v1";

export interface PersistedState {
  schemaVersion: 1;
  providers: ProviderConfig[];
  models: ModelConfig[];
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  settings: UserSettings;
  selectedConversationId: string;
  exportedAt?: string;
}

export function loadPersistedState(): PersistedState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedState;
    return parsed?.schemaVersion === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState(state)));
}

export function clearPersistedState(): void {
  localStorage.removeItem(STORAGE_KEY);
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
