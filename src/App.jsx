import { AppProvider, useApp } from "./context/AppContext";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import Dashboard from "./components/Dashboard";
import TerminalPanel from "./components/TerminalPanel";
import FileExplorer from "./components/FileExplorer";
import SystemPanel from "./components/SystemPanel";
import DojoPanel from "./components/DojoPanel";
import SettingsPanel from "./components/SettingsPanel";
import "./index.css";

// Panel title map
const PANEL_TITLES = {
  dashboard: "Command Center",
  chat:      "Chat",
  terminal:  "Terminal",
  files:     "File Explorer",
  system:    "System & Models",
  dojo:      "Omni-Dojo",
  settings:  "Settings",
};

function TopBar() {
  const { state } = useApp();
  const { view, modelStatus, metrics, settings } = state;
  const ollamaOnline = modelStatus?.ollama_online;
  const showOllamaAlert = settings?.show_ollama_alert !== false;

  return (
    <div className="topbar">
      <span className="topbar-title">{PANEL_TITLES[view] || view}</span>
      <div className="topbar-spacer" />

      {metrics && (
        <div className="status-indicator" title="CPU / RAM">
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
            CPU {metrics.cpu_usage.toFixed(0)}%
          </span>
          <span style={{ color: "var(--border)" }}>|</span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
            RAM {metrics.ram_used_gb.toFixed(1)}GB
          </span>
        </div>
      )}

      {showOllamaAlert && (
        <div className="status-indicator">
          <span className={`status-dot ${ollamaOnline ? "online" : "offline"}`} />
          <span style={{ fontSize: 11 }}>
            {ollamaOnline ? "Ollama" : "Ollama offline"}
          </span>
        </div>
      )}
    </div>
  );
}

function MainPanel() {
  const { state } = useApp();
  const { view, loading } = state;

  if (loading) {
    return (
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "var(--r-md)",
            background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#fff",
          }}>X</div>
        </div>
        <div className="loading-dots">
          <div className="loading-dot" />
          <div className="loading-dot" />
          <div className="loading-dot" />
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
          Initializing Xoras OS…
        </p>
      </div>
    );
  }

  switch (view) {
    case "dashboard": return <Dashboard />;
    case "chat":      return <ChatView />;
    case "terminal":  return <TerminalPanel />;
    case "files":     return <FileExplorer />;
    case "system":    return <SystemPanel />;
    case "dojo":      return <DojoPanel />;
    case "settings":  return <SettingsPanel />;
    default:          return <Dashboard />;
  }
}

function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <TopBar />
        <MainPanel />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
