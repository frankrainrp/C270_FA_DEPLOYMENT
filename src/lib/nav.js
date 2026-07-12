// ============================================================
// src/lib/nav.js
// Shared navigation constants.
// Used by both server-side render (layout.ejs, sidebar.ejs) and
// route handlers to keep the four main tabs consistent.
// ============================================================

// The four built-in navigation tabs.
// - id       : stable identifier, matches activeNav in the layout.
// - label    : default English display label (i18n happens in view layer).
// - href     : URL the pill/tab links to.
// - pageFile : which file under views/pages/ to render for this tab.
const NAV_ITEMS = [
  { id: "chat",     label: "Chat",     href: "/chat",     pageFile: "chat" },
  { id: "tasks",    label: "Tasks",    href: "/tasks",    pageFile: "task" },
  { id: "calendar", label: "Calendar", href: "/calendar", pageFile: "calendar" },
  { id: "notes",    label: "Notes",    href: "/notes",    pageFile: "note" },
];

// Default tab order for the top pill nav and the mobile tab bar.
const NAV_DEFAULTS = NAV_ITEMS.map((item) => item.id);

// Whitelist of page partials we are allowed to include from renderLayout.
// Prevents accidental path traversal via a bad `page` local.
const PAGE_WHITELIST = new Set([
  ...NAV_ITEMS.map((item) => item.pageFile),
  "search",
]);

module.exports = {
  NAV_ITEMS,
  NAV_DEFAULTS,
  PAGE_WHITELIST,
};
