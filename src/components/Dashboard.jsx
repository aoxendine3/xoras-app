import { useApp } from "../context/AppContext";

function MetricCard({ label, value, unit, sub, percent, color = "accent", icon }) {
  const clampedPct = Math.min(100, Math.max(0, percent || 0));
  const colorClass = percent > 85 ? "red" : percent > 65 ? "yellow" : color;

  return (
    <div className="metric-card">
      <div className="metric-label">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className={`metric-value ${colorClass}`}>
        {value}<span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>{unit}</span>
      </div>
      {percent !== undefined && (
        <div className="metric-bar-track">
          <div className={`metric-bar-fill ${colorClass}`} style={{ width: `${clampedPct}%` }} />
        </div>
      )}
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { state, dispatch, newConversation, speak } = useApp();
  const { metrics, metricsLoading, dojoErrors, modelStatus, models, conversations } = state;

  const recentErrors = dojoErrors?.slice(0, 5) || [];
  const openErrors = dojoErrors?.filter(e => e.status !== "archived").length || 0;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="panel-content">
      <div className="dashboard">
        {/* Greeting */}
        <div className="dashboard-greeting">
          <h1>{greeting}, Maxx.</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            {conversations.filter(c => c.status === "in_progress").length} active session
            {conversations.filter(c => c.status === "in_progress").length !== 1 ? "s" : ""} ·{" "}
            {models.length} model{models.length !== 1 ? "s" : ""} available ·{" "}
            <span style={{ color: modelStatus?.ollama_online ? "var(--green)" : "var(--red)" }}>
              Ollama {modelStatus?.ollama_online ? "online" : "offline"}
            </span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button className="quick-btn primary" onClick={() => { newConversation(); dispatch({ type: "SET_VIEW", payload: "chat" }); }}>
            + New Chat
          </button>
          <button className="quick-btn" onClick={() => dispatch({ type: "SET_VIEW", payload: "terminal" })}>
            ⌗ Terminal
          </button>
          <button className="quick-btn" onClick={() => dispatch({ type: "SET_VIEW", payload: "files" })}>
            ⊞ Files
          </button>
          <button className="quick-btn" onClick={() => dispatch({ type: "SET_VIEW", payload: "system" })}>
            ⬡ System
          </button>
          <button className="quick-btn" onClick={() => dispatch({ type: "SET_VIEW", payload: "dojo" })}>
            ◈ Omni-Dojo {openErrors > 0 && <span className="tag red" style={{ marginLeft: 4 }}>{openErrors}</span>}
          </button>
          <button className="quick-btn" onClick={() => speak("Dashboard loaded. All systems nominal.")}>
            ♪ Speak
          </button>
        </div>

        {/* System Metrics */}
        <div>
          <div className="section-label" style={{ padding: "0 0 10px" }}>System Metrics</div>
          {metrics ? (
            <div className="metrics-grid">
              <MetricCard
                label="CPU"
                icon="⬡"
                value={metrics.cpu_usage.toFixed(1)}
                unit="%"
                percent={metrics.cpu_usage}
                sub="All cores"
              />
              <MetricCard
                label="RAM"
                icon="▣"
                value={metrics.ram_used_gb.toFixed(1)}
                unit="GB"
                percent={metrics.ram_percent}
                sub={`${metrics.ram_total_gb.toFixed(0)} GB total`}
              />
              <MetricCard
                label="Disk Used"
                icon="◫"
                value={metrics.disk_used_gb.toFixed(0)}
                unit="GB"
                percent={metrics.disk_percent}
                sub={`${metrics.disk_available_gb.toFixed(1)} GB free`}
              />
              <MetricCard
                label="Disk Total"
                icon="◫"
                value={metrics.disk_total_gb.toFixed(0)}
                unit="GB"
                color="green"
                sub={`${metrics.disk_percent.toFixed(1)}% used`}
              />
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>
              {metricsLoading ? "Loading metrics…" : "Metrics unavailable"}
            </div>
          )}
        </div>

        {/* Models */}
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ color: "var(--accent)", fontSize: 13 }}>◈</span>
            <span className="section-card-title">Models</span>
            <span className="tag green" style={{ marginLeft: "auto" }}>
              {models.length} loaded
            </span>
          </div>
          <div className="section-card-body">
            {models.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>No models detected. Is Ollama running?</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {models.map(m => (
                  <div key={m.id} className="model-row">
                    <span className={`model-provider ${m.provider}`}>{m.provider}</span>
                    <span className="model-name">{m.name}</span>
                    {m.size && <span className="model-size">{m.size}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Omni-Dojo Feed */}
        <div className="section-card">
          <div className="section-card-header">
            <span style={{ color: "var(--accent-2)", fontSize: 13 }}>◈</span>
            <span className="section-card-title">Omni-Dojo — Recent Errors</span>
            {openErrors > 0 && <span className="tag red" style={{ marginLeft: "auto" }}>{openErrors} open</span>}
            <button
              className="quick-btn"
              style={{ marginLeft: openErrors > 0 ? 8 : "auto", padding: "2px 10px", fontSize: 11 }}
              onClick={() => dispatch({ type: "SET_VIEW", payload: "dojo" })}
            >
              View all →
            </button>
          </div>
          <div className="section-card-body">
            {recentErrors.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--green)", padding: "8px 0" }}>✓ No recent errors</div>
            ) : (
              recentErrors.map(err => (
                <div key={err.id} className="error-row">
                  <div className="error-header">
                    <span className={`error-badge ${err.status === "archived" ? "archived" : "open"}`}>
                      {err.status}
                    </span>
                    <span className="error-type">{err.exception_type}</span>
                    <span className="error-time">{err.timestamp?.slice(0, 16) || ""}</span>
                  </div>
                  <div className="error-msg">{err.error_message?.slice(0, 120)}{err.error_message?.length > 120 ? "…" : ""}</div>
                  {err.healing_action && (
                    <div className="error-heal">↳ {err.healing_action}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
