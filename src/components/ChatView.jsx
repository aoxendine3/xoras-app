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

          {streaming && (
            <MessageBubble
              message={{ role: "assistant", content: streamContent }}
              streaming
            />
          )}

          {streaming && !streamContent && (
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
