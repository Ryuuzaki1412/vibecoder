use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;

// ============================================================
// AI provider abstraction
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIConfig {
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
}

fn default_timeout() -> u64 {
    120
}

impl AIConfig {
    pub fn validate(&self) -> Result<()> {
        if self.base_url.trim().is_empty() {
            return Err(anyhow!("Base URL 未配置"));
        }
        if self.model.trim().is_empty() {
            return Err(anyhow!("Model ID 未配置"));
        }
        // api_key optional for local providers
        Ok(())
    }

    fn is_anthropic(&self) -> bool {
        matches!(self.provider.as_str(), "anthropic")
    }
}

fn build_client(timeout_secs: u64) -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs.max(10)))
        .connect_timeout(Duration::from_secs(15))
        .build()
        .expect("reqwest client build")
}

// ============================================================
// Anthropic Messages API
// ============================================================

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    #[serde(default)]
    content: Vec<AnthropicContentBlock>,
    #[serde(default)]
    error: Option<ApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    text: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ApiErrorBody {
    #[serde(default)]
    pub message: String,
}

async fn chat_anthropic(
    client: &reqwest::Client,
    cfg: &AIConfig,
    system_prompt: &str,
    user_message: &str,
) -> Result<String> {
    let body = json!({
        "model": cfg.model,
        "max_tokens": 8192,
        "system": system_prompt,
        "messages": [
            { "role": "user", "content": user_message }
        ],
    });
    let url = format!("{}/v1/messages", cfg.base_url.trim_end_matches('/'));
    let mut req = client
        .post(&url)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body);
    if !cfg.api_key.is_empty() {
        req = req.header("x-api-key", &cfg.api_key);
    }
    let resp = req.send().await.context("send anthropic request")?;
    let status = resp.status();
    let body_text = resp.text().await.context("read body")?;
    if !status.is_success() {
        return Err(anyhow!("HTTP {}: {}", status, body_text));
    }
    let parsed: AnthropicResponse =
        serde_json::from_str(&body_text).context("parse anthropic response")?;
    if let Some(err) = parsed.error {
        return Err(anyhow!("API error: {}", err.message));
    }
    let reply = parsed
        .content
        .into_iter()
        .filter(|c| c.kind == "text")
        .map(|c| c.text)
        .collect::<Vec<_>>()
        .join("");
    Ok(if reply.is_empty() {
        "(模型无回复)".to_string()
    } else {
        reply
    })
}

// ============================================================
// OpenAI-compatible Chat Completions API
// ============================================================

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    #[serde(default)]
    choices: Vec<OpenAIChoice>,
    #[serde(default)]
    error: Option<ApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIRespMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAIRespMessage {
    #[serde(default)]
    content: String,
}

async fn chat_openai(
    client: &reqwest::Client,
    cfg: &AIConfig,
    system_prompt: &str,
    user_message: &str,
) -> Result<String> {
    let body = json!({
        "model": cfg.model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_message }
        ],
    });
    let url = format!("{}/chat/completions", cfg.base_url.trim_end_matches('/'));
    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body);
    if !cfg.api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", cfg.api_key));
    }
    let resp = req.send().await.context("send openai request")?;
    let status = resp.status();
    let body_text = resp.text().await.context("read body")?;
    if !status.is_success() {
        return Err(anyhow!("HTTP {}: {}", status, body_text));
    }
    let parsed: OpenAIResponse =
        serde_json::from_str(&body_text).context("parse openai response")?;
    if let Some(err) = parsed.error {
        return Err(anyhow!("API error: {}", err.message));
    }
    let reply = parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .unwrap_or_default();
    Ok(if reply.is_empty() {
        "(模型无回复)".to_string()
    } else {
        reply
    })
}

// ============================================================
// Public API
// ============================================================

pub async fn ai_chat(
    config: AIConfig,
    system_prompt: String,
    user_message: String,
) -> Result<String> {
    config.validate()?;
    let client = build_client(config.timeout_secs);
    if config.is_anthropic() {
        chat_anthropic(&client, &config, &system_prompt, &user_message).await
    } else {
        // openai, deepseek, qwen, ollama, lmstudio, custom — all OpenAI-compatible
        chat_openai(&client, &config, &system_prompt, &user_message).await
    }
}

pub async fn ai_test(config: AIConfig) -> Result<String> {
    config.validate()?;
    let client = build_client(std::cmp::min(config.timeout_secs, 30));

    let ping_system = "You are a connectivity test assistant. Reply with exactly: PONG";
    let ping_user = "ping";

    let reply = if config.is_anthropic() {
        chat_anthropic(&client, &config, ping_system, ping_user).await?
    } else {
        chat_openai(&client, &config, ping_system, ping_user).await?
    };

    Ok(if reply.is_empty() {
        "(empty reply)".to_string()
    } else {
        reply
    })
}