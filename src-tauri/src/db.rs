use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, State};
use crate::monitor::MetricSnapshot;
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub status: String,
    pub model: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default = "whoami")]
    pub username: String,
    #[serde(default)]
    pub gemini_api_key: String,
    #[serde(default = "default_ollama_url")]
    pub ollama_url: String,
    #[serde(default = "default_lmstudio_url")]
    pub lmstudio_url: String,
    #[serde(default)]
    pub custom_cloud_models: String,
    #[serde(default)]
    pub local_only: bool,
    #[serde(default = "default_model_id")]
    pub default_model: String,
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_ollama_url() -> String {
    "http://127.0.0.1:11434".to_string()
}

fn default_lmstudio_url() -> String {
    "http://127.0.0.1:1234".to_string()
}

fn default_model_id() -> String {
    "ollama::llama3.2".to_string()
}

fn default_theme() -> String {
    "light".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            username: whoami(),
            gemini_api_key: String::new(),
            ollama_url: "http://127.0.0.1:11434".to_string(),
            lmstudio_url: "http://127.0.0.1:1234".to_string(),
            custom_cloud_models: String::new(),
            local_only: false,
            default_model: "ollama::llama3.2".to_string(),
            theme: "light".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub badge: String,
    #[serde(default)]
    pub size: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatus {
    pub ollama_online: bool,
    pub lmstudio_online: bool,
    pub ollama_count: usize,
    pub lmstudio_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
    pub status: ModelStatus,
}

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    pub fn new(db_path: PathBuf) -> Result<Self, rusqlite::Error> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'idle',
                model TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS system_metrics (
                timestamp_ms INTEGER PRIMARY KEY,
                cpu_usage REAL NOT NULL,
                ram_used_gb REAL NOT NULL,
                ram_total_gb REAL NOT NULL,
                ram_percent REAL NOT NULL,
                disk_used_gb REAL NOT NULL,
                disk_total_gb REAL NOT NULL,
                disk_percent REAL NOT NULL,
                processes_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS anomalies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp_ms INTEGER NOT NULL,
                typ TEXT NOT NULL,
                description TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            ",
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn db_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Xoras")
        .join("xoras.db")
}

#[tauri::command]
pub fn init_app(state: State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    if count == 0 {
        let id = Uuid::new_v4().to_string();
        let ts = now_ms();
        conn.execute(
            "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, "Xoras", "/Users/ajoxendine68/Desktop/Projects/Xoras", ts, ts],
        )
        .map_err(|e| e.to_string())?;

        let conv_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO conversations (id, project_id, title, status, model, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![conv_id, id, "Xoras, wake up!", "in_progress", "ollama::llama3.2", ts, ts],
        )
        .map_err(|e| e.to_string())?;
    }

    let settings_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM settings", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    if settings_count == 0 {
        let mut defaults = AppSettings::default();
        defaults.gemini_api_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
        save_settings_inner(&conn, &defaults)?;
    }

    Ok(())
}

fn whoami() -> String {
    std::env::var("USER").unwrap_or_else(|_| "xoras".to_string())
}

fn save_settings_inner(conn: &Connection, settings: &AppSettings) -> Result<(), String> {
    let json = serde_json::to_string(settings).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('app', ?1)",
        params![json],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_settings(state: State<DbState>) -> Result<AppSettings, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let result: Result<String, _> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'app'",
        [],
        |r| r.get(0),
    );
    match result {
        Ok(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        Err(_) => Ok(AppSettings {
            username: whoami(),
            ..Default::default()
        }),
    }
}

#[tauri::command]
pub fn save_settings(state: State<DbState>, settings: AppSettings) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    save_settings_inner(&conn, &settings)
}

#[tauri::command]
pub fn list_projects(state: State<DbState>) -> Result<Vec<Project>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, path, created_at, updated_at FROM projects ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(state: State<DbState>, name: String, path: Option<String>) -> Result<Project, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let ts = now_ms();
    conn.execute(
        "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, path, ts, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(Project {
        id,
        name,
        path,
        created_at: ts,
        updated_at: ts,
    })
}

#[tauri::command]
pub fn delete_project(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let conv_ids: Vec<String> = conn
        .prepare("SELECT id FROM conversations WHERE project_id = ?1")
        .map_err(|e| e.to_string())?
        .query_map(params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    for conv_id in conv_ids {
        conn.execute("DELETE FROM messages WHERE conversation_id = ?1", params![conv_id])
            .map_err(|e| e.to_string())?;
    }
    conn.execute("DELETE FROM conversations WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_conversations(state: State<DbState>, project_id: String) -> Result<Vec<Conversation>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, status, model, created_at, updated_at FROM conversations WHERE project_id = ?1 ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                status: row.get(3)?,
                model: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_conversation(
    state: State<DbState>,
    project_id: String,
    title: String,
) -> Result<Conversation, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let ts = now_ms();
    conn.execute(
        "INSERT INTO conversations (id, project_id, title, status, model, created_at, updated_at) VALUES (?1, ?2, ?3, 'in_progress', NULL, ?4, ?5)",
        params![id, project_id, title, ts, ts],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET updated_at = ?1 WHERE id = ?2",
        params![ts, project_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(Conversation {
        id,
        project_id,
        title,
        status: "in_progress".to_string(),
        model: None,
        created_at: ts,
        updated_at: ts,
    })
}

#[tauri::command]
pub fn delete_conversation(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM messages WHERE conversation_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rename_conversation(state: State<DbState>, id: String, title: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();
    conn.execute(
        "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, ts, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_messages(state: State<DbState>, conversation_id: String) -> Result<Vec<Message>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_messages(state: State<DbState>, conversation_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM messages WHERE conversation_id = ?1",
        params![conversation_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_models(state: State<'_, DbState>) -> Result<ModelsResponse, String> {
    fetch_models(state).await
}

#[tauri::command]
pub async fn refresh_models(state: State<'_, DbState>) -> Result<ModelsResponse, String> {
    fetch_models(state).await
}

fn format_bytes(bytes: u64) -> String {
    const GB: f64 = 1024.0 * 1024.0 * 1024.0;
    const MB: f64 = 1024.0 * 1024.0;
    if bytes as f64 >= GB {
        format!("{:.1} GB", bytes as f64 / GB)
    } else {
        format!("{:.0} MB", bytes as f64 / MB)
    }
}

fn parse_model_id(model: &str) -> (String, String) {
    if let Some((provider, name)) = model.split_once("::") {
        return (provider.to_string(), name.to_string());
    }
    if model.starts_with("gemini") {
        return ("gemini".to_string(), model.to_string());
    }
    ("ollama".to_string(), model.to_string())
}

async fn fetch_models(state: State<'_, DbState>) -> Result<ModelsResponse, String> {
    let settings = get_settings(state)?;
    let mut models: Vec<ModelInfo> = Vec::new();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .map_err(|e| e.to_string())?;

    let mut ollama_online = false;
    let mut ollama_count = 0usize;
    let mut lmstudio_online = false;
    let mut lmstudio_count = 0usize;

    if let Ok(resp) = client
        .get(format!("{}/api/tags", settings.ollama_url.trim_end_matches('/')))
        .send()
        .await
    {
        if resp.status().is_success() {
            ollama_online = true;
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                if let Some(arr) = body.get("models").and_then(|m| m.as_array()) {
                    for m in arr {
                        if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                            let size = m
                                .get("size")
                                .and_then(|s| s.as_u64())
                                .map(format_bytes);
                            models.push(ModelInfo {
                                id: format!("ollama::{name}"),
                                name: name.to_string(),
                                provider: "ollama".into(),
                                badge: "Local".into(),
                                size,
                            });
                            ollama_count += 1;
                        }
                    }
                }
            }
        }
    }

    if let Ok(resp) = client
        .get(format!(
            "{}/v1/models",
            settings.lmstudio_url.trim_end_matches('/')
        ))
        .send()
        .await
    {
        if resp.status().is_success() {
            lmstudio_online = true;
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                if let Some(arr) = body.get("data").and_then(|d| d.as_array()) {
                    for m in arr {
                        if let Some(id) = m.get("id").and_then(|n| n.as_str()) {
                            models.push(ModelInfo {
                                id: format!("lmstudio::{id}"),
                                name: id.to_string(),
                                provider: "lmstudio".into(),
                                badge: "Local".into(),
                                size: None,
                            });
                            lmstudio_count += 1;
                        }
                    }
                }
            }
        }
    }

    if !settings.local_only {
        let default_cloud = vec![
            ("gemini-2.0-flash", "Gemini 2.0 Flash"),
            ("gemini-1.5-pro", "Gemini 1.5 Pro"),
            ("gemini-2.0-flash-lite", "Gemini 2.0 Flash Lite"),
        ];
        for (id, name) in default_cloud {
            models.push(ModelInfo {
                id: format!("gemini::{id}"),
                name: name.into(),
                provider: "gemini".into(),
                badge: "Cloud".into(),
                size: None,
            });
        }

        for line in settings.custom_cloud_models.lines() {
            let id = line.trim();
            if id.is_empty() {
                continue;
            }
            let model_id = format!("gemini::{id}");
            if !models.iter().any(|m| m.id == model_id) {
                models.push(ModelInfo {
                    id: model_id,
                    name: id.to_string(),
                    provider: "gemini".into(),
                    badge: "Cloud".into(),
                    size: None,
                });
            }
        }
    }

    Ok(ModelsResponse {
        models,
        status: ModelStatus {
            ollama_online,
            lmstudio_online,
            ollama_count,
            lmstudio_count,
        },
    })
}

const SYSTEM_PROMPT: &str = "You are Maxx, the sovereign AI agent inside Xoras — a personal command center inspired by Google Antigravity. You are direct, capable, and production-focused. You help the user build, audit, and ship real software. Never leave tasks half-done. Prefer complete, working solutions over stubs.";

#[tauri::command]
pub async fn send_message(
    window: tauri::Window,
    state: State<'_, DbState>,
    conversation_id: String,
    content: String,
    model: String,
) -> Result<(), String> {
    let settings = get_settings(state.clone())?;
    let history = get_messages(state.clone(), conversation_id.clone())?;

    let user_id = Uuid::new_v4().to_string();
    let ts = now_ms();
    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?1, ?2, 'user', ?3, ?4)",
            params![user_id, conversation_id, content, ts],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE conversations SET status = 'in_progress', model = ?1, updated_at = ?2 WHERE id = ?3",
            params![model, ts, conversation_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let (provider, model_name) = parse_model_id(&model);

    if settings.local_only && provider == "gemini" {
        return Err("Off-grid mode is enabled. Choose a local Ollama or LM Studio model.".to_string());
    }

    let api_key = if settings.gemini_api_key.is_empty() {
        std::env::var("GEMINI_API_KEY").unwrap_or_default()
    } else {
        settings.gemini_api_key.clone()
    };

    let result = match provider.as_str() {
        "ollama" => stream_ollama(&window, &settings, &history, &content, &model_name).await,
        "lmstudio" => stream_lmstudio(&window, &settings, &history, &content, &model_name).await,
        "gemini" => {
            if api_key.is_empty() {
                Err("Gemini API key not configured. Add it in Settings or enable off-grid mode.".to_string())
            } else {
                stream_gemini(&window, &api_key, &history, &content, &model_name).await
            }
        }
        other => Err(format!("Unknown model provider: {other}")),
    };

    match result {
        Ok(full_response) => {
            let assistant_id = Uuid::new_v4().to_string();
            let ts = now_ms();
            let title = derive_title(&content, &full_response);

            {
                let conn = state.conn.lock().map_err(|e| e.to_string())?;
                conn.execute(
                    "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?1, ?2, 'assistant', ?3, ?4)",
                    params![assistant_id, conversation_id, full_response, ts],
                )
                .map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE conversations SET title = ?1, status = 'idle', updated_at = ?2 WHERE id = ?3",
                    params![title, ts, conversation_id],
                )
                .map_err(|e| e.to_string())?;
            }

            let message = Message {
                id: assistant_id,
                role: "assistant".into(),
                content: full_response.clone(),
                created_at: ts,
            };

            window
                .emit(
                    "chat-done",
                    serde_json::json!({ "message": message, "title": title }),
                )
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(err) => {
            window
                .emit("chat-error", serde_json::json!({ "error": err.clone() }))
                .ok();
            Err(err)
        }
    }
}

fn derive_title(user: &str, _assistant: &str) -> String {
    let trimmed = user.lines().next().unwrap_or(user).trim();
    if trimmed.len() > 48 {
        format!("{}…", &trimmed[..45])
    } else if trimmed.is_empty() {
        "New Conversation".to_string()
    } else {
        trimmed.to_string()
    }
}

async fn stream_ollama(
    window: &tauri::Window,
    settings: &AppSettings,
    history: &[Message],
    content: &str,
    model: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut messages = vec![serde_json::json!({"role": "system", "content": SYSTEM_PROMPT})];
    for msg in history {
        messages.push(serde_json::json!({"role": msg.role, "content": msg.content}));
    }
    messages.push(serde_json::json!({"role": "user", "content": content}));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true
    });

    let resp = client
        .post(format!("{}/api/chat", settings.ollama_url.trim_end_matches('/')))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama unreachable at {}: {e}", settings.ollama_url))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama error: {}", resp.status()));
    }

    let mut full = String::new();
    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        for line in std::str::from_utf8(&chunk).unwrap_or("").lines() {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(text) = json
                    .pointer("/message/content")
                    .and_then(|v| v.as_str())
                {
                    full.push_str(text);
                    window
                        .emit("chat-chunk", serde_json::json!({ "content": text }))
                        .ok();
                }
            }
        }
    }

    if full.is_empty() {
        return Err("Ollama returned empty response. Is the model pulled?".to_string());
    }

    Ok(full)
}

async fn stream_lmstudio(
    window: &tauri::Window,
    settings: &AppSettings,
    history: &[Message],
    content: &str,
    model: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut messages = vec![serde_json::json!({"role": "system", "content": SYSTEM_PROMPT})];
    for msg in history {
        messages.push(serde_json::json!({"role": msg.role, "content": msg.content}));
    }
    messages.push(serde_json::json!({"role": "user", "content": content}));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true
    });

    let resp = client
        .post(format!(
            "{}/v1/chat/completions",
            settings.lmstudio_url.trim_end_matches('/')
        ))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LM Studio unreachable at {}: {e}", settings.lmstudio_url))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("LM Studio error {status}: {text}"));
    }

    let mut full = String::new();
    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        for line in std::str::from_utf8(&chunk).unwrap_or("").lines() {
            let line = line.trim();
            if !line.starts_with("data: ") {
                continue;
            }
            let data = &line[6..];
            if data == "[DONE]" {
                continue;
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(text) = json
                    .pointer("/choices/0/delta/content")
                    .and_then(|v| v.as_str())
                {
                    full.push_str(text);
                    window
                        .emit("chat-chunk", serde_json::json!({ "content": text }))
                        .ok();
                }
            }
        }
    }

    if full.is_empty() {
        return Err("LM Studio returned empty response. Load a model and enable the local server.".to_string());
    }

    Ok(full)
}

async fn stream_gemini(
    window: &tauri::Window,
    api_key: &str,
    history: &[Message],
    content: &str,
    model: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut contents = Vec::new();
    for msg in history {
        let role = if msg.role == "assistant" { "model" } else { "user" };
        contents.push(serde_json::json!({
            "role": role,
            "parts": [{"text": msg.content}]
        }));
    }
    contents.push(serde_json::json!({
        "role": "user",
        "parts": [{"text": content}]
    }));

    let body = serde_json::json!({
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.7}
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
        model, api_key
    );

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini error {status}: {text}"));
    }

    let mut full = String::new();
    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        for line in std::str::from_utf8(&chunk).unwrap_or("").lines() {
            let line = line.trim();
            if !line.starts_with("data: ") {
                continue;
            }
            let data = &line[6..];
            if data == "[DONE]" {
                continue;
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(text) = json
                    .pointer("/candidates/0/content/parts/0/text")
                    .and_then(|v| v.as_str())
                {
                    full.push_str(text);
                    window
                        .emit("chat-chunk", serde_json::json!({ "content": text }))
                        .ok();
                }
            }
        }
    }

    if full.is_empty() {
        return Err("Gemini returned empty response.".to_string());
    }

    Ok(full)
}

// -----------------------------------------------------------------------------
// Logging utilities for system metrics and anomalies
// -----------------------------------------------------------------------------

pub fn log_system_metric(state: &DbState, snapshot: &MetricSnapshot) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO system_metrics (timestamp_ms, cpu_usage, ram_used_gb, ram_total_gb, ram_percent, disk_used_gb, disk_total_gb, disk_percent, processes_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            snapshot.timestamp_ms,
            snapshot.cpu_usage,
            snapshot.ram_used_gb,
            snapshot.ram_total_gb,
            snapshot.ram_percent,
            snapshot.disk_used_gb,
            snapshot.disk_total_gb,
            snapshot.disk_percent,
            serde_json::to_string(&snapshot.processes).map_err(|e| e.to_string())?,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn log_anomaly(state: &DbState, typ: &str, description: &str, payload: &Value) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO anomalies (timestamp_ms, typ, description, payload_json) VALUES (?1, ?2, ?3, ?4)",
        params![
            now_ms(),
            typ,
            description,
            serde_json::to_string(payload).map_err(|e| e.to_string())?,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
