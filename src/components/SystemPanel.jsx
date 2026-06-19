import { useState } from "react";
import { useApp } from "../context/AppContext";
import { sys } from "../lib/api";

export default function SystemPanel() {
  const { state, refreshModels } = useApp();
  const { models, modelStatus, metrics } = state;
  const [pulling, setPulling] = useState(false);
  const [pullName, setPullName] = useState("");
  const [pullMsg, setPullMsg] = useState("");

  const ollamaOnline = modelStatus?.ollama_online;
  const lmOnline = modelStatus?.lmstudio_online;

  const handlePull = async () => {
    if (!pullName.trim()) return;
    setPulling(true);
    setPullMsg("Pulling…");
    try {
      const result = await sys.runShell(`ollama pull ${pullName.trim()}`);
      if (result.exit_code === 0) {
        setPullMsg("✓ Pull complete");
        await refreshModels();
      } else {
        setPullMsg(`✗ ${result.stderr.slice(0, 80)}`);
      }
    } catch (e) {
      setPullMsg(`✗ ${String(e)}`);
    } finally {
      setPulling(false);
      setPullName("");
      setTimeout(() => setPullMsg(""), 4000);
    }
  };

  const handleDelete = async (modelName) => {
    if (!window.confirm(`Delete ${modelName}? This cannot be undone.`)) return;
    try {
      await sys.runShell(`ollama rm ${modelName}`);
      await refreshModels();
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div className="panel-content">
      <div className="system-view">

        {/* Status Row */}
        <div style={{ display: "flex", gap: "var(--s4)" }}>
          {[
            { label: "Ollama", online: ollamaOnline, count: modelStatus?.ollama_count },
            { label: "LM Studio", online: lmOnline, count: modelStatus?.lmstudio_count },
          ].map(s => (
            <div key={s.label} className="metric-card" style={{ flex: 1 }}>
              <div className="metric-label">{s.label}</div>
              <div className="metric-value" style={{ fontSize: 18, color: s.online ? "var(--green)" : "var(--red)" }}>
                {s.online ? "Online" : "Offline"}
              </div>
              <div className="metric-sub">{s.count || 0} model{s.count !== 1 ? "s" : ""} loaded</div>
            </div>
          ))}

          {metrics && (
            <div className="metric-card" style={{ flex: 1 }}>
              <div className="metric-label">Memory</div>
              <div className="metric-value" style={{ fontSize: 18 }}>
                {metrics.ram_used_gb.toFixed(1)}
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}> / {metrics.ram_total_gb.toFixed(0)} GB</span>
              </div>
              <div className="metric-bar-track">
                <div className={`metric-bar-fill ${metrics.ram_percent > 85 ? "red" : metrics.ram_percent > 65 ? "yellow" : "accent"}`}
                  style={{ width: `${Math.min(100, metrics.ram_percent)}%` }} />
              </div>
              <div className="metric-sub">{metrics.ram_percent.toFixed(1)}% used</div>
            </div>
          )}
        </div>

        {/* Model Manager */}
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ color: "var(--accent)" }}>◈</span>
            <span className="section-card-title">Installed Models</span>
            <button
              className="quick-btn"
              style={{ marginLeft: "auto", padding: "2px 10px", fontSize: 11 }}
              onClick={refreshModels}
            >
              ↻ Refresh
            </button>
          </div>
          <div className="section-card-body" style={{ padding: "0 var(--s5)" }}>
            {models.length === 0 ? (
              <div style={{ padding: "16px 0", color: "var(--text-muted)", fontSize: 13 }}>
                No models found. Is Ollama running?
              </div>
            ) : (
              models.map(m => (
                <div key={m.id} className="model-row">
                  <span className={`model-provider ${m.provider}`}>{m.provider}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span className="model-name">{m.name}</span>
                    <span className="model-size">{m.id}</span>
                  </div>
                  {m.size && <span className="model-size" style={{ marginLeft: "auto" }}>{m.size}</span>}
                  {m.provider === "ollama" && (
                    <button
                      onClick={() => handleDelete(m.name)}
                      style={{
                        marginLeft: 8, background: "none", border: "1px solid var(--border)",
                        borderRadius: "var(--r-sm)", color: "var(--red)", fontSize: 11,
                        padding: "2px 8px", cursor: "pointer", fontFamily: "var(--font-mono)"
                      }}
                    >
                      rm
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pull Model */}
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ color: "var(--green)" }}>⬇</span>
            <span className="section-card-title">Pull New Model</span>
          </div>
          <div className="section-card-body">
            <div style={{ display: "flex", gap: "var(--s3)", alignItems: "center" }}>
              <input
                className="field-input field-input-mono"
                placeholder="e.g. llama3:latest, qwen2.5-coder:7b"
                value={pullName}
                onChange={e => setPullName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePull()}
                style={{ flex: 1 }}
                disabled={pulling}
              />
              <button className="save-btn" onClick={handlePull} disabled={pulling || !pullName.trim()}>
                {pulling ? "Pulling…" : "Pull"}
              </button>
            </div>
            {pullMsg && (
              <div style={{
                marginTop: 10, fontSize: 12, fontFamily: "var(--font-mono)",
                color: pullMsg.startsWith("✓") ? "var(--green)" : pullMsg.startsWith("✗") ? "var(--red)" : "var(--text-muted)"
              }}>
                {pullMsg}
              </div>
            )}
          </div>
        </div>

        {/* System Info */}
        {metrics && (
          <div className="section-card">
            <div className="section-card-header">
              <span style={{ color: "var(--accent-2)" }}>⬡</span>
              <span className="section-card-title">Live System</span>
            </div>
            <div className="section-card-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s4)" }}>
                {[
                  { label: "CPU Usage", val: `${metrics.cpu_usage.toFixed(1)}%` },
                  { label: "RAM Used", val: `${metrics.ram_used_gb.toFixed(2)} GB` },
                  { label: "Disk Used", val: `${metrics.disk_used_gb.toFixed(1)} GB` },
                  { label: "Disk Free", val: `${metrics.disk_available_gb.toFixed(1)} GB` },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{row.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{row.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
