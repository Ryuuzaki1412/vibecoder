mod ai;

use ai::{ai_chat, ai_test, AIConfig};
use serde::{Deserialize, Serialize};
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

// ============================================================
// Online update — GitHub Releases API
// ============================================================

const GITHUB_REPO: &str = "Ryuuzaki1412/vibecoder";

#[derive(Debug, Serialize, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct GhRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    html_url: String,
    published_at: Option<String>,
    assets: Vec<GhAsset>,
}

#[derive(Debug, Serialize)]
struct UpdateInfo {
    current_version: String,
    latest_version: String,
    has_update: bool,
    release_name: Option<String>,
    release_notes: Option<String>,
    release_url: String,
    published_at: Option<String>,
    assets: Vec<GhAsset>,
}

/// Compare two semver-ish strings ("1.9.0" vs "1.12.0"). Returns true if
/// `a` is strictly older than `b`. Non-numeric parts are compared as strings.
fn version_lt(a: &str, b: &str) -> bool {
    let parse = |s: &str| -> Vec<u64> {
        s.trim_start_matches('v')
            .split(|c: char| !c.is_ascii_digit())
            .filter_map(|p| p.parse::<u64>().ok())
            .collect()
    };
    let av = parse(a);
    let bv = parse(b);
    av < bv
}

/// Fetch the latest release from GitHub and report whether the running
/// app is out of date. Network call — meant to be invoked when the user
/// clicks "Check for updates" in settings, not on app start.
#[tauri::command]
async fn check_update() -> Result<UpdateInfo, String> {
    let url = format!(
        "https://api.github.com/repos/{}/releases/latest",
        GITHUB_REPO
    );
    let client = reqwest::Client::builder()
        .user_agent("VibeCoder-Updater/1.0")
        .build()
        .map_err(|e| e.to_string())?;
    let release: GhRelease = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let has_update = version_lt(&current_version, &latest_version);

    Ok(UpdateInfo {
        current_version,
        latest_version,
        has_update,
        release_name: release.name,
        release_notes: release.body,
        release_url: release.html_url,
        published_at: release.published_at,
        assets: release.assets,
    })
}

/// Download a release asset (typically the .dmg) to ~/Downloads and
/// open it with the OS. On macOS this auto-mounts the DMG so the
/// user can drag the app to /Applications.
#[tauri::command]
async fn download_update(
    url: String,
    filename: String,
) -> Result<String, String> {
    let home = dirs_downloads()
        .ok_or_else(|| "无法定位下载目录".to_string())?;
    std::fs::create_dir_all(&home).map_err(|e| e.to_string())?;
    let dest = home.join(&filename);

    let client = reqwest::Client::builder()
        .user_agent("VibeCoder-Updater/1.0")
        .build()
        .map_err(|e| e.to_string())?;
    let bytes = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    // Auto-open the file with the OS. On macOS this mounts the DMG
    // and shows a Finder window with the .app ready to drag.
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&dest).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer").arg(&dest).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&dest).spawn();
    }

    Ok(dest.to_string_lossy().to_string())
}

/// Resolve the user's Downloads directory cross-platform without pulling
/// in a heavy `dirs` crate. Falls back to $HOME/Downloads.
fn dirs_downloads() -> Option<std::path::PathBuf> {
    if let Ok(p) = std::env::var("HOME") {
        let mut pb = std::path::PathBuf::from(p);
        pb.push("Downloads");
        return Some(pb);
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            call_ai,
            test_ai,
            save_pdf,
            check_update,
            download_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running vibecoder");
}