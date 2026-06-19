import { useApp } from "../context/AppContext";
import { sys } from "../lib/api";

export default function DojoPanel() {
  const { state, dispatch } = useApp();
  const { dojoErrors } = state;

  const refreshErrors = async () => {
    try {
      const errors = await sys.getDojoErrors();
      dispatch({ type: "SET_DOJO_ERRORS", payload: errors });
    } catch (e) {
      console.error("Dojo refresh failed:", e);
    }
  };

  const open = dojoErrors?.filter(e => e.status !== "archived") || [];
  const archived = dojoErrors?.filter(e => e.status === "archived") || [];

  return (
    <div className="panel-content">
      <div className="dojo-view">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s4)" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Omni-Dojo</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              Global Catalyst Error Intelligence — live feed from <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>global_catalyst.db</code>
            </p>
          </div>
          <button className="quick-btn" style={{ marginLeft: "auto" }} onClick={refreshErrors}>
            ↻ Refresh
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "var(--s4)" }}>
          {[
            { label: "Total Logged",  val: dojoErrors?.length || 0,  color: "var(--text-primary)" },
            { label: "Open",          val: open.length,               color: "var(--red)" },
            { label: "Archived",      val: archived.length,           color: "var(--green)" },
          ].map(s => (
            <div key={s.label} className="metric-card" style={{ flex: 1, padding: "12px 16px" }}>
              <div className="metric-label">{s.label}</div>
              <div className="metric-value" style={{ fontSize: 24, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Open Errors */}
        {open.length > 0 && (
          <div className="section-card">
            <div className="section-card-header">
              <span className="tag red">Open</span>
              <span className="section-card-title" style={{ marginLeft: 4 }}>{open.length} Unresolved</span>
            </div>
            <div className="section-card-body" style={{ padding: "0 var(--s5)" }}>
              {open.map(err => <ErrorRow key={err.id} err={err} />)}
            </div>
          </div>
        )}

        {/* Archived */}
        {archived.length > 0 && (
          <div className="section-card">
            <div className="section-card-header">
              <span className="tag green">Archived</span>
              <span className="section-card-title" style={{ marginLeft: 4 }}>{archived.length} Resolved</span>
            </div>
            <div className="section-card-body" style={{ padding: "0 var(--s5)" }}>
              {archived.map(err => <ErrorRow key={err.id} err={err} />)}
            </div>
          </div>
        )}

        {dojoErrors?.length === 0 && (
          <div style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)",
            padding: "32px", textAlign: "center", color: "var(--green)", fontSize: 14
          }}>
            ✓ No errors recorded in the Dojo database.
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorRow({ err }) {
  const isOpen = err.status !== "archived";
  return (
    <div className="error-row">
      <div className="error-header">
        <span className={`error-badge ${isOpen ? "open" : "archived"}`}>{err.status}</span>
        <span className="error-type">{err.exception_type}</span>
        <span className="error-time">{err.timestamp?.slice(0, 16) || ""}</span>
      </div>
      <div className="error-msg">{err.error_message}</div>
      {err.healing_action && (
        <div className="error-heal">↳ {err.healing_action}</div>
      )}
    </div>
  );
}
