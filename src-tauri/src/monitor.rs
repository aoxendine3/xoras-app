// src-tauri/src/monitor.rs

//! Monitoring subsystem for Xoras App.
//!
//! Continuously collects system metrics using the `sysinfo` crate, logs them to the SQLite
//! database, and emits them to the front‑end via Tauri events.
//!
//! The module is deliberately lightweight: it only gathers a few key metrics and sends a
//! JSON payload every `INTERVAL_MS`. Anomaly detection lives in `anomaly.rs` and listens to
//! the `monitor_update` events.

use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State, Emitter};
use sysinfo::{System, Disks};

use crate::db; // for logging metrics

/// How often we sample metrics (in milliseconds).
const INTERVAL_MS: u64 = 2500;

/// Structure emitted to the front‑end (and consumed by anomaly detection).
#[derive(Debug, Serialize, Clone)]
pub struct MetricSnapshot {
    pub timestamp_ms: i64,
    pub cpu_usage: f32,
    pub ram_used_gb: f64,
    pub ram_total_gb: f64,
    pub ram_percent: f64,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub disk_percent: f64,
    pub processes: Vec<ProcessInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProcessInfo {
    pub pid: i32,
    pub name: String,
    pub cpu: f32,
    pub memory: u64,
}

/// Collect a snapshot of the current system state.
fn collect_metrics(sys: &mut System) -> MetricSnapshot {
    sys.refresh_all();
    let timestamp_ms = chrono::Utc::now().timestamp_millis();
    let cpu_usage = sys.global_cpu_usage();
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    let ram_total_gb = (total_memory as f64) / 1_048_576.0; // KiB → GB
    let ram_used_gb = (used_memory as f64) / 1_048_576.0;
    let ram_percent = (used_memory as f64) / (total_memory as f64) * 100.0;

    let disks = Disks::new_with_refreshed_list();
    let total_disk = disks.iter().map(|d| d.total_space()).sum::<u64>();
    let available_disk = disks.iter().map(|d| d.available_space()).sum::<u64>();
    let used_disk = total_disk.saturating_sub(available_disk);
    let disk_total_gb = (total_disk as f64) / 1_073_741_824.0;
    let disk_used_gb = (used_disk as f64) / 1_073_741_824.0;
    let disk_percent = if total_disk > 0 {
        (used_disk as f64) / (total_disk as f64) * 100.0
    } else {
        0.0
    };

    let processes = sys
        .processes()
        .values()
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32() as i32,
            name: p.name().to_string_lossy().into_owned(),
            cpu: p.cpu_usage(),
            memory: p.memory(),
        })
        .collect();

    MetricSnapshot {
        timestamp_ms,
        cpu_usage,
        ram_used_gb,
        ram_total_gb,
        ram_percent,
        disk_used_gb,
        disk_total_gb,
        disk_percent,
        processes,
    }
}

/// Starts the asynchronous monitoring loop. Called once during app setup.
pub async fn start(app_handle: AppHandle) {
    // Shared flag for future stop capability.
    let running = Arc::new(Mutex::new(true));
    let running_clone = running.clone();
    let app_handle_clone = app_handle.clone();

    tauri::async_runtime::spawn(async move {
        let mut sys = System::new_all();
        sys.refresh_all();
        // Wait briefly for a baseline CPU measurement
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        while *running_clone.lock().unwrap() {
            let snapshot = collect_metrics(&mut sys);
            let db_state = app_handle_clone.state::<db::DbState>();
            let _ = db::log_system_metric(db_state.inner(), &snapshot);
            // Emit to front‑end and anomaly detector.
            let _ = app_handle_clone.emit(
                "monitor_update",
                snapshot,
            );
            tokio::time::sleep(std::time::Duration::from_millis(INTERVAL_MS)).await;
        }
    });
}

/// Command to manually start monitoring (no‑op if already running).
#[tauri::command]
pub fn monitor_start(_state: State<db::DbState>) -> Result<(), String> {
    // Start the background monitoring task when the app is ready started in `run`. This placeholder exists for API compatibility.
    Ok(())
}

/// Command to manually stop monitoring (placeholder, not implemented yet).
#[tauri::command]
pub fn monitor_stop(_state: State<db::DbState>) -> Result<(), String> {
    // Full stop would need a cancellation token; left as future work.
    Ok(())
}
