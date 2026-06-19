// src-tauri/src/anomaly.rs

//! Simple rule‑based anomaly detection for Xoras App.
//!
//! Listens for `monitor_update` events, applies a few lightweight heuristics, and
//! emits `anomaly_detected` events when a rule is triggered. All detections are
//! logged to the SQLite database via helper functions defined in `db.rs`.
//!
//! The design purposefully avoids any automatic remediation – it only reports.
//! Users can later hook UI actions to address anomalies.

use serde::Deserialize;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Listener, Manager};
use crate::db;

/// Internal state tracking recent metric samples.
// Internal state tracking recent metric samples.
struct DetectorState {
    /// Rolling window of the last N CPU usage percentages.
    cpu_samples: Vec<f32>,
    /// Rolling window of memory usage percentages.
    mem_samples: Vec<f64>,
    /// Rolling window of disk usage percentages.
    disk_samples: Vec<f32>,
    /// Number of samples to keep for consecutive checks.
    window_size: usize,
}

impl DetectorState {
    fn new(window: usize) -> Self {
        Self {
            cpu_samples: Vec::with_capacity(window),
            mem_samples: Vec::with_capacity(window),
            disk_samples: Vec::with_capacity(window),
            window_size: window,
        }
    }

    fn push(&mut self, cpu: f32, mem: f64) {
        if self.cpu_samples.len() == self.window_size {
            self.cpu_samples.remove(0);
        }
        if self.mem_samples.len() == self.window_size {
            self.mem_samples.remove(0);
        }
        self.cpu_samples.push(cpu);
        self.mem_samples.push(mem);
    }

    fn consecutive_high_cpu(&self, threshold: f32, required: usize) -> bool {
        if self.cpu_samples.len() < required {
            return false;
        }
        self.cpu_samples.iter().rev().take(required).all(|&v| v > threshold)
    }

    fn high_memory(&self, threshold: f64) -> bool {
        self.mem_samples.iter().any(|&v| v > threshold)
    }
}

/// Deserialise the payload emitted by `monitor_update`.
#[derive(Debug, Deserialize, Clone)]
struct MetricSnapshot {
    timestamp_ms: i64,
    cpu_usage: f32,
    ram_used_gb: f64,
    ram_total_gb: f64,
    ram_percent: f64,
    // other fields are ignored for detection
    #[serde(skip)]
    _ignore: Option<serde_json::Value>,
}

/// Starts the anomaly detection loop. This should be called once during app setup.
pub async fn start(app_handle: AppHandle) {
    // Shared detector state.
    let state = Arc::new(Mutex::new(DetectorState::new(5)));
    let app_handle_clone = app_handle.clone();
    let state_clone = state.clone();

    // Register a global listener for monitor updates.
    app_handle.listen_any("monitor_update", move |event| {
        // Parse the payload.
        let payload = match serde_json::from_str::<MetricSnapshot>(&event.payload()) {
            Ok(p) => p,
            Err(e) => {
                // Emit error for visibility.
                let _ = app_handle_clone.emit("anomaly_error", &format!("Failed to parse metric: {}", e));
                return;
            }
        };

        // Update detector state.
        let mut detector = match state_clone.lock() {
            Ok(d) => d,
            Err(poisoned) => poisoned.into_inner(),
        };
        detector.push(payload.cpu_usage, payload.ram_percent);

        // Check rules.
        let mut anomalies = Vec::new();
        if detector.consecutive_high_cpu(90.0, 3) {
            anomalies.push(("cpu_spike", "CPU > 90% for 3 consecutive samples"));
        }
        if detector.high_memory(80.0) {
            anomalies.push(("memory_high", "Memory usage > 80%"));
        }

        for (typ, description) in anomalies {
            // Emit to frontend.
            let _ = app_handle_clone.emit("anomaly_detected", serde_json::json!({
                "type": typ,
                "description": description,
                "timestamp_ms": payload.timestamp_ms,
            }));
            // Log to DB
            let db_state = app_handle_clone.state::<db::DbState>();
            let details = serde_json::json!({
                "cpu_usage": payload.cpu_usage,
                "ram_percent": payload.ram_percent,
                "timestamp_ms": payload.timestamp_ms,
            });
            let _ = db::log_anomaly(db_state.inner(), typ, description, &details);
        }
    });
}
