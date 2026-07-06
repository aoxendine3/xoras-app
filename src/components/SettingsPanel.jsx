import { useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";

export default function SettingsPanel() {
  const { state, dispatch, refreshModels, togglePersona } = useApp();
  const { settings, personas } = state;
  const [form, setForm] = useState({
    username: settings.username || "",
    gemini_api_key: settings.gemini_api_key || "",
    ollama_url: settings.ollama_url || "http://127.0.0.1:11434",
    lmstudio_url: settings.lmstudio_url || "http://127.0.0.1:1234",
    default_model: settings.default_model || "ollama::llama3",
    local_only: settings.local_only || false,
    theme: settings.theme || "dark",
  });
  const [saved, setSaved] = useState("");

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const save = async () => {
    try {
      await api.saveSettings(form);
      dispatch({ type: "SET_SETTINGS", payload: form });
      await refreshModels();
      setSaved("✓ Saved");
      setTimeout(() => setSaved(""), 3000);
    } catch (e) {
      setSaved(`✗ ${String(e)}`);
    }
  };

  return (
    <div className="panel-content">
      <div className="settings-view">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Settings</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Configure Xoras identity, model endpoints, and API keys.
          </p>
        </div>

        <hr className="xdivider" />

        {/* Identity */}
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ color: "var(--accent)" }}>◈</span>
            <span className="section-card-title">Identity</span>
          </div>
          <div className="section-card-body">
            <div className="settings-group">
              <div className="settings-field">
                <label className="field-label">Display Name</label>
                <input className="field-input" value={form.username}
                  onChange={e => update("username", e.target.value)}
                  placeholder="Your name" />
              </div>
            </div>
          </div>
        </div>

        {/* Model Endpoints */}
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ color: "var(--green)" }}>⬡</span>
            <span className="section-card-title">Model Endpoints</span>
          </div>
          <div className="section-card-body">
            <div className="settings-group">
              <div className="settings-field">
                <label className="field-label">Ollama URL</label>
                <input className="field-input field-input-mono" value={form.ollama_url}
                  onChange={e => update("ollama_url", e.target.value)} />
              </div>
              <div className="settings-field">
                <label className="field-label">LM Studio URL</label>
                <input className="field-input field-input-mono" value={form.lmstudio_url}
                  onChange={e => update("lmstudio_url", e.target.value)} />
              </div>
              <div className="settings-field">
                <label className="field-label">Default Model ID</label>
                <input className="field-input field-input-mono" value={form.default_model}
                  onChange={e => update("default_model", e.target.value)}
                  placeholder="ollama::llama3" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="local_only" checked={form.local_only}
                  onChange={e => update("local_only", e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer" }} />
                <label htmlFor="local_only" className="field-label" style={{ cursor: "pointer" }}>
                  Local only mode (disable cloud models)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ color: "var(--accent-2)" }}>🔑</span>
            <span className="section-card-title">API Keys</span>
          </div>
          <div className="section-card-body">
            <div className="settings-group">
              <div className="settings-field">
                <label className="field-label">Gemini API Key</label>
                <input className="field-input field-input-mono" type="password"
                  value={form.gemini_api_key}
                  onChange={e => update("gemini_api_key", e.target.value)}
                  placeholder="AIza…" />
              </div>
            </div>
          </div>
        </div>

        {/* Persona Council */}
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ color: "var(--accent-2)" }}>◈</span>
            <span className="section-card-title">Persona Council</span>
            <span className="tag green" style={{ marginLeft: "auto" }}>
              {personas.filter(p => p.enabled).length}/{personas.length} active
            </span>
          </div>
          <div className="section-card-body">
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
              In Council mode, each enabled persona reasons from its own perspective, then a
              synthesizer funnels them into one answer. Toggle who sits at the table.
            </p>
            {personas.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No personas seeded yet.</div>
            )}
            {personas.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={e => togglePersona(p.id, e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: "var(--accent-2)", cursor: "pointer", marginTop: 3 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {p.name} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>— {p.title}</span>
                    <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text-muted)" }}>temp {p.temperature}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {p.system_prompt.length > 160 ? p.system_prompt.slice(0, 160) + "…" : p.system_prompt}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="save-btn" onClick={save}>Save Settings</button>
          {saved && (
            <span style={{
              fontSize: 13,
              color: saved.startsWith("✓") ? "var(--green)" : "var(--red)"
            }}>
              {saved}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
