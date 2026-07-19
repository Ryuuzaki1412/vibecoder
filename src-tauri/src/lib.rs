mod ai;

use ai::{ai_chat, ai_test, AIConfig};
use tauri_plugin_dialog::DialogExt;

// ============================================================
// Tauri commands
// ============================================================

/// Call AI: takes config from JS, never exposes the key in storage.
#[tauri::command]
async fn call_ai(
    config: AIConfig,
    system_prompt: String,
    user_message: String,
) -> Result<String, String> {
    ai_chat(config, system_prompt, user_message)
        .await
        .map_err(|e| e.to_string())
}

/// Test AI connectivity by sending a tiny ping message.
#[tauri::command]
async fn test_ai(config: AIConfig) -> Result<String, String> {
    ai_test(config).await.map_err(|e| e.to_string())
}

/// Show the native save dialog and write the supplied PDF bytes to disk.
/// Returns the saved path, or `None` if the user cancelled.
#[tauri::command]
async fn save_pdf(
    app: tauri::AppHandle,
    filename: String,
    bytes: Vec<u8>,
) -> Result<Option<String>, String> {
    let chosen = app
        .dialog()
        .file()
        .add_filter("PDF Document", &["pdf"])
        .set_file_name(&filename)
        .blocking_save_file();

    let Some(path) = chosen else {
        return Ok(None);
    };
    let path_str = path.to_string();
    std::fs::write(&path_str, &bytes).map_err(|e| e.to_string())?;
    Ok(Some(path_str))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![call_ai, test_ai, save_pdf])
        .run(tauri::generate_context!())
        .expect("error while running vibecoder");
}