import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { sys } from "../lib/api";

const HOME = "/Users/ajoxendine68";

export default function TerminalPanel() {
  const { state, dispatch, runTerminalCommand } = useApp();
  const { terminalLines } = state;
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [cwd, setCwd] = useState(HOME);
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalLines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const run = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    setHistory(h => [cmd, ...h]);
    setHistIdx(-1);
    setInput("");

    // Handle cd locally
    if (cmd.startsWith("cd ")) {
      const target = cmd.slice(3).trim().replace("~", HOME);
      const resolved = target.startsWith("/") ? target : `${cwd}/${target}`;
      try {
        // Test if dir exists
        await sys.listDir(resolved);
        setCwd(resolved);
        dispatch({ type: "ADD_TERMINAL_LINE", payload: { type: "cmd", text: `$ cd ${target}` } });
        dispatch({ type: "ADD_TERMINAL_LINE", payload: { type: "info", text: `→ ${resolved}` } });
      } catch {
        dispatch({ type: "ADD_TERMINAL_LINE", payload: { type: "cmd", text: `$ ${cmd}` } });
        dispatch({ type: "ADD_TERMINAL_LINE", payload: { type: "err", text: `cd: no such directory: ${target}` } });
      }
      return;
    }

    if (cmd === "clear" || cmd === "cls") {
      dispatch({ type: "CLEAR_TERMINAL" });
      return;
    }

    // Run in current working directory
    await runTerminalCommand(`cd ${cwd} && ${cmd}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { run(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] || "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? "" : history[idx]);
    }
  };

  return (
    <div className="terminal-view">
      <div className="terminal-topbar">
        <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 12, fontFamily: "var(--font-mono)" }}>
          XORAS TERMINAL
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)", marginLeft: 8 }}>
          {cwd.replace(HOME, "~")}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => dispatch({ type: "CLEAR_TERMINAL" })}
            style={{
              background: "none", border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
              color: "var(--text-muted)", fontSize: 11, padding: "2px 10px", cursor: "pointer",
              fontFamily: "var(--font-mono)"
            }}
          >
            clear
          </button>
        </div>
      </div>

      <div className="terminal-output" ref={outputRef} onClick={() => inputRef.current?.focus()}>
        {terminalLines.map((line, i) => (
          <div key={i} className={`terminal-line ${line.type}`}>{line.text}</div>
        ))}
      </div>

      <div className="terminal-input-row">
        <span className="terminal-prompt">
          {cwd.replace(HOME, "~")} <span style={{ color: "var(--green)" }}>$</span>
        </span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="enter command…"
        />
      </div>
    </div>
  );
}
