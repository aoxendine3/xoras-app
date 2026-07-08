# AGENTS.md

## Cursor Cloud specific instructions

Xoras is a **Tauri 2 desktop app**: a React + Vite frontend (`src/`, `index.html`) and a
Rust backend (`src-tauri/`) that owns SQLite persistence, model routing, and system
monitoring. Standard scripts live in `package.json` (`dev`, `build`, `tauri:dev`,
`tauri:build`) and `README.md` — use those; only the non-obvious caveats are below.

### Services & how to run them
- **Full desktop app (primary):** `npm run tauri:dev`. This runs Vite *and* launches the
  native window, so don't start `npm run dev` separately at the same time.
  - A GUI is required. Use the provided X display: `export DISPLAY=:1`.
  - In this VM's software-rendered WebKit, export `WEBKIT_DISABLE_COMPOSITING_MODE=1`
    (and `LIBGL_ALWAYS_SOFTWARE=1`) before launching, or the window may render blank.
- **Frontend only (no Rust backend):** `npm run dev` serves on `http://localhost:1420`.
  Note: every data/system feature goes through Tauri `invoke`, which does **not** exist in a
  plain browser — a browser tab will render the shell but projects/chat/metrics stay empty.
  Real functionality must be tested through the native `tauri:dev` window.
- **Builds:** frontend `npm run build`; backend `cargo build` (run in `src-tauri/`).
  `tauri:build` bundles a `.dmg`/`.app` and is macOS-only — do not expect it to work here.

### Toolchain
- Requires **Rust stable ≥ 1.85** (deps use edition 2024). The default toolchain is already
  set to `stable`; `cargo build` in `src-tauri/` fetches crates on first run (~1 min).

### Local LLM (Ollama) — needed for live chat
- Chat routes to Ollama/LM Studio/Gemini. For local testing, Ollama is installed but there is
  **no systemd** here, so start it manually: `ollama serve` (leave it running), then
  `ollama pull llama3.2:1b`.
- **Gotcha:** the stock `llama-server` picks an AMX / AVX512-BF16 CPU variant that
  **segfaults** under this VM. The higher-ISA ggml variants have been moved to
  `/usr/local/lib/ollama/_disabled/` so it falls back to the stable AVX2 (`haswell`) path. If
  Ollama ever segfaults on model load again, verify those variants are still disabled.
- In the app's chat **model pill**, select the exact pulled tag (e.g. `llama3.2:1b`). The
  default `ollama::llama3.2` in settings won't match a `:1b` pull and will error.
- **Keep Ollama at its default single slot on CPU.** Do NOT raise `OLLAMA_NUM_PARALLEL`
  here — on this CPU-only VM it splits threads/context across slots and makes each
  generation many times slower, which can time out the Council synthesizer. The Council
  runs its personas sequentially for exactly this reason.

### Persona Council (chat feature)
- Chat has a **Council** toggle. When on, `deliberate` runs every enabled persona in turn
  (each emits a `council-voice` Tauri event), then a synthesizer funnels them into one
  answer. Personas are DB rows (table `personas`, seeded on first `init_app`) and are
  managed in **Settings → Persona Council**. With the small local model a full council
  takes ~30-120s; be patient and send only once.

### Data & conventions
- App data + SQLite DB live at `~/.local/share/Xoras/xoras.db` (created/seeded on first
  `init_app`, which also inserts a default "Xoras" project + conversation).
- There is **no automated test suite** and **no lint config** in this repo; "checking" means
  `npm run build` + `cargo build` + a manual run of `tauri:dev`.
- The backend was originally macOS-only (`df /System/Volumes/Data`, `say`, `zsh`); system
  metrics/shell/TTS are now cross-platform, so the app runs on Linux.
