import { useApp } from "../context/AppContext";
import { NAV_ITEMS } from "../lib/constants";
import { api } from "../lib/api";

// ─── SVG Icons ───
const icons = {
  grid: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  message: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  terminal: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  folder: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  cpu: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>,
  database: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  settings: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  plus: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  msgplus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>,
};

const Icon = ({ name }) => {
  const Comp = icons[name];
  return Comp ? <Comp /> : null;
};

export default function Sidebar() {
  const {
    state, dispatch,
    selectConversation, selectProject,
    newConversation, newProject,
    refreshConversations,
  } = useApp();
  const { view, conversations, activeConversationId, activeProjectId, projects, settings, modelStatus } = state;

  const inProgress = conversations.filter(c => c.status === "in_progress");
  const recent = conversations.filter(c => c.status !== "in_progress").slice(0, 20);
  const activeProject = projects.find(p => p.id === activeProjectId);
  const ollamaOnline = modelStatus?.ollama_online;

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="xoras-logo">
          <div className="xoras-logo-icon">X</div>
          <div>
            <div className="xoras-logo-text">XORAS</div>
          </div>
          <span className="xoras-logo-tag">OS v2</span>
        </div>
      </div>

      {/* Nav */}
      <div className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${view === item.id ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_VIEW", payload: item.id })}
          >
            <Icon name={item.icon} />
            {item.label}
            {item.id === "dojo" && state.dojoErrors?.filter(e => e.status !== "archived").length > 0 && (
              <span className="nav-badge">{state.dojoErrors.filter(e => e.status !== "archived").length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Conversations */}
      <div className="sidebar-section">
        {/* Projects */}
        <div className="section-label">
          Projects
          <button onClick={async () => {
            const name = window.prompt("Project name", "New Project");
            if (name?.trim()) await newProject(name.trim());
          }} title="New project"><Icon name="plus" /></button>
        </div>
        {projects.map(p => (
          <button
            key={p.id}
            className={`conv-item ${p.id === activeProjectId ? "active" : ""}`}
            onClick={() => selectProject(p.id)}
          >
            <div className="conv-title">{p.name}</div>
          </button>
        ))}

        {/* Conversations */}
        {activeProject && (
          <>
            <div className="section-label" style={{ marginTop: 12 }}>
              Conversations
              <button onClick={newConversation} title="New conversation"><Icon name="plus" /></button>
            </div>

            {inProgress.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 8px 2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Active</div>
                {inProgress.map(conv => (
                  <button
                    key={conv.id}
                    className={`conv-item ${conv.id === activeConversationId ? "active" : ""}`}
                    onClick={() => { selectConversation(conv.id); dispatch({ type: "SET_VIEW", payload: "chat" }); }}
                  >
                    <div className="conv-title">
                      <span className="conv-status-dot active" />
                      {conv.title}
                    </div>
                    <div className="conv-subtitle">{conv.model?.split("::")[1] || ""}</div>
                  </button>
                ))}
              </>
            )}

            {recent.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 8px 2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Recent</div>
                {recent.map(conv => (
                  <button
                    key={conv.id}
                    className={`conv-item ${conv.id === activeConversationId ? "active" : ""}`}
                    onClick={() => { selectConversation(conv.id); dispatch({ type: "SET_VIEW", payload: "chat" }); }}
                  >
                    <div className="conv-title">
                      <span className="conv-status-dot idle" />
                      {conv.title}
                    </div>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-pill">
          <div className="user-avatar">{(settings.username || "X")[0].toUpperCase()}</div>
          <div>
            <div className="user-name">{settings.username || "Xoras User"}</div>
            <div style={{ fontSize: 10, color: ollamaOnline ? "var(--green)" : "var(--text-muted)" }}>
              {ollamaOnline ? "● Ollama online" : "○ Ollama offline"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
