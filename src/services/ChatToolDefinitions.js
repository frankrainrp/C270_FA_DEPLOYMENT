// ============================================================
// src/services/ChatToolDefinitions.js
// OpenAI-style tool schemas sent to the chat model.
//
// The model can request any of these tools; the actual execution
// happens in the browser (public/js/tool-executor.js), which then
// posts results back on the next round.  This keeps business
// state fully on the client during the chat loop.
//
// The set here is a minimal subset of the C270_FA tool list, enough
// to drive tasks and notes.  More tools (panels, recurring, …) can
// be added in later phases.
// ============================================================

const CHAT_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_item",
      description: "Create a new task or deadline for the user.",
      parameters: {
        type: "object",
        properties: {
          title:       { type: "string",  description: "Short human-readable task title." },
          dueDate:     { type: "string",  description: "ISO date (YYYY-MM-DD) when the task is due." },
          priority:    { type: "string",  enum: ["low", "medium", "high"], description: "Task priority." },
          description: { type: "string",  description: "Optional longer description or notes." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_item",
      description: "Update an existing task's fields.",
      parameters: {
        type: "object",
        properties: {
          id:          { type: "string" },
          title:       { type: "string" },
          dueDate:     { type: "string" },
          priority:    { type: "string", enum: ["low", "medium", "high"] },
          description: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_item",
      description: "Delete a task by id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_complete",
      description: "Toggle a task's completed state.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_items",
      description: "List current tasks. Read-only.",
      parameters: {
        type: "object",
        properties: {
          view: { type: "string", enum: ["all", "active", "completed", "upcoming"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a markdown note.",
      parameters: {
        type: "object",
        properties: {
          title:   { type: "string" },
          content: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "List all notes. Read-only.",
      parameters: { type: "object", properties: {} },
    },
  },
];

module.exports = { CHAT_TOOLS };
