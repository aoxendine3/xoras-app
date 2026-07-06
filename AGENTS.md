# AGENTS.md

## Cursor Cloud specific instructions

### What this is
Xoras is a **Tauri 2 desktop app** (an AI chat "command center").
- **Frontend:** React 19 + Vite (dev server on port `1420`). Source in `src/`.
- **Backend:** Rust (`src-tauri/`) exposing Tauri commands for SQLite persistence
  (`db.rs`), system metrics/shell/file access (`sys.rs`), and background
  monitoring/anomaly detection (`monitor.rs`, `anomaly.rs`).

### Running / building (standard commands live in `package.json`)
- Full desktop app (dev): `npm run tauri:dev` — this runs Vite, compiles the Rust
  backend, and launches the native GUI window. A display is required; on the cloud
  VM use `DISPLAY=:1`.
- Frontend only: `npm run dev` (UI on `1420`) — note the Tauri `invoke` calls only
  work inside the desktop app, not a plain browser.
- Frontend production build check: `npm run build`.
- Rust type/build check: `cargo build` (or `cargo check`) run from `src-tauri/`.
- There is no configured linter or automated test suite in this repo.

### Non-obvious caveats (important)
- **Rust toolchain:** the backend depends (transitively, via `toml_datetime`) on
  crates requiring `edition2024`, so it needs a recent stable Rust (≈1.85+). The
  cloud VM's default toolchain has been set to `stable` via rustup; if a build
  fails with "feature `edition2024` is required", run `rustup default stable`.
- **macOS-targeted code runs degraded on Linux (expected):** `sys::speak` shells out
  to macOS `say`, `sys::run_shell` uses `zsh`, and `sys::get_system_metrics` reads the
  macOS path `/System/Volumes/Data` for disk stats. On Linux these specific features
  error or report `0` for disk, but the app still runs and CPU/RAM metrics are correct.
- `libEGL ... DRI3` warnings at startup are harmless (software rendering fallback).
- **Chat needs an LLM backend:** sending a message calls Ollama
  (`http://127.0.0.1:11434`), LM Studio, or Gemini (needs `GEMINI_API_KEY`). With none
  running, the message is still saved to SQLite but you get an expected
  "Ollama unreachable" / "Gemini API key not configured" error banner.
- SQLite DB lives at the OS data dir (`~/.local/share/Xoras/xoras.db` on Linux). It is
  created on first launch; projects/conversations/messages persist across restarts.

### Repo notes
- The root also contains `cdp_*.py` and `speech.txt` — browser-automation scripts
  unrelated to building/running the Xoras app. They are not part of the app and are
  not needed (or run) for development.
