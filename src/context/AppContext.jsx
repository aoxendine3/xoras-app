import { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { api, sys } from "../lib/api";

const AppContext = createContext(null);

const initialState = {
  view: "dashboard",
  loading: true,
  error: null,

  // Projects & conversations
  projects: [],
  activeProjectId: null,
  conversations: [],
  activeConversationId: null,

  // Messages
  messages: [],
  streaming: false,
  streamContent: "",

  // Models
  models: [],
  selectedModel: "ollama::llama3",
  modelStatus: { ollama_online: false, lmstudio_online: false, ollama_count: 0, lmstudio_count: 0 },
  openModelSelector: false,

  // Settings
  settings: {},

  // System metrics
  metrics: null,
  metricsLoading: false,

  // Dojo
  dojoErrors: [],

  // Terminal history
  terminalLines: [
    { type: "info", text: "Xoras Terminal — type a command and press Enter" },
  ],
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":      return { ...state, loading: action.payload };
    case "SET_ERROR":        return { ...state, error: action.payload };
    case "SET_VIEW":         return { ...state, view: action.payload };
    case "SET_PROJECTS":     return { ...state, projects: action.payload };
    case "SET_ACTIVE_PROJECT": return { ...state, activeProjectId: action.payload };
    case "SET_CONVERSATIONS": return { ...state, conversations: action.payload };
    case "SET_ACTIVE_CONV":  return { ...state, activeConversationId: action.payload };
    case "SET_MESSAGES":     return { ...state, messages: action.payload };
    case "ADD_MESSAGE":      return { ...state, messages: [...state.messages, action.payload] };
    case "SET_STREAMING":    return { ...state, streaming: action.payload };
    case "APPEND_STREAM":    return { ...state, streamContent: state.streamContent + action.payload };
    case "RESET_STREAM":     return { ...state, streamContent: "" };
    case "SET_MODELS":       return { ...state, models: action.payload.models, modelStatus: action.payload.status };
    case "SET_SELECTED_MODEL": return { ...state, selectedModel: action.payload };
    case "OPEN_MODEL_SELECTOR":  return { ...state, openModelSelector: true };
    case "CLOSE_MODEL_SELECTOR": return { ...state, openModelSelector: false };
    case "SET_SETTINGS":     return { ...state, settings: action.payload };
    case "SET_METRICS":      return { ...state, metrics: action.payload };
    case "SET_DOJO_ERRORS":  return { ...state, dojoErrors: action.payload };
    case "ADD_TERMINAL_LINE": return { ...state, terminalLines: [...state.terminalLines, action.payload] };
    case "CLEAR_TERMINAL":   return { ...state, terminalLines: [] };
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Boot ──
  useEffect(() => {
    (async () => {
      try {
        await api.initApp();
        const [settings, modelsData, projects] = await Promise.all([
          api.getSettings(),
          api.listModels(),
          api.listProjects(),
        ]);
        dispatch({ type: "SET_SETTINGS", payload: settings });
        dispatch({ type: "SET_MODELS", payload: modelsData });
        dispatch({ type: "SET_PROJECTS", payload: projects });

        if (settings.default_model) {
          dispatch({ type: "SET_SELECTED_MODEL", payload: settings.default_model });
        }

        if (projects.length > 0) {
          const pid = projects[0].id;
          dispatch({ type: "SET_ACTIVE_PROJECT", payload: pid });
          const convs = await api.listConversations(pid);
          dispatch({ type: "SET_CONVERSATIONS", payload: convs });
          if (convs.length > 0) {
            dispatch({ type: "SET_ACTIVE_CONV", payload: convs[0].id });
            const msgs = await api.getMessages(convs[0].id);
            dispatch({ type: "SET_MESSAGES", payload: msgs });
          }
        }

        // Load dojo errors
        try {
          const errors = await sys.getDojoErrors();
          dispatch({ type: "SET_DOJO_ERRORS", payload: errors });
        } catch (_) {}

      } catch (e) {
        dispatch({ type: "SET_ERROR", payload: String(e) });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    })();
  }, []);

  // ── Metrics polling ──
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const m = await sys.getMetrics();
        dispatch({ type: "SET_METRICS", payload: m });
      } catch (_) {}
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Actions ──
  const selectProject = useCallback(async (id) => {
    dispatch({ type: "SET_ACTIVE_PROJECT", payload: id });
    dispatch({ type: "SET_ACTIVE_CONV", payload: null });
    dispatch({ type: "SET_MESSAGES", payload: [] });
    const convs = await api.listConversations(id);
    dispatch({ type: "SET_CONVERSATIONS", payload: convs });
    if (convs.length > 0) {
      dispatch({ type: "SET_ACTIVE_CONV", payload: convs[0].id });
      const msgs = await api.getMessages(convs[0].id);
      dispatch({ type: "SET_MESSAGES", payload: msgs });
    }
    dispatch({ type: "SET_VIEW", payload: "chat" });
  }, []);

  const selectConversation = useCallback(async (id) => {
    dispatch({ type: "SET_ACTIVE_CONV", payload: id });
    const msgs = await api.getMessages(id);
    dispatch({ type: "SET_MESSAGES", payload: msgs });
  }, []);

  const newConversation = useCallback(async () => {
    if (!state.activeProjectId) return;
    const conv = await api.createConversation(state.activeProjectId, "New Conversation", state.selectedModel);
    const convs = await api.listConversations(state.activeProjectId);
    dispatch({ type: "SET_CONVERSATIONS", payload: convs });
    dispatch({ type: "SET_ACTIVE_CONV", payload: conv.id });
    dispatch({ type: "SET_MESSAGES", payload: [] });
    dispatch({ type: "SET_VIEW", payload: "chat" });
  }, [state.activeProjectId, state.selectedModel]);

  const newProject = useCallback(async (name) => {
    const project = await api.createProject(name, null);
    const projects = await api.listProjects();
    dispatch({ type: "SET_PROJECTS", payload: projects });
    await selectProject(project.id);
  }, [selectProject]);

  const refreshConversations = useCallback(async (projectId) => {
    const pid = projectId || state.activeProjectId;
    if (!pid) return;
    const convs = await api.listConversations(pid);
    dispatch({ type: "SET_CONVERSATIONS", payload: convs });
  }, [state.activeProjectId]);

  const refreshModels = useCallback(async () => {
    const data = await api.refreshModels();
    dispatch({ type: "SET_MODELS", payload: data });
  }, []);

  const sendMessage = useCallback(async (content) => {
    if (!state.activeConversationId || state.streaming) return;

    const userMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      created_at: Date.now(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: userMsg });
    dispatch({ type: "SET_STREAMING", payload: true });
    dispatch({ type: "RESET_STREAM" });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const response = await api.sendMessage(state.activeConversationId, content, state.selectedModel);
      dispatch({ type: "SET_STREAMING", payload: false });
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        created_at: Date.now(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: assistantMsg });
      // Refresh conversations to update status/title
      await refreshConversations();
    } catch (e) {
      dispatch({ type: "SET_STREAMING", payload: false });
      dispatch({ type: "SET_ERROR", payload: String(e) });
    }
  }, [state.activeConversationId, state.streaming, state.selectedModel, refreshConversations]);

  const runTerminalCommand = useCallback(async (command) => {
    dispatch({ type: "ADD_TERMINAL_LINE", payload: { type: "cmd", text: `$ ${command}` } });
    try {
      const result = await sys.runShell(command);
      if (result.stdout) {
        result.stdout.split("\n").forEach(line => {
          if (line) dispatch({ type: "ADD_TERMINAL_LINE", payload: { type: "out", text: line } });
        });
      }
      if (result.stderr) {
        result.stderr.split("\n").forEach(line => {
          if (line) dispatch({ type: "ADD_TERMINAL_LINE", payload: { type: "err", text: line } });
        });
      }
    } catch (e) {
      dispatch({ type: "ADD_TERMINAL_LINE", payload: { type: "err", text: String(e) } });
    }
  }, []);

  const speak = useCallback(async (text) => {
    try { await sys.speak(text); } catch (_) {}
  }, []);

  const value = {
    state,
    dispatch,
    selectProject,
    selectConversation,
    newConversation,
    newProject,
    refreshConversations,
    refreshModels,
    sendMessage,
    runTerminalCommand,
    speak,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
