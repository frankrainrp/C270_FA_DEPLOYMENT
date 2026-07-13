// ============================================================
// src/data/mockRail.js
// Static sidebar data used during the UI shell phase.
// Later phases will replace this with real DB queries.
//
// The shape returned here must match what partials/sidebar.ejs expects
// for each activeNav branch.
// ============================================================

// Chat rail: a small set of demo sessions so the sidebar is not empty.
function mockChatRail() {
  return {
    sessions: [
      { id: "s-001", title: "Study plan for finals",  updatedAt: Date.now() - 1000 * 60 * 5 },
      { id: "s-002", title: "Refactor Butler layout", updatedAt: Date.now() - 1000 * 60 * 60 * 2 },
      { id: "s-003", title: "Ideas for data panel",   updatedAt: Date.now() - 1000 * 60 * 60 * 24 },
    ],
    activeSessionId: "s-001",
  };
}

// Tasks rail: the /tasks route overrides taskCounts + taskView with real
// values from tasksStore.  These defaults just keep the sidebar sane if
// the rail is ever rendered without that route filling them in.
function mockTasksRail() {
  return {
    taskCounts: {},
    taskView: "active",
  };
}

// Calendar rail: a 5x7 mini month grid + a few tags.
function mockCalendarRail() {
  const today = new Date();
  const cells = [];
  for (let i = 1; i <= 35; i += 1) {
    const day = i;
    const isToday = day === today.getDate();
    cells.push({
      label: String(day),
      date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      active: isToday,
      muted: day > 30,
      hasEvents: day % 6 === 0,
    });
  }

  return {
    miniMonth: cells,
    calendarTags: [
      { label: "Classes",  count: 5, color: "#4a7c99" },
      { label: "Personal", count: 2, color: "#1fa39a" },
      { label: "Deadline", count: 3, color: "#ff9500" },
    ],
  };
}

// Notes rail: library counters + pinned notes.
function mockNotesRail() {
  return {
    noteCounts: { all: 8, pinned: 2, linked: 3 },
    pinnedNotes: [
      { id: "n-01", title: "DevOps CA2 spec" },
      { id: "n-02", title: "React → EJS mapping" },
    ],
  };
}

// Return the correct rail payload for the given nav tab.
function getMockRail(activeNav) {
  switch (activeNav) {
    case "chat":     return mockChatRail();
    case "tasks":    return mockTasksRail();
    case "calendar": return mockCalendarRail();
    case "notes":    return mockNotesRail();
    default:         return {};
  }
}

module.exports = {
  getMockRail,
  mockChatRail,
  mockTasksRail,
  mockCalendarRail,
  mockNotesRail,
};
