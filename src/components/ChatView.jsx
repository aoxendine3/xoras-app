import { useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import ChatInput from "./ChatInput";
import { SLASH_COMMANDS } from "../lib/constants";
import { api } from "../lib/api";

// Inline markdown renderer (no deps)
function renderMarkdown(text) {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang}">${escapeHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^#{3} (.+)$/gm, "<h3>$1</h3>")
    .replace(/^#{2} (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul]|<pre)(.+)$/gm, "$1");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function MessageBubble({ message, streaming }) {
  const isUser = message.role === "user";
  return (
    <div className="message-bubble">
      <div className={`message-role ${isUser ? "user" : "assistant"}`}>
        <span className={`message-role-dot ${isUser ? "user" : "assistant"}`} />
        {isUser ? "You" : "Maxx"}
      </div>
      {isUser ? (
        <div className="message-content user">{message.content}</div>
      ) : (
        <div
          className="message-content"
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(message.content || "") + (streaming ? '<span class="streaming-cursor"></span>' : ""),
          }}
        />
      )}
    </div>
  );
}

// ── Council deliberation panel: shows each persona's voice, then the funnel ──
function CouncilPanel({ council }) {
  const { roster, voices, synthesizing } = council;
  const pending = Math.max(0, (roster?.length || 0) - (voices?.length || 0));

  return (
    <div style={{
      border: "1px solid rgba(122,162,255,0.25)",
      background: "rgba(122,162,255,0.05)",
      borderRadius: "var(--r-md)",
      padding: "12px 14px",
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-2)" }}>
          ◈ Council convening
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {roster?.length || 0} minds · {voices?.length || 0} spoken{pending > 0 ? ` · ${pending} thinking…` : ""}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: voices?.length ? 12 : 0 }}>
        {(roster || []).map((p, i) => {
          const done = voices?.some(v => v.name === p.name);
          return (
            <span key={i} style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 999,
              border: "1px solid var(--border)",
              color: done ? "var(--text-primary)" : "var(--text-muted)",
              background: done ? "rgba(122,162,255,0.12)" : "transparent",
            }}>
              {done ? "●" : "○"} {p.name}
            </span>
          );
        })}
      </div>

      {(voices || []).map((v, i) => (
        <div key={i} style={{ padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: v.ok ? "var(--accent)" : "var(--red)" }}>
            {v.name} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>— {v.title}</span>
          </div>
          <div style={{ fontSize: 13, color: v.ok ? "var(--text-secondary)" : "var(--text-muted)", marginTop: 2, fontStyle: v.ok ? "normal" : "italic" }}>
            {v.content}
          </div>
        </div>
      ))}

      {synthesizing && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, color: "var(--accent-2)", fontSize: 12, fontWeight: 600 }}>
          <span>▼ Funneling {voices?.length || 0} perspectives into one…</span>
          <div className="loading-dots"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div>
        </div>
      )}
    </div>
  );
}

// ── Sparkles icon ──
const SparklesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
    <path d="M19 3L19.75 5.25L22 6L19.75 6.75L19 9L18.25 6.75L16 6L18.25 5.25L19 3Z" />
  </svg>
);

export default function ChatView() {
  const {
    state,
    sendMessage,
    newConversation,
    newProject,
    dispatch,
    refreshConversations,
    refreshModels,
    speak,
  } = useApp();

  const {
    messages, streaming, streamContent,
    activeConversationId, activeProjectId,
    models, modelStatus, selectedModel, settings,
    error, projects, openModelSelector,
    councilMode, council,
  } = state;

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent, streaming]);

  const handleSlashCommand = async (cmd) => {
    switch (cmd) {
      case "new":
        await newConversation();
        break;
      case "clear":
        if (activeConversationId) {
          await api.clearMessages(activeConversationId);
          dispatch({ type: "SET_MESSAGES", payload: [] });
        }
        break;
      case "model":
        dispatch({ type: "OPEN_MODEL_SELECTOR" });
        break;
      case "speak": {
        const last = [...messages].reverse().find(m => m.role === "assistant");
        if (last) await speak(last.content);
        break;
      }
      case "rename": {
        const title = window.prompt("Conversation title");
        if (title?.trim() && activeConversationId) {
          await api.renameConversation(activeConversationId, title.trim());
          await refreshConversations(activeProjectId);
        }
        break;
      }
      case "export": {
        const md = messages.map(m => `**${m.role}**: ${m.content}`).join("\n\n");
        const blob = new Blob([md], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "xoras-chat.md"; a.click();
        URL.revokeObjectURL(url);
        break;
      }
      case "help":
        dispatch({
          type: "ADD_MESSAGE",
          payload: {
            id: crypto.randomUUID(),
            role: "assistant",
            content: SLASH_COMMANDS.map(c => `- \`/${c.id}\` — ${c.description}`).join("\n"),
            created_at: Date.now(),
          },
        });
        break;
      default:
        break;
    }
  };

  // ── No project selected ──
  if (!activeProjectId) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><SparklesIcon /></div>
        <h2>Welcome to Xoras</h2>
        <p>Your AI command center. Create a project to begin.</p>
        <button className="save-btn" onClick={async () => {
          const name = window.prompt("Project name", "My Project");
          if (name?.trim()) await newProject(name.trim());
        }}>
          Create First Project
        </button>
      </div>
    );
  }

  // ── No conversation selected ──
  if (!activeConversationId) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><SparklesIcon /></div>
        <h2>{projects.find(p => p.id === activeProjectId)?.name || "Project"}</h2>
        <p>Start your first conversation with Maxx.</p>
        <button className="save-btn" onClick={newConversation}>New Conversation</button>
      </div>
    );
  }

  return (
    <div className="chat-view">
      <div ref={scrollRef} className="chat-messages panel-content">
        <div className="chat-messages-inner">
          {messages.length === 0 && !streaming && (
            <div className="empty-state" style={{ height: "auto", padding: "60px 0" }}>
              <div className="empty-icon"><SparklesIcon /></div>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Maxx is ready. Type a message or hold the mic to speak.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Council deliberation (funnel of personas) */}
          {(council.active || council.voices.length > 0) && (
            <CouncilPanel council={council} />
          )}

          {/* Single-voice streaming (only when not in council mode) */}
          {!councilMode && streaming && (
            <MessageBubble
              message={{ role: "assistant", content: streamContent }}
              streaming
            />
          )}

          {!councilMode && streaming && !streamContent && (
            <div className="message-bubble">
              <div className="message-role assistant">
                <span className="message-role-dot assistant" />
                Maxx
              </div>
              <div className="loading-dots" style={{ paddingTop: 4 }}>
                <div className="loading-dot" />
                <div className="loading-dot" />
                <div className="loading-dot" />
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: "var(--red-dim)", border: "1px solid rgba(255,69,96,0.3)",
              borderRadius: "var(--r-md)", padding: "10px 14px",
              fontSize: 13, color: "var(--red)",
            }}>
              {error}
            </div>
          )}
        </div>
      </div>

      <ChatInput
        onSend={sendMessage}
        disabled={streaming}
        models={models}
        selectedModel={selectedModel}
        onModelChange={(id) => dispatch({ type: "SET_SELECTED_MODEL", payload: id })}
        onRefreshModels={refreshModels}
        localOnly={Boolean(settings.local_only)}
        modelStatus={modelStatus}
        openModelSelector={openModelSelector}
        onModelSelectorOpened={() => dispatch({ type: "CLOSE_MODEL_SELECTOR" })}
        onSlashCommand={handleSlashCommand}
      />
    </div>
  );
}
