# Xoras

Your personal agent command center for macOS — Xoras.app 2.0 chat interface, wired to your own projects and models.

## Features

- Friendly user layout: projects sidebar, conversation threads, slash commands
- Streaming chat via **Gemini** (cloud) or **Ollama** (local)
- SQLite persistence for projects, conversations, and messages
- Native macOS app via Tauri 2

## Quick start

```bash
npm install
npm run tauri:dev
```

## Build for macOS

```bash
npm run tauri:build
```

The `.app` and `.dmg` will be in `src-tauri/target/release/bundle/`.

## Settings

Open **Settings** in the sidebar to configure:

- Display name
- Gemini API key (or set `GEMINI_API_KEY` in your environment)
- Ollama URL (default `http://127.0.0.1:11434`)
- Default model

## Slash commands

| Command | Action |
|---------|--------|
| `/new` | New conversation |
| `/clear` | Clear current chat |
| `/rename` | Rename conversation |
| `/export` | Export chat as markdown |
| `/help` | List commands |
