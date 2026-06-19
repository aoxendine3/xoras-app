import { useState, useEffect } from "react";
import { sys } from "../lib/api";

const HOME = "/Users/ajoxendine68";

const FileIcon = ({ isDir, name }) => {
  if (isDir) return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
  const ext = name.split(".").pop().toLowerCase();
  const color = { js: "#f7df1e", jsx: "#61dafb", ts: "#3178c6", tsx: "#3178c6", rs: "#ce422b", md: "#a78bfa", py: "#3572a5", css: "#563d7c", json: "#cbcb41" }[ext] || "var(--text-muted)";
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
};

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

export default function FileExplorer() {
  const [path, setPath] = useState(HOME);
  const [entries, setEntries] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const loadDir = async (dirPath) => {
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    setFileContent("");
    try {
      const items = await sys.listDir(dirPath);
      setEntries(items);
      setPath(dirPath);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDir(HOME); }, []);

  const openFile = async (entry) => {
    if (entry.is_dir) { loadDir(entry.path); return; }
    setSelectedFile(entry);
    setEditMode(false);
    setSaveMsg("");
    // Only try to read text files up to 1MB
    if (entry.size && entry.size > 1_048_576) {
      setFileContent(`[File too large to preview: ${formatSize(entry.size)}]`);
      return;
    }
    try {
      const content = await sys.readFile(entry.path);
      setFileContent(content);
      setEditContent(content);
    } catch {
      setFileContent("[Cannot read file — binary or permission denied]");
    }
  };

  const goUp = () => {
    const parent = path.split("/").slice(0, -1).join("/") || "/";
    loadDir(parent);
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    try {
      await sys.writeFile(selectedFile.path, editContent);
      setFileContent(editContent);
      setEditMode(false);
      setSaveMsg("✓ Saved");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveMsg(`✗ ${String(e)}`);
    }
  };

  const breadcrumbs = path.replace(HOME, "~").split("/").filter(Boolean);

  return (
    <div className="file-view">
      {/* Tree */}
      <div className="file-tree">
        {/* Breadcrumb nav */}
        <div style={{ padding: "var(--s2) var(--s3) var(--s1)", fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", borderBottom: "1px solid var(--border)", marginBottom: "var(--s2)" }}>
          <button
            onClick={() => loadDir(HOME)}
            style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11, padding: 0 }}
          >
            ~
          </button>
          {breadcrumbs.slice(1).map((seg, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <span style={{ color: "var(--text-muted)" }}>/</span>
              <button
                onClick={() => {
                  const newPath = HOME + "/" + breadcrumbs.slice(1, i + 2).join("/");
                  loadDir(newPath);
                }}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 11, padding: 0 }}
              >
                {seg}
              </button>
            </span>
          ))}
        </div>

        {path !== HOME && path !== "/" && (
          <button className="file-item" onClick={goUp}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            <span className="file-item-name" style={{ color: "var(--text-muted)" }}>..</span>
          </button>
        )}

        {loading && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 12px" }}>Loading…</div>}
        {error && <div style={{ fontSize: 12, color: "var(--red)", padding: "8px 12px" }}>{error}</div>}

        {entries.map(entry => (
          <button
            key={entry.path}
            className={`file-item ${selectedFile?.path === entry.path ? "active" : ""}`}
            onClick={() => openFile(entry)}
          >
            <FileIcon isDir={entry.is_dir} name={entry.name} />
            <span className="file-item-name">{entry.name}</span>
            {!entry.is_dir && entry.size && (
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)" }}>{formatSize(entry.size)}</span>
            )}
          </button>
        ))}
      </div>

      {/* Preview / Editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {selectedFile ? (
          <>
            {/* File topbar */}
            <div style={{
              padding: "8px 16px", borderBottom: "1px solid var(--border)",
              background: "var(--bg-surface)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0
            }}>
              <span style={{ fontSize: 12.5, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                {selectedFile.name}
              </span>
              {selectedFile.size && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatSize(selectedFile.size)}</span>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {saveMsg && <span style={{ fontSize: 12, color: saveMsg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>{saveMsg}</span>}
                {!editMode ? (
                  <button className="quick-btn" onClick={() => setEditMode(true)} style={{ fontSize: 11 }}>Edit</button>
                ) : (
                  <>
                    <button className="save-btn" onClick={saveFile} style={{ padding: "3px 14px", fontSize: 11 }}>Save</button>
                    <button className="quick-btn" onClick={() => setEditMode(false)} style={{ fontSize: 11 }}>Cancel</button>
                  </>
                )}
              </div>
            </div>
            {editMode ? (
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{
                  flex: 1, resize: "none", background: "var(--bg-base)",
                  color: "var(--text-primary)", border: "none", outline: "none",
                  padding: "var(--s5)", fontFamily: "var(--font-mono)", fontSize: 12.5,
                  lineHeight: 1.7, overflow: "auto"
                }}
              />
            ) : (
              <pre className="file-preview">{fileContent}</pre>
            )}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 13 }}>
            Select a file to preview
          </div>
        )}
      </div>
    </div>
  );
}
