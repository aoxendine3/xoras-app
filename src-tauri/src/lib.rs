// src-tauri/src/lib.rs

mod sys;
mod db;
mod monitor;
mod anomaly;



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the SQLite-backed application state before the app starts so that
    // commands and the background monitor (which reads `State<DbState>`) can access it.
    let db_state = db::DbState::new(db::db_path()).expect("failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(db_state)
        // Register all Tauri commands used by the app
        .invoke_handler(tauri::generate_handler![
            // sys commands
            sys::get_system_metrics,
            sys::speak,
            sys::run_shell,
            sys::read_file,
            sys::write_file,
            sys::list_dir,
            sys::get_dojo_errors,
            // db commands
            db::init_app,
            db::get_settings,
            db::save_settings,
            db::list_projects,
            db::create_project,
            db::delete_project,
            db::list_conversations,
            db::create_conversation,
            db::delete_conversation,
            db::rename_conversation,
            db::get_messages,
            db::clear_messages,
            db::list_models,
            db::refresh_models,
            db::send_message,
            // monitor control commands
            monitor::monitor_start,
            monitor::monitor_stop,
        ])
        // Start the background monitoring task when the app is ready
        .setup(|app| {
            let app_handle = app.handle().clone();
            // Spawn the async monitoring loop using Tauri's async runtime
            tauri::async_runtime::spawn(async move {
                monitor::start(app_handle.clone()).await;
                anomaly::start(app_handle.clone()).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
