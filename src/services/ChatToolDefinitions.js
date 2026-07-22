// ============================================================
// src/services/ChatToolDefinitions.js
// OpenAI-style tool schemas sent to the chat model.
//
// The model can request any of these tools; the actual execution
// happens in the browser (public/js/tool-executor.js), which calls
// the REST API under /api/tasks, /api/notes, /api/calendar.  The
// REST layer talks to MongoDB via Mongoose services.
//
// Naming convention:
//   task_*  -> Task CRUD
//   note_*  -> Note CRUD
//   event_* -> CalendarEvent CRUD
//
// Every id field is the MongoDB _id string.  The context summary
// injected into the system prompt lists current ids so the model
// can update / delete existing records.
// ============================================================

const CHAT_TOOLS = [
  // ---------- TASKS ----------
  {
    type: "function",
    function: {
      name: "task_create",
      description: "Create a new task in MongoDB. Use when the user asks to add a task, todo, deadline, or reminder.",
      parameters: {
        type: "object",
        properties: {
          title:       { type: "string",  description: "Short task title." },
          dueDate:     { type: "string",  description: "ISO date or datetime (YYYY-MM-DD or full ISO)." },
          priority:    { type: "string",  enum: ["low", "medium", "high"], description: "Task priority." },
          description: { type: "string",  description: "Optional longer description." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_update",
      description: "Update fields of an existing task. Requires the MongoDB _id from the context snapshot.",
      parameters: {
        type: "object",
        properties: {
          id:          { type: "string" },
          title:       { type: "string" },
          dueDate:     { type: "string" },
          priority:    { type: "string", enum: ["low", "medium", "high"] },
          status:      { type: "string", enum: ["active", "in_progress", "completed"] },
          description: { type: "string" },
          completed:   { type: "boolean" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_delete",
      description: "Delete a task by MongoDB _id.",
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
      name: "task_toggle",
      description: "Toggle a task's completed flag by MongoDB _id.",
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
      name: "task_list",
      description: "List tasks. Read-only.",
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
      name: "task_summary",
      description: "Return deterministic task progress metrics and top priorities. Use for task summaries, completion rate, overdue work, weekly progress, workload, or what to do next. Read-only.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "integer",
            minimum: 1,
            maximum: 30,
            description: "Upcoming-task window in days. Defaults to 7.",
          },
        },
      },
    },
  },

  // ---------- NOTES ----------
  {
    type: "function",
    function: {
      name: "note_create",
      description: "Create a markdown note in MongoDB.",
      parameters: {
        type: "object",
        properties: {
          title:   { type: "string" },
          content: { type: "string", description: "Markdown body." },
          tags:    { type: "array",  items: { type: "string" } },
          pinned:  { type: "boolean" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "note_update",
      description: "Update fields of an existing note.",
      parameters: {
        type: "object",
        properties: {
          id:      { type: "string" },
          title:   { type: "string" },
          content: { type: "string" },
          tags:    { type: "array", items: { type: "string" } },
          pinned:  { type: "boolean" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "note_delete",
      description: "Delete a note by MongoDB _id.",
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
      name: "note_toggle_pin",
      description: "Toggle a note's pinned flag by MongoDB _id.",
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
      name: "note_list",
      description: "List notes. Read-only.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["all", "pinned"] },
        },
      },
    },
  },

  // ---------- CALENDAR ----------
  {
    type: "function",
    function: {
      name: "event_create",
      description: "Create a calendar event in MongoDB. Use for meetings, exams, or dated reminders.",
      parameters: {
        type: "object",
        properties: {
          title:       { type: "string" },
          date:        { type: "string", description: "ISO date or datetime." },
          description: { type: "string" },
          color:       { type: "string", enum: ["red", "orange", "yellow", "green", "blue", "purple", "gray"] },
          tag:         { type: "string" },
          allDay:      { type: "boolean" },
        },
        required: ["title", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "event_update",
      description: "Update a calendar event by MongoDB _id.",
      parameters: {
        type: "object",
        properties: {
          id:          { type: "string" },
          title:       { type: "string" },
          date:        { type: "string" },
          description: { type: "string" },
          color:       { type: "string", enum: ["red", "orange", "yellow", "green", "blue", "purple", "gray"] },
          tag:         { type: "string" },
          allDay:      { type: "boolean" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "event_delete",
      description: "Delete a calendar event by MongoDB _id.",
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
      name: "event_list",
      description: "List calendar events. Read-only.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["all", "upcoming"], description: "'upcoming' returns the next 7 days." },
        },
      },
    },
  },
];

module.exports = { CHAT_TOOLS };
