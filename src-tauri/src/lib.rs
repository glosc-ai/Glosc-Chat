use futures_util::StreamExt;
use keyring::Entry;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    str::FromStr,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{ipc::Channel, State};

const SECRET_SERVICE: &str = "com.gloscai.glosc-chat";
const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(Default)]
struct StreamCancels(Mutex<HashMap<String, Arc<AtomicBool>>>);

#[derive(Default)]
struct SecretCache(Mutex<HashMap<String, String>>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderRequest {
    id: String,
    #[serde(rename = "type")]
    provider_type: String,
    base_url: String,
    chat_path: Option<String>,
    models_path: Option<String>,
    custom_headers: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelRequest {
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelParametersRequest {
    temperature: f64,
    top_p: f64,
    max_tokens: u32,
    presence_penalty: f64,
    frequency_penalty: f64,
}

#[derive(Debug, Deserialize)]
struct MessageRequest {
    role: String,
    content: String,
    #[serde(default)]
    attachments: Vec<AttachmentRequest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AttachmentRequest {
    kind: String,
    mime_type: String,
    data_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatRequest {
    request_id: String,
    provider: ProviderRequest,
    model: ModelRequest,
    messages: Vec<MessageRequest>,
    parameters: ModelParametersRequest,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelSummary {
    id: String,
    display_name: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum ChatStreamEvent {
    Content { text: String },
    Done,
    Error { code: String, message: String },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ProviderKind {
    OpenAiCompatible,
    Anthropic,
    Gemini,
    Custom,
}

#[tauri::command]
fn save_api_key(
    provider_id: String,
    api_key: String,
    secrets: State<'_, SecretCache>,
) -> Result<String, String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("API Key 不能为空".to_string());
    }

    secret_entry(&provider_id)?
        .set_password(trimmed)
        .map_err(|_| "无法写入系统安全存储".to_string())?;
    cache_api_key(&secrets, &provider_id, trimmed)?;

    Ok(mask_key(trimmed))
}

#[tauri::command]
fn api_key_exists(provider_id: String, secrets: State<'_, SecretCache>) -> Result<bool, String> {
    match secret_entry(&provider_id)?.get_password() {
        Ok(value) if !value.trim().is_empty() => Ok(true),
        _ => Ok(cached_api_key(&secrets, &provider_id)?.is_some()),
    }
}

#[tauri::command]
fn delete_api_key(provider_id: String, secrets: State<'_, SecretCache>) -> Result<(), String> {
    if let Ok(mut cache) = secrets.0.lock() {
        cache.remove(&provider_id);
    }

    let entry = secret_entry(&provider_id)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(_) => Ok(()),
    }
}

#[tauri::command]
async fn list_openai_models(
    provider: ProviderRequest,
    secrets: State<'_, SecretCache>,
) -> Result<Vec<ModelSummary>, String> {
    list_provider_models(provider, &secrets).await
}

#[tauri::command]
async fn stream_openai_chat(
    request: ChatRequest,
    on_event: Channel<ChatStreamEvent>,
    cancels: State<'_, StreamCancels>,
    secrets: State<'_, SecretCache>,
) -> Result<(), String> {
    let cancel_flag = Arc::new(AtomicBool::new(false));
    cancels
        .0
        .lock()
        .map_err(|_| "取消状态不可用".to_string())?
        .insert(request.request_id.clone(), cancel_flag.clone());

    let result = stream_provider_chat_inner(&request, &on_event, cancel_flag, &secrets).await;

    if let Ok(mut map) = cancels.0.lock() {
        map.remove(&request.request_id);
    }

    if let Err(message) = result {
        let _ = on_event.send(ChatStreamEvent::Error {
            code: "unknown".to_string(),
            message,
        });
    }

    Ok(())
}

#[tauri::command]
fn cancel_stream(request_id: String, cancels: State<'_, StreamCancels>) -> Result<(), String> {
    if let Ok(map) = cancels.0.lock() {
        if let Some(flag) = map.get(&request_id) {
            flag.store(true, Ordering::Relaxed);
        }
    }

    Ok(())
}

async fn list_provider_models(
    provider: ProviderRequest,
    secrets: &State<'_, SecretCache>,
) -> Result<Vec<ModelSummary>, String> {
    let kind = provider_kind(&provider)?;
    let api_key = read_api_key(&provider.id, secrets)?;
    let default_path = match kind {
        ProviderKind::OpenAiCompatible | ProviderKind::Custom => "/models",
        ProviderKind::Anthropic => "/v1/models",
        ProviderKind::Gemini => "/models",
    };
    let mut url = join_url(
        &provider.base_url,
        provider.models_path.as_deref().unwrap_or(default_path),
    )?;
    if kind == ProviderKind::Gemini {
        url = append_query(&url, "key", &api_key);
    }

    let response = reqwest::Client::new()
        .get(url)
        .headers(build_headers(kind, &api_key, provider.custom_headers.as_deref())?)
        .send()
        .await
        .map_err(map_network_error)?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        let (_, message) = map_provider_error(status, &body);
        return Err(message);
    }

    let body = response
        .json::<Value>()
        .await
        .map_err(|_| "模型列表响应格式无效".to_string())?;
    Ok(extract_models(kind, &body))
}

async fn stream_provider_chat_inner(
    request: &ChatRequest,
    on_event: &Channel<ChatStreamEvent>,
    cancel_flag: Arc<AtomicBool>,
    secrets: &State<'_, SecretCache>,
) -> Result<(), String> {
    let kind = provider_kind(&request.provider)?;
    let api_key = read_api_key(&request.provider.id, secrets)?;
    let (url, payload) = build_chat_request(kind, request, &api_key)?;

    let response = reqwest::Client::new()
        .post(url)
        .headers(build_headers(
            kind,
            &api_key,
            request.provider.custom_headers.as_deref(),
        )?)
        .json(&payload)
        .send()
        .await
        .map_err(map_network_error)?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        let (code, message) = map_provider_error(status, &body);
        let _ = on_event.send(ChatStreamEvent::Error { code, message });
        return Ok(());
    }

    stream_sse_response(kind, response, on_event, cancel_flag).await
}

async fn stream_sse_response(
    kind: ProviderKind,
    response: reqwest::Response,
    on_event: &Channel<ChatStreamEvent>,
    cancel_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        if cancel_flag.load(Ordering::Relaxed) {
            let _ = on_event.send(ChatStreamEvent::Done);
            return Ok(());
        }

        let chunk = chunk.map_err(map_network_error)?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(index) = buffer.find('\n') {
            let line = buffer[..index].trim().to_string();
            buffer = buffer[index + 1..].to_string();

            if let Some(data) = line.strip_prefix("data:") {
                let data = data.trim();
                if data == "[DONE]" {
                    let _ = on_event.send(ChatStreamEvent::Done);
                    return Ok(());
                }

                if data.is_empty() {
                    continue;
                }

                let parsed = match extract_delta_text(kind, data) {
                    Ok(parsed) => parsed,
                    Err(message) => {
                        let (code, provider_message) = if data.contains("\"error\"") {
                            map_provider_error(400, data)
                        } else {
                            ("stream.interrupted".to_string(), message)
                        };
                        let _ = on_event.send(ChatStreamEvent::Error {
                            code,
                            message: provider_message,
                        });
                        return Ok(());
                    }
                };
                if parsed.done {
                    let _ = on_event.send(ChatStreamEvent::Done);
                    return Ok(());
                }
                if let Some(text) = parsed.text {
                    let _ = on_event.send(ChatStreamEvent::Content { text });
                }
            }
        }
    }

    let _ = on_event.send(ChatStreamEvent::Done);
    Ok(())
}

struct ParsedDelta {
    text: Option<String>,
    done: bool,
}

fn build_chat_request(
    kind: ProviderKind,
    request: &ChatRequest,
    api_key: &str,
) -> Result<(String, Value), String> {
    match kind {
        ProviderKind::OpenAiCompatible | ProviderKind::Custom => {
            let url = join_url(
                &request.provider.base_url,
                request
                    .provider
                    .chat_path
                    .as_deref()
                    .unwrap_or("/chat/completions"),
            )?;
            Ok((url, openai_payload(request)))
        }
        ProviderKind::Anthropic => {
            let url = join_url(
                &request.provider.base_url,
                request.provider.chat_path.as_deref().unwrap_or("/v1/messages"),
            )?;
            Ok((url, anthropic_payload(request)))
        }
        ProviderKind::Gemini => {
            let path = request
                .provider
                .chat_path
                .as_deref()
                .unwrap_or("/models/{model}:streamGenerateContent?alt=sse")
                .replace("{model}", &request.model.name);
            let url = append_query(&join_url(&request.provider.base_url, &path)?, "key", api_key);
            Ok((url, gemini_payload(request)))
        }
    }
}

fn openai_payload(request: &ChatRequest) -> Value {
    json!({
        "model": request.model.name,
        "stream": true,
        "messages": request.messages.iter().map(|message| {
            json!({
                "role": message.role,
                "content": openai_message_content(message),
            })
        }).collect::<Vec<_>>(),
        "temperature": request.parameters.temperature,
        "top_p": request.parameters.top_p,
        "max_tokens": request.parameters.max_tokens,
        "presence_penalty": request.parameters.presence_penalty,
        "frequency_penalty": request.parameters.frequency_penalty,
    })
}

fn openai_message_content(message: &MessageRequest) -> Value {
    let images = image_attachments(message);
    if images.is_empty() || message.role != "user" {
        return Value::String(message.content.clone());
    }

    let mut parts = Vec::new();
    if !message.content.trim().is_empty() {
        parts.push(json!({
            "type": "text",
            "text": message.content.as_str(),
        }));
    }

    for attachment in images {
        parts.push(json!({
            "type": "image_url",
            "image_url": {
                "url": attachment.data_url.as_str(),
            },
        }));
    }

    Value::Array(parts)
}

fn anthropic_payload(request: &ChatRequest) -> Value {
    let system = request
        .messages
        .iter()
        .filter(|message| message.role == "system")
        .map(|message| message.content.as_str())
        .collect::<Vec<_>>()
        .join("\n\n");
    let messages = request
        .messages
        .iter()
        .filter(|message| message.role != "system")
        .map(|message| {
            json!({
                "role": if message.role == "assistant" { "assistant" } else { "user" },
                "content": anthropic_message_content(message),
            })
        })
        .collect::<Vec<_>>();

    let mut payload = json!({
        "model": request.model.name,
        "stream": true,
        "max_tokens": request.parameters.max_tokens,
        "temperature": request.parameters.temperature,
        "top_p": request.parameters.top_p,
        "messages": messages,
    });

    if !system.is_empty() {
        payload["system"] = Value::String(system);
    }

    payload
}

fn anthropic_message_content(message: &MessageRequest) -> Value {
    let images = image_attachments(message);
    if images.is_empty() || message.role != "user" {
        return Value::String(message.content.clone());
    }

    let mut parts = Vec::new();
    if !message.content.trim().is_empty() {
        parts.push(json!({
            "type": "text",
            "text": message.content.as_str(),
        }));
    }

    for attachment in images {
        parts.push(json!({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": attachment.mime_type.as_str(),
                "data": strip_data_url_prefix(&attachment.data_url),
            },
        }));
    }

    Value::Array(parts)
}

fn gemini_payload(request: &ChatRequest) -> Value {
    let system = request
        .messages
        .iter()
        .filter(|message| message.role == "system")
        .map(|message| message.content.as_str())
        .collect::<Vec<_>>()
        .join("\n\n");
    let contents = request
        .messages
        .iter()
        .filter(|message| message.role != "system")
        .map(|message| {
            json!({
                "role": if message.role == "assistant" { "model" } else { "user" },
                "parts": gemini_message_parts(message),
            })
        })
        .collect::<Vec<_>>();

    let mut payload = json!({
        "contents": contents,
        "generationConfig": {
            "temperature": request.parameters.temperature,
            "topP": request.parameters.top_p,
            "maxOutputTokens": request.parameters.max_tokens,
        },
    });

    if !system.is_empty() {
        payload["systemInstruction"] = json!({
            "parts": [{ "text": system }]
        });
    }

    payload
}

fn gemini_message_parts(message: &MessageRequest) -> Value {
    let mut parts = Vec::new();
    if !message.content.trim().is_empty() {
        parts.push(json!({ "text": message.content.as_str() }));
    }

    if message.role == "user" {
        for attachment in image_attachments(message) {
            parts.push(json!({
                "inlineData": {
                    "mimeType": attachment.mime_type.as_str(),
                    "data": strip_data_url_prefix(&attachment.data_url),
                },
            }));
        }
    }

    if parts.is_empty() {
        parts.push(json!({ "text": message.content.as_str() }));
    }

    Value::Array(parts)
}

fn image_attachments(message: &MessageRequest) -> Vec<&AttachmentRequest> {
    message
        .attachments
        .iter()
        .filter(|attachment| attachment.kind == "image" && !attachment.data_url.trim().is_empty())
        .collect()
}

fn strip_data_url_prefix(value: &str) -> String {
    value
        .split_once(',')
        .map(|(_, data)| data.to_string())
        .unwrap_or_else(|| value.to_string())
}

fn extract_delta_text(kind: ProviderKind, data: &str) -> Result<ParsedDelta, String> {
    let value = serde_json::from_str::<Value>(data).map_err(|_| "流式响应 JSON 无效".to_string())?;

    if let Some(message) = value
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
    {
        return Err(message.to_string());
    }

    let text = match kind {
        ProviderKind::OpenAiCompatible | ProviderKind::Custom => value
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("delta"))
            .and_then(|delta| delta.get("content"))
            .and_then(Value::as_str)
            .map(ToString::to_string),
        ProviderKind::Anthropic => value
            .get("delta")
            .and_then(|delta| delta.get("text"))
            .and_then(Value::as_str)
            .map(ToString::to_string),
        ProviderKind::Gemini => value
            .get("candidates")
            .and_then(Value::as_array)
            .and_then(|candidates| candidates.first())
            .and_then(|candidate| candidate.get("content"))
            .and_then(|content| content.get("parts"))
            .and_then(Value::as_array)
            .and_then(|parts| parts.first())
            .and_then(|part| part.get("text"))
            .and_then(Value::as_str)
            .map(ToString::to_string),
    };

    let done = matches!(
        value.get("type").and_then(Value::as_str),
        Some("message_stop" | "content_block_stop")
    );

    Ok(ParsedDelta { text, done })
}

fn extract_models(kind: ProviderKind, body: &Value) -> Vec<ModelSummary> {
    match kind {
        ProviderKind::OpenAiCompatible | ProviderKind::Custom | ProviderKind::Anthropic => body
            .get("data")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.get("id").and_then(Value::as_str))
                    .map(|id| ModelSummary {
                        id: id.to_string(),
                        display_name: id.to_string(),
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default(),
        ProviderKind::Gemini => body
            .get("models")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.get("name").and_then(Value::as_str))
                    .map(|name| name.strip_prefix("models/").unwrap_or(name))
                    .map(|id| ModelSummary {
                        id: id.to_string(),
                        display_name: id.to_string(),
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default(),
    }
}

fn provider_kind(provider: &ProviderRequest) -> Result<ProviderKind, String> {
    match provider.provider_type.as_str() {
        "openai-compatible" => Ok(ProviderKind::OpenAiCompatible),
        "anthropic" => Ok(ProviderKind::Anthropic),
        "gemini" => Ok(ProviderKind::Gemini),
        "custom" => Ok(ProviderKind::Custom),
        _ => Err("未知 Provider 类型".to_string()),
    }
}

fn build_headers(
    kind: ProviderKind,
    api_key: &str,
    custom_headers: Option<&str>,
) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    match kind {
        ProviderKind::OpenAiCompatible | ProviderKind::Custom => {
            let auth_value = format!("Bearer {api_key}");
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&auth_value).map_err(|_| "API Key 包含非法字符".to_string())?,
            );
        }
        ProviderKind::Anthropic => {
            headers.insert(
                HeaderName::from_static("x-api-key"),
                HeaderValue::from_str(api_key).map_err(|_| "API Key 包含非法字符".to_string())?,
            );
            headers.insert(
                HeaderName::from_static("anthropic-version"),
                HeaderValue::from_static(ANTHROPIC_VERSION),
            );
        }
        ProviderKind::Gemini => {}
    }

    if let Some(raw_headers) = custom_headers.filter(|value| !value.trim().is_empty()) {
        let value = serde_json::from_str::<Value>(raw_headers)
            .map_err(|_| "自定义 Headers 必须是 JSON 对象".to_string())?;
        let object = value
            .as_object()
            .ok_or_else(|| "自定义 Headers 必须是 JSON 对象".to_string())?;

        for (key, value) in object {
            if key.eq_ignore_ascii_case("authorization") || key.eq_ignore_ascii_case("x-api-key") {
                continue;
            }
            let header_name = HeaderName::from_str(key).map_err(|_| format!("Header 名称无效：{key}"))?;
            let header_value = value
                .as_str()
                .ok_or_else(|| format!("Header 值必须是字符串：{key}"))?;
            headers.insert(
                header_name,
                HeaderValue::from_str(header_value).map_err(|_| format!("Header 值无效：{key}"))?,
            );
        }
    }

    Ok(headers)
}

fn join_url(base_url: &str, path: &str) -> Result<String, String> {
    let base = base_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Base URL 不能为空".to_string());
    }

    let path = path.trim();
    if path.starts_with("http://") || path.starts_with("https://") {
        Ok(path.to_string())
    } else {
        Ok(format!("{base}/{}", path.trim_start_matches('/')))
    }
}

fn append_query(url: &str, key: &str, value: &str) -> String {
    let separator = if url.contains('?') { '&' } else { '?' };
    format!("{url}{separator}{key}={value}")
}

fn secret_entry(provider_id: &str) -> Result<Entry, String> {
    Entry::new(SECRET_SERVICE, provider_id).map_err(|_| "系统安全存储不可用".to_string())
}

fn cache_api_key(
    secrets: &State<'_, SecretCache>,
    provider_id: &str,
    api_key: &str,
) -> Result<(), String> {
    secrets
        .0
        .lock()
        .map_err(|_| "密钥会话缓存不可用".to_string())?
        .insert(provider_id.to_string(), api_key.to_string());
    Ok(())
}

fn cached_api_key(
    secrets: &State<'_, SecretCache>,
    provider_id: &str,
) -> Result<Option<String>, String> {
    Ok(secrets
        .0
        .lock()
        .map_err(|_| "密钥会话缓存不可用".to_string())?
        .get(provider_id)
        .filter(|value| !value.trim().is_empty())
        .cloned())
}

fn read_api_key(provider_id: &str, secrets: &State<'_, SecretCache>) -> Result<String, String> {
    match secret_entry(provider_id)?.get_password() {
        Ok(value) if !value.trim().is_empty() => Ok(value),
        _ => cached_api_key(secrets, provider_id)?
            .ok_or_else(|| "未找到 Provider API Key，请重新保存 Provider".to_string()),
    }
}

fn mask_key(key: &str) -> String {
    let chars = key.chars().collect::<Vec<_>>();
    if chars.len() <= 8 {
        return "****".to_string();
    }
    let prefix = chars.iter().take(4).collect::<String>();
    let suffix = chars.iter().rev().take(4).collect::<Vec<_>>();
    format!("{prefix}...{}", suffix.into_iter().rev().collect::<String>())
}

fn map_network_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "network.timeout".to_string()
    } else if error.is_connect() {
        "network.unreachable".to_string()
    } else {
        "network.unreachable".to_string()
    }
}

fn map_provider_error(status: u16, body: &str) -> (String, String) {
    (
        normalize_provider_error_code(status, body),
        provider_error_message(body).unwrap_or_else(|| map_status_error(status)),
    )
}

fn provider_error_message(body: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(body).ok()?;
    value
        .get("error")
        .and_then(|error| error.get("message"))
        .or_else(|| value.get("message"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|message| !message.is_empty())
        .map(ToString::to_string)
}

fn normalize_provider_error_code(status: u16, body: &str) -> String {
    let value = body.to_lowercase();
    if value.contains("model_not_found")
        || value.contains("model-not-found")
        || value.contains("model.not_found")
        || value.contains("no available distributor")
        || value.contains("no available channel")
        || value.contains("无可用渠道")
        || (value.contains("模型") && (value.contains("不存在") || value.contains("不支持")))
    {
        return "model.not_found".to_string();
    }
    if value.contains("invalid_key")
        || value.contains("invalid key")
        || value.contains("unauthorized")
        || value.contains("unauthenticated")
        || value.contains("api key") && value.contains("invalid")
        || value.contains("密钥") && value.contains("无效")
    {
        return "auth.invalid_key".to_string();
    }
    if value.contains("forbidden")
        || value.contains("permission")
        || value.contains("no access")
        || value.contains("没有访问")
        || value.contains("无权限")
    {
        return "auth.forbidden".to_string();
    }
    if value.contains("rate_limit")
        || value.contains("rate limit")
        || value.contains("too many requests")
        || value.contains("限流")
    {
        return "rate_limited".to_string();
    }
    map_status_error(status)
}

fn map_status_error(status: u16) -> String {
    match status {
        400 => "provider.bad_request".to_string(),
        401 => "auth.invalid_key".to_string(),
        403 => "auth.forbidden".to_string(),
        404 => "model.not_found".to_string(),
        408 => "network.timeout".to_string(),
        429 => "rate_limited".to_string(),
        500..=599 => "provider.server_error".to_string(),
        _ => format!("provider.http_{status}"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(StreamCancels::default())
        .manage(SecretCache::default())
        .invoke_handler(tauri::generate_handler![
            save_api_key,
            api_key_exists,
            delete_api_key,
            list_openai_models,
            stream_openai_chat,
            cancel_stream,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
