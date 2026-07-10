// ============================================================
// src/data/tasksStore.js
// In-memory tasks store — the single source of truth for the Tasks page.
//
// STUDY NOTE — why this file exists:
//   The task list used to be hardcoded inside views/pages/task.ejs, so the
//   sidebar "Views" and the "New Task" button could not change anything.
//   Moving the data here lets the server:
//     1. filter tasks by the selected view  -> Views work
//     2. add a task and re-render the page   -> New Task works
//
//   Each task has ONE status, and that status is also the name of the
//   sidebar view it belongs to:
//       "active" | "in_progress" | "upcoming" | "completed"
//   The extra view "all" is NOT a status — it just means "every task".
//
//   This is a plain Map in memory, so tasks reset when the server
//   restarts. A later phase can swap it for MongoDB (like notesStore did)
//   without touching the routes or the template, as long as these
//   functions keep the same names and return shapes.
// ============================================================

// The five sidebar views, in display order.
//   key   -> matches the ?view= value in the URL and (for real views)
//            a task's status.
//   label -> the text the user sees.
const VIEWS = [
  { key: "active",      label: "Active" },
  { key: "in_progress", label: "In Progress" },
  { key: "upcoming",    label: "Upcoming" },
  { key: "all",         label: "All Tasks" },
  { key: "completed",   label: "Completed" },
];

let sequence = 0;
const tasks = new Map();

// Generate a simple unique id like "t1", "t2", ...
function nextId() {
  sequence += 1;
  return "t" + sequence;
}

// ---------- Seed a few demo tasks so every view has content ----------
(function seed() {
  const drafts = [
    { title: "Finish DevOps CA2 report",   due: "Today",     priority: "high",   status: "active",
      description: "Polish the study dashboard, finalise the report, and prepare the hand-in summary.",
      notes: "Focus on the deployment checklist and include the validation results." },
    { title: "Review React → EJS mapping", due: "Tomorrow",  priority: "medium", status: "active",
      description: "Revisit the component architecture and map each UI concept to the server-rendered shell.",
      notes: "Keep a short reference table for future implementation notes." },
    { title: "Wire up MongoDB for notes",  due: "Today",     priority: "medium", status: "in_progress",
      description: "Connect the notes store to butlerdb and verify persistence in Compass.",
      notes: "Confirm documents appear in the butlernotes collection." },
    { title: "Build the tasks views",      due: "Today",     priority: "high",   status: "in_progress",
      description: "Make the sidebar views filter the list and the New Task button create tasks.",
      notes: "The server reads ?view= and returns the matching tasks." },
    { title: "Push initial commit",        due: "This week", priority: "low",    status: "upcoming",
      description: "Package the current milestone and share the progress update with the team.",
      notes: "Include the task and calendar panel updates in the summary." },
    { title: "Plan calendar sync",         due: "Next week", priority: "low",    status: "upcoming",
      description: "Sketch how calendar events will connect to tasks and notes.",
      notes: "Draft the data shape first." },
    { title: "Read Butler style.css",      due: "Done",      priority: "low",    status: "completed",
      description: "Review the shared styling system for later UI improvements.",
      notes: "Captured the key spacing tokens that are already in place." },
    { title: "Set up Docker compose",      due: "Done",      priority: "medium", status: "completed",
      description: "Add the app + mongo services so the stack runs with one command.",
      notes: "MONGO_URI points the app at butlerdb." },
  ];
  drafts.forEach((d) => {
    const id = nextId();
    tasks.set(id, Object.assign({ id }, d));
  });
})();

// ---------- Public API ----------

// Return the tasks for a view.
//   "all" -> every task
//   any other view -> only tasks whose status matches the view key.
function listTasks(view) {
  const all = [...tasks.values()];
  if (view === "all") return all;
  return all.filter((task) => task.status === view);
}

// Count how many tasks fall under each view (used for the sidebar badges).
function getCounts() {
  const all = [...tasks.values()];
  return {
    active:      all.filter((t) => t.status === "active").length,
    in_progress: all.filter((t) => t.status === "in_progress").length,
    upcoming:    all.filter((t) => t.status === "upcoming").length,
    completed:   all.filter((t) => t.status === "completed").length,
    all:         all.length,
  };
}

// Create a new task. New tasks start in the "active" view.
function createTask(input = {}) {
  const id = nextId();
  const task = {
    id,
    title: (input.title || "").trim() || "Untitled task",
    due: input.due || "No date",
    priority: input.priority || "medium",
    status: "active",
    description: input.description || "",
    notes: input.notes || "",
  };
  tasks.set(id, task);
  return task;
}

// Look up a view's label from its key (falls back to "Active").
function viewLabel(view) {
  const found = VIEWS.find((v) => v.key === view);
  return found ? found.label : "Active";
}

// Guard the ?view= query: is this a view we actually know about?
function isValidView(view) {
  return VIEWS.some((v) => v.key === view);
}

module.exports = { VIEWS, listTasks, getCounts, createTask, viewLabel, isValidView };
