import { invoke } from "@tauri-apps/api/core";

/* ─── DB / Chat ─── */
export const api = {
  initApp: () => invoke("init_app"),
  getSettings: () => invoke("get_settings"),
  saveSettings: (s) => invoke("save_settings", { settings: s }),

  listProjects: () => invoke("list_projects"),
  createProject: (name, path) => invoke("create_project", { name, path: path || null }),
  deleteProject: (id) => invoke("delete_project", { id }),

  listConversations: (projectId) => invoke("list_conversations", { projectId }),
  createConversation: (projectId, title, model) => invoke("create_conversation", { projectId, title, model: model || null }),
  deleteConversation: (id) => invoke("delete_conversation", { id }),
  renameConversation: (id, title) => invoke("rename_conversation", { id, title }),

  getMessages: (conversationId) => invoke("get_messages", { conversationId }),
  clearMessages: (conversationId) => invoke("clear_messages", { conversationId }),

  listModels: () => invoke("list_models"),
  refreshModels: () => invoke("refresh_models"),

  sendMessage: (conversationId, content, model) => invoke("send_message", { conversationId, content, model }),

  /* ─── Persona Council ─── */
  listPersonas: () => invoke("list_personas"),
  createPersona: (name, title, systemPrompt, model, temperature) =>
    invoke("create_persona", { name, title, systemPrompt, model: model || null, temperature: temperature ?? null }),
  updatePersona: (id, { name, title, systemPrompt, model, temperature, enabled }) =>
    invoke("update_persona", { id, name, title, systemPrompt, model: model || null, temperature, enabled }),
  setPersonaEnabled: (id, enabled) => invoke("set_persona_enabled", { id, enabled }),
  deletePersona: (id) => invoke("delete_persona", { id }),
  deliberate: (conversationId, content, model) => invoke("deliberate", { conversationId, content, model }),
};

/* ─── System ─── */
export const sys = {
  getMetrics: () => invoke("get_system_metrics"),
  speak: (text) => invoke("speak", { text }),
  runShell: (command) => invoke("run_shell", { command }),
  readFile: (path) => invoke("read_file", { path }),
  writeFile: (path, content) => invoke("write_file", { path, content }),
  listDir: (path) => invoke("list_dir", { path }),
  getDojoErrors: () => invoke("get_dojo_errors"),
};
