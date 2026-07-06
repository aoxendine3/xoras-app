use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::process::Command;
use sysinfo::{Disks, System};
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub ram_used_gb: f64,
    pub ram_total_gb: f64,
    pub ram_percent: f64,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub disk_percent: f64,
    pub disk_available_gb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DojoError {
    pub id: i64,
    pub timestamp: String,
    pub exception_type: String,
    pub error_message: String,
    pub status: String,
    pub healing_action: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Resolve the Omni-Dojo database path.
/// Priority:
///   1. <app_data_dir>/dojo/global_catalyst.db  (canonical, cross-platform)
///   2. Legacy hardcoded path on Anthony's machine (migration fallback)
fn resolve_dojo_path(app: &AppHandle) -> std::path::PathBuf {
    // Canonical location — lives in user app data, travels cross-platform
    let canonical = app
        .path()
        .app_data_dir()
        .map(|p| p.join("dojo").join("global_catalyst.db"))
        .unwrap_or_default();

    if canonical.exists() {
        return canonical;
    }

    // Legacy fallback — existing DB on this machine
    let legacy = std::path::PathBuf::from(
        "/Users/ajoxendine68/Desktop/Xoras_Project/Omni_Dojo_Sandbox/Error_Catalyst/global_catalyst.db",
    );

    if legacy.exists() {
        return legacy;
    }

    // Return canonical anyway — first launch will create it
    canonical
}

#[tauri::command]
pub fn get_system_metrics() -> Result<SystemMetrics, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_usage = sys.global_cpu_usage();

    let ram_total = sys.total_memory() as f64;
    let ram_used = sys.used_memory() as f64;
    let ram_total_gb = ram_total / 1_073_741_824.0;
    let ram_used_gb = ram_used / 1_073_741_824.0;
    let ram_percent = if ram_total > 0.0 { (ram_used / ram_total) * 100.0 } else { 0.0 };

    // Disk stats via sysinfo so this works cross-platform (macOS/Linux/Windows).
    // Prefer the volume mounted at the filesystem root; otherwise fall back to
    // the largest disk so the dashboard always shows a meaningful figure.
    const GB: f64 = 1_073_741_824.0;
    let disks = Disks::new_with_refreshed_list();
    let root = if cfg!(windows) { "C:\\" } else { "/" };
    let chosen = disks
        .iter()
        .find(|d| d.mount_point().to_string_lossy() == root)
        .or_else(|| disks.iter().max_by_key(|d| d.total_space()));

    let (mut disk_total_gb, mut disk_used_gb, mut disk_available_gb, mut disk_percent) =
        (0.0f64, 0.0f64, 0.0f64, 0.0f64);
    if let Some(disk) = chosen {
        let total = disk.total_space() as f64;
        let avail = disk.available_space() as f64;
        let used = (total - avail).max(0.0);
        disk_total_gb = total / GB;
        disk_available_gb = avail / GB;
        disk_used_gb = used / GB;
        disk_percent = if total > 0.0 { (used / total) * 100.0 } else { 0.0 };
    }

    Ok(SystemMetrics {
        cpu_usage,
        ram_used_gb,
        ram_total_gb,
        ram_percent,
        disk_used_gb,
        disk_total_gb,
        disk_percent,
        disk_available_gb,
    })
}

/// Speak text using the OS TTS. Non-blocking and best-effort: uses macOS `say`,
/// and on Linux falls back to whichever of `spd-say`/`espeak-ng`/`espeak` exists.
/// A missing TTS engine is not treated as an error so callers never break.
#[tauri::command]
pub fn speak(text: String) -> Result<(), String> {
    let candidates: &[&str] = if cfg!(target_os = "macos") {
        &["say"]
    } else if cfg!(windows) {
        // PowerShell speech synthesizer handled separately below.
        &[]
    } else {
        &["spd-say", "espeak-ng", "espeak"]
    };

    for bin in candidates {
        if Command::new(bin).arg(&text).spawn().is_ok() {
            return Ok(());
        }
    }

    #[cfg(windows)]
    {
        let script = format!(
            "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('{}')",
            text.replace('\'', "''")
        );
        let _ = Command::new("powershell").args(["-Command", &script]).spawn();
    }

    // No TTS engine available — silently succeed rather than surfacing an error.
    Ok(())
}

/// Execute a shell command synchronously and return stdout/stderr/exit code.
/// Uses the platform's default shell (`cmd` on Windows, `sh` elsewhere).
#[tauri::command]
pub fn run_shell(command: String) -> Result<ShellResult, String> {
    let output = if cfg!(windows) {
        Command::new("cmd").args(["/C", &command]).output()
    } else {
        Command::new("sh").args(["-c", &command]).output()
    }
    .map_err(|e| e.to_string())?;

    Ok(ShellResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

/// Read a file's contents as a UTF-8 string.
#[tauri::command]
pub fn read_file(app: AppHandle, path: String) -> Result<String, String> {
    // Resolve relative to app data dir if path is not absolute
    let resolved = if std::path::Path::new(&path).is_absolute() {
        std::path::PathBuf::from(&path)
    } else {
        app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join(&path)
    };
    std::fs::read_to_string(resolved).map_err(|e| e.to_string())
}

/// Write a string to a file (creates parent directories as needed).
#[tauri::command]
pub fn write_file(app: AppHandle, path: String, content: String) -> Result<(), String> {
    let resolved = if std::path::Path::new(&path).is_absolute() {
        std::path::PathBuf::from(&path)
    } else {
        app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join(&path)
    };
    if let Some(parent) = resolved.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(resolved, content).map_err(|e| e.to_string())
}

/// List directory contents — sorted dirs first, then files alphabetically.
#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<serde_json::Value>, String> {
    let entries = std::fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut result: Vec<serde_json::Value> = entries
        .flatten()
        .filter_map(|entry| {
            let meta = entry.metadata().ok()?;
            Some(serde_json::json!({
                "name": entry.file_name().to_string_lossy().to_string(),
                "is_dir": meta.is_dir(),
                "size": if meta.is_dir() { None::<u64> } else { Some(meta.len()) },
                "path": entry.path().to_string_lossy().to_string(),
            }))
        })
        .collect();

    result.sort_by(|a, b| {
        let a_dir = a["is_dir"].as_bool().unwrap_or(false);
        let b_dir = b["is_dir"].as_bool().unwrap_or(false);
        b_dir
            .cmp(&a_dir)
            .then_with(|| a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or("")))
    });

    Ok(result)
}

/// Fetch latest Omni-Dojo error records.
/// Uses app_data_dir canonical path with automatic legacy fallback.
#[tauri::command]
pub fn get_dojo_errors(app: AppHandle) -> Result<Vec<DojoError>, String> {
    let db_path = resolve_dojo_path(&app);

    if !db_path.exists() {
        // No DB yet — return empty list rather than erroring
        return Ok(vec![]);
    }

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Try the known schema; gracefully degrade if columns differ
    let sql = "SELECT id, timestamp, exception_type, error_message, status, healing_action \
               FROM error_logs ORDER BY id DESC LIMIT 50";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let errors: Vec<DojoError> = stmt
        .query_map([], |row| {
            Ok(DojoError {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                exception_type: row.get(2)?,
                error_message: row.get(3)?,
                status: row.get(4)?,
                healing_action: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(errors)
}
