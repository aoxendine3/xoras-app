import { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { SLASH_COMMANDS } from "../lib/constants";

const UsersIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// ── Icons (inline SVG for zero-dep) ──
const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const MicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default function ChatInput({ onSend, disabled, models, selectedModel, onModelChange, onRefreshModels, localOnly, modelStatus, onSlashCommand, openModelSelector, onModelSelectorOpened }) {
  const { state, setCouncilMode } = useApp();
  const councilMode = state.councilMode;
  const enabledPersonas = state.personas.filter(p => p.enabled).length;
  const [value, setValue] = useState("");
  const [showSlash, setShowSlash] = useState(false);
  const [filteredCmds, setFilteredCmds] = useState(SLASH_COMMANDS);
  const [recording, setRecording] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // Open model selector externally
  useEffect(() => {
    if (openModelSelector) {
      setShowModels(true);
      onModelSelectorOpened?.();
    }
  }, [openModelSelector, onModelSelectorOpened]);

  // Slash command filter
  useEffect(() => {
    if (value.startsWith("/")) {
      const q = value.slice(1).toLowerCase();
      setFilteredCmds(SLASH_COMMANDS.filter(c => c.id.includes(q) || c.label.toLowerCase().includes(q)));
      setShowSlash(true);
    } else {
      setShowSlash(false);
    }
  }, [value]);

  const autoResize = (el) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleInput = (e) => {
    setValue(e.target.value);
    autoResize(e.target);
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    if (trimmed.startsWith("/")) {
      const cmd = trimmed.slice(1).split(" ")[0].toLowerCase();
      onSlashCommand?.(cmd, trimmed);
      setValue("");
      setShowSlash(false);
      return;
    }
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === "Escape") { setShowSlash(false); setShowModels(false); }
  };

  // ── Voice Input ──
  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setValue(prev => prev ? `${prev} ${transcript}` : transcript);
      if (textareaRef.current) autoResize(textareaRef.current);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  const currentModel = models?.find(m => m.id === selectedModel);
  const modelLabel = currentModel?.name || selectedModel?.split("::")[1] || "Select Model";
  const ollamaOk = modelStatus?.ollama_online;
  const lmOk = modelStatus?.lmstudio_online;

  return (
    <div className="chat-input-area" style={{ position: "relative" }}>
      {/* Slash popup */}
      {showSlash && filteredCmds.length > 0 && (
        <div className="slash-popup">
          {filteredCmds.map(cmd => (
            <button key={cmd.id} className="slash-item" onClick={() => { onSlashCommand?.(cmd.id, `/${cmd.id}`); setValue(""); setShowSlash(false); }}>
              <span className="slash-cmd">/{cmd.id}</span>
              <span className="slash-desc">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Model dropdown */}
      {showModels && (
        <div className="slash-popup" style={{ maxHeight: 280, overflowY: "auto" }}>
          <div style={{ padding: "8px 16px 6px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Models</span>
            <span style={{ color: ollamaOk ? "var(--green)" : "var(--red)", fontWeight: 700 }}>Ollama {ollamaOk ? "●" : "○"}</span>
          </div>
          {(models || []).map(m => (
            <button key={m.id} className="slash-item" style={{ borderBottom: "1px solid var(--border)" }}
              onClick={() => { onModelChange(m.id); setShowModels(false); }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`model-provider ${m.provider}`}>{m.provider}</span>
                <span className="slash-cmd" style={{ color: selectedModel === m.id ? "var(--accent)" : "var(--text-primary)" }}>{m.name}</span>
                {m.size && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{m.size}</span>}
              </div>
            </button>
          ))}
          <button className="slash-item" onClick={() => { onRefreshModels?.(); }}
            style={{ color: "var(--text-muted)", fontSize: 12, justifyContent: "center" }}>
            ↻ Refresh models
          </button>
        </div>
      )}

      <div className="chat-input-box">
        <div className="chat-input-main">
          <button className="icon-btn" title="Attach context"><PlusIcon /></button>
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            rows={1}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask anything — @ to mention, / for commands"
          />
          <button
            className={`icon-btn${recording ? " recording" : ""}`}
            title={recording ? "Stop recording" : "Voice input"}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
          >
            <MicIcon />
          </button>
          <button className="send-btn" onClick={submit} disabled={disabled || !value.trim()} title="Send">
            <SendIcon />
          </button>
        </div>

        <div className="chat-input-actions">
          <button className="model-pill" onClick={() => setShowModels(v => !v)}>
            <span className="model-dot" style={{ background: ollamaOk || lmOk ? "var(--green)" : "var(--red)" }} />
            {modelLabel}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            className="model-pill"
            onClick={() => setCouncilMode(!councilMode)}
            title="Council mode: every persona deliberates in parallel, then a synthesizer funnels them into one answer"
            style={{
              borderColor: councilMode ? "var(--accent-2)" : "var(--border)",
              color: councilMode ? "var(--accent-2)" : "var(--text-secondary)",
            }}
          >
            <UsersIcon />
            Council {councilMode ? `· ${enabledPersonas}` : "off"}
          </button>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
            {councilMode
              ? `${enabledPersonas} minds deliberate, then funnel to one`
              : "Enter to send · Shift+Enter for newline · Hold mic for voice"}
          </span>
        </div>
      </div>
    </div>
  );
}
