import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ProviderConfig, ProviderType } from "../domain/types";
import { getSessionApiKey } from "./secretService";

const ANTHROPIC_VERSION = "2023-06-01";

export interface ProviderModelSummary {
  id: string;
  displayName: string;
}

export async function listProviderModels(provider: ProviderConfig): Promise<ProviderModelSummary[]> {
  if (isTauri()) {
    return invoke<ProviderModelSummary[]>("list_openai_models", { provider: toCommandProvider(provider) });
  }

  const apiKey = getSessionApiKey(provider.id);
  if (!apiKey) throw new Error("浏览器预览模式没有持久安全存储，请在本标签页重新保存 Provider API Key。");

  const response = await fetch(buildModelsUrl(provider, apiKey), {
    headers: buildHeaders(provider.type, apiKey, provider.customHeaders),
  });

  if (!response.ok) throw new Error(providerErrorMessage(response.status, await response.text()));
  return extractModels(provider.type, await response.json());
}

function toCommandProvider(provider: ProviderConfig) {
  return {
    id: provider.id,
    type: provider.type,
    baseUrl: provider.baseUrl,
    chatPath: provider.chatPath,
    modelsPath: provider.modelsPath,
    customHeaders: provider.customHeaders,
  };
}

function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function buildModelsUrl(provider: ProviderConfig, apiKey: string): string {
  const defaultPath = provider.type === "anthropic" ? "/v1/models" : "/models";
  const url = joinUrl(provider.baseUrl, provider.modelsPath || defaultPath);
  return provider.type === "gemini" ? appendQuery(url, "key", apiKey) : url;
}

function buildHeaders(providerType: ProviderType, apiKey: string, customHeaders?: string): HeadersInit {
  const headers: Record<string, string> = {};
  if (providerType === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = ANTHROPIC_VERSION;
  } else if (providerType !== "gemini") {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return {
    ...headers,
    ...parseCustomHeaders(customHeaders),
  };
}

function extractModels(providerType: ProviderType, body: unknown): ProviderModelSummary[] {
  if (!body || typeof body !== "object") return [];
  const value = body as {
    data?: Array<{ id?: string }>;
    models?: Array<{ name?: string }>;
  };

  if (providerType === "gemini") {
    return (value.models ?? []).flatMap((item) => {
      const id = item.name?.replace(/^models\//, "");
      if (!id) return [];
      return [{ id, displayName: id }];
    });
  }

  return (value.data ?? []).flatMap((item) => {
    if (!item.id) return [];
    return [{ id: item.id, displayName: item.id }];
  });
}

function parseCustomHeaders(value?: string): Record<string, string> {
  if (!value?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("自定义 Headers 必须是有效 JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("自定义 Headers 必须是 JSON 对象");
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).flatMap(([key, headerValue]) => {
      if (["authorization", "x-api-key"].includes(key.toLowerCase())) return [];
      if (typeof headerValue !== "string") throw new Error(`Header 值必须是字符串：${key}`);
      return [[key, headerValue]];
    }),
  );
}

function appendQuery(url: string, key: string, value: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

function providerErrorMessage(status: number, body: string): string {
  try {
    const value = JSON.parse(body) as { error?: { message?: string }; message?: string };
    return value.error?.message?.trim() || value.message?.trim() || `provider.http_${status}`;
  } catch {
    return body.trim() || `provider.http_${status}`;
  }
}
