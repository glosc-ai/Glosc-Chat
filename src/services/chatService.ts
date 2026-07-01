import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import type { ChatMessage, MessageAttachment, ModelConfig, ModelParameters, ProviderConfig, ProviderType } from "../domain/types";
import { getSessionApiKey } from "./secretService";

const ANTHROPIC_VERSION = "2023-06-01";

export interface ChatStreamRequest {
  requestId: string;
  provider: ProviderConfig;
  model: ModelConfig;
  messages: ChatMessage[];
  parameters: ModelParameters;
}

export type ChatStreamEvent =
  | { type: "content"; text: string }
  | { type: "done" }
  | { type: "error"; code: string; message: string };

export async function streamChatCompletion(
  request: ChatStreamRequest,
  onEvent: (event: ChatStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  if (isTauri()) {
    await streamViaTauri(request, onEvent, signal);
    return;
  }

  await streamViaFetch(request, onEvent, signal);
}

export async function cancelChatStream(requestId: string): Promise<void> {
  if (isTauri()) {
    await invoke("cancel_stream", { requestId });
  }
}

async function streamViaTauri(
  request: ChatStreamRequest,
  onEvent: (event: ChatStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const channel = new Channel<ChatStreamEvent>((event) => onEvent(event));
  const abort = () => void cancelChatStream(request.requestId);
  signal.addEventListener("abort", abort, { once: true });

  try {
    await invoke("stream_provider_chat", {
      request: toCommandRequest(request),
      onEvent: channel,
    });
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

async function streamViaFetch(
  request: ChatStreamRequest,
  onEvent: (event: ChatStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const apiKey = getSessionApiKey(request.provider.id);
  if (!apiKey) {
    onEvent({
      type: "error",
      code: "auth.invalid_key",
      message: "浏览器预览模式没有持久安全存储，请在本标签页重新保存 Provider API Key，或使用 Tauri 运行。",
    });
    return;
  }

  const response = await fetch(buildBrowserChatUrl(request, apiKey), {
    method: "POST",
    headers: buildBrowserHeaders(request.provider.type, apiKey, request.provider.customHeaders),
    body: JSON.stringify(buildBrowserPayload(request)),
    signal,
  });

  if (!response.ok) {
    const error = mapProviderError(response.status, await response.text());
    onEvent({ type: "error", code: error.code, message: error.message });
    return;
  }

  if (!response.body) {
    onEvent({ type: "error", code: "stream.interrupted", message: "Provider 没有返回流式响应 body" });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let index = buffer.indexOf("\n");
    while (index >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);

      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          onEvent({ type: "done" });
          return;
        }
        if (data) {
          let delta: ReturnType<typeof extractDelta>;
          try {
            delta = extractDelta(request.provider.type, data);
          } catch (error) {
            onEvent({
              type: "error",
              code: "stream.interrupted",
              message: error instanceof Error ? error.message : "流式响应 JSON 无效",
            });
            return;
          }
          if (delta.error) {
            onEvent({ type: "error", code: delta.error.code, message: delta.error.message });
            return;
          }
          if (delta.text) onEvent({ type: "content", text: delta.text });
          if (delta.done) {
            onEvent({ type: "done" });
            return;
          }
        }
      }

      index = buffer.indexOf("\n");
    }
  }

  onEvent({ type: "done" });
}

function toCommandRequest(request: ChatStreamRequest) {
  return {
    requestId: request.requestId,
    provider: {
      id: request.provider.id,
      type: request.provider.type,
      baseUrl: request.provider.baseUrl,
      chatPath: request.provider.chatPath,
      modelsPath: request.provider.modelsPath,
      customHeaders: request.provider.customHeaders,
    },
    model: {
      name: request.model.name,
    },
    messages: request.messages
      .filter((message) => message.role === "system" || message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: message.content,
        attachments: imageAttachments(message).map((attachment) => ({
          kind: attachment.kind,
          mimeType: attachment.mimeType,
          dataUrl: attachment.dataUrl,
        })),
      })),
    parameters: {
      temperature: request.parameters.temperature,
      topP: request.parameters.topP,
      maxTokens: request.parameters.maxTokens,
      presencePenalty: request.parameters.presencePenalty,
      frequencyPenalty: request.parameters.frequencyPenalty,
    },
  };
}

function buildBrowserChatUrl(request: ChatStreamRequest, apiKey: string): string {
  if (request.provider.type === "gemini") {
    const path = (request.provider.chatPath || "/models/{model}:streamGenerateContent?alt=sse").replace("{model}", request.model.name);
    return appendQuery(joinUrl(request.provider.baseUrl, path), "key", apiKey);
  }

  return joinUrl(
    request.provider.baseUrl,
    request.provider.chatPath || (request.provider.type === "anthropic" ? "/v1/messages" : "/chat/completions"),
  );
}

function buildBrowserPayload(request: ChatStreamRequest): unknown {
  switch (request.provider.type) {
    case "anthropic":
      return anthropicPayload(request);
    case "gemini":
      return geminiPayload(request);
    case "chat-completions":
    case "custom":
      return chatCompletionsPayload(request);
  }
}

function chatCompletionsPayload(request: ChatStreamRequest): unknown {
  return {
    model: request.model.name,
    stream: true,
    messages: request.messages.map((message) => ({
      role: message.role,
      content: chatCompletionsMessageContent(message),
    })),
    temperature: request.parameters.temperature,
    top_p: request.parameters.topP,
    max_tokens: request.parameters.maxTokens,
    presence_penalty: request.parameters.presencePenalty,
    frequency_penalty: request.parameters.frequencyPenalty,
  };
}

function anthropicPayload(request: ChatStreamRequest): unknown {
  const system = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const payload: Record<string, unknown> = {
    model: request.model.name,
    stream: true,
    max_tokens: request.parameters.maxTokens,
    temperature: request.parameters.temperature,
    top_p: request.parameters.topP,
    messages: request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: anthropicMessageContent(message),
      })),
  };

  if (system) payload.system = system;
  return payload;
}

function geminiPayload(request: ChatStreamRequest): unknown {
  const system = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const payload: Record<string, unknown> = {
    contents: request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: geminiMessageParts(message),
      })),
    generationConfig: {
      temperature: request.parameters.temperature,
      topP: request.parameters.topP,
      maxOutputTokens: request.parameters.maxTokens,
    },
  };

  if (system) {
    payload.systemInstruction = {
      parts: [{ text: system }],
    };
  }

  return payload;
}

function chatCompletionsMessageContent(message: ChatMessage): string | Array<Record<string, unknown>> {
  const images = imageAttachments(message);
  if (!images.length || message.role !== "user") return message.content;

  const parts: Array<Record<string, unknown>> = [];
  if (message.content.trim()) {
    parts.push({ type: "text", text: message.content });
  }

  for (const attachment of images) {
    parts.push({
      type: "image_url",
      image_url: {
        url: attachment.dataUrl,
      },
    });
  }

  return parts;
}

function anthropicMessageContent(message: ChatMessage): string | Array<Record<string, unknown>> {
  const images = imageAttachments(message);
  if (!images.length || message.role !== "user") return message.content;

  const parts: Array<Record<string, unknown>> = [];
  if (message.content.trim()) {
    parts.push({ type: "text", text: message.content });
  }

  for (const attachment of images) {
    parts.push({
      type: "image",
      source: {
        type: "base64",
        media_type: attachment.mimeType,
        data: stripDataUrlPrefix(attachment.dataUrl),
      },
    });
  }

  return parts;
}

function geminiMessageParts(message: ChatMessage): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [];
  if (message.content.trim()) {
    parts.push({ text: message.content });
  }

  for (const attachment of imageAttachments(message)) {
    if (message.role !== "user") continue;
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: stripDataUrlPrefix(attachment.dataUrl),
      },
    });
  }

  return parts.length ? parts : [{ text: message.content }];
}

function imageAttachments(message: ChatMessage): Array<MessageAttachment & { dataUrl: string }> {
  return (message.attachments ?? []).filter(
    (attachment): attachment is MessageAttachment & { dataUrl: string } => attachment.kind === "image" && Boolean(attachment.dataUrl),
  );
}

function stripDataUrlPrefix(value: string): string {
  const index = value.indexOf(",");
  return index >= 0 ? value.slice(index + 1) : value;
}

function buildBrowserHeaders(providerType: ProviderType, apiKey: string, customHeaders?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (providerType === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = ANTHROPIC_VERSION;
  } else if (providerType !== "gemini") {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (customHeaders?.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(customHeaders);
    } catch {
      throw new Error("自定义 Headers 必须是有效 JSON");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("自定义 Headers 必须是 JSON 对象");
    }

    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (["authorization", "x-api-key"].includes(key.toLowerCase())) continue;
      if (typeof value !== "string") throw new Error(`Header 值必须是字符串：${key}`);
      headers[key] = value;
    }
  }

  return headers;
}

function extractDelta(providerType: ProviderType, data: string): { text?: string; done: boolean; error?: { code: string; message: string } } {
  const parsed = JSON.parse(data) as {
    choices?: Array<{ delta?: { content?: string } }>;
    delta?: { text?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    type?: string;
    error?: { code?: string; message?: string; type?: string };
  };

  if (parsed.error?.message) return { done: true, error: mapProviderError(400, data) };

  if (providerType === "anthropic") {
    return {
      text: parsed.delta?.text,
      done: parsed.type === "message_stop" || parsed.type === "content_block_stop",
    };
  }

  if (providerType === "gemini") {
    return {
      text: parsed.candidates?.[0]?.content?.parts?.[0]?.text,
      done: false,
    };
  }

  return {
    text: parsed.choices?.[0]?.delta?.content,
    done: false,
  };
}

function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function appendQuery(url: string, key: string, value: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

function mapProviderError(status: number, body: string): { code: string; message: string } {
  const parsed = parseProviderError(body);
  const raw = `${parsed?.code ?? ""} ${parsed?.type ?? ""} ${parsed?.message ?? ""} ${body}`.toLowerCase();
  return {
    code: normalizeProviderErrorCode(status, raw),
    message: parsed?.message?.trim() || body.trim() || mapStatus(status),
  };
}

function parseProviderError(body: string): { code?: string; message?: string; type?: string } | null {
  try {
    const value = JSON.parse(body) as { error?: { code?: string; message?: string; type?: string }; message?: string; code?: string };
    if (value.error) return value.error;
    return { code: value.code, message: value.message };
  } catch {
    return null;
  }
}

function normalizeProviderErrorCode(status: number, value: string): string {
  if (/model[\s_.-]*not[\s_.-]*found|no available (channel|distributor)|无可用渠道|模型.*(不存在|不支持)/i.test(value)) {
    return "model.not_found";
  }
  if (/invalid[_\s.-]*key|unauthorized|unauthenticated|api key.*invalid|密钥.*无效/i.test(value)) return "auth.invalid_key";
  if (/forbidden|permission|no access|没有访问|无权限/i.test(value)) return "auth.forbidden";
  if (/rate[_\s.-]*limit|too many requests|限流/i.test(value)) return "rate_limited";
  return mapStatus(status);
}

function mapStatus(status: number): string {
  if (status === 401) return "auth.invalid_key";
  if (status === 403) return "auth.forbidden";
  if (status === 404) return "model.not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider.server_error";
  return `provider.http_${status}`;
}
