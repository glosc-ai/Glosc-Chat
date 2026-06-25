import { invoke, isTauri } from "@tauri-apps/api/core";

const SESSION_KEY_PREFIX = "glosc-chat.session-key.";

export async function saveApiKey(providerId: string, apiKey: string): Promise<string> {
  if (isTauri()) {
    return invoke<string>("save_api_key", { providerId, apiKey });
  }

  sessionStorage.setItem(`${SESSION_KEY_PREFIX}${providerId}`, apiKey);
  return maskKey(apiKey);
}

export async function apiKeyExists(providerId: string): Promise<boolean> {
  if (isTauri()) {
    return invoke<boolean>("api_key_exists", { providerId });
  }

  return Boolean(getSessionApiKey(providerId));
}

export async function deleteApiKey(providerId: string): Promise<void> {
  if (isTauri()) {
    await invoke("delete_api_key", { providerId });
    return;
  }

  sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${providerId}`);
}

export function getSessionApiKey(providerId: string): string | null {
  return sessionStorage.getItem(`${SESSION_KEY_PREFIX}${providerId}`);
}

function maskKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "****";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
