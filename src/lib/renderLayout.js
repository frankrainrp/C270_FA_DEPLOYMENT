// ============================================================
// src/lib/renderLayout.js
// Central helper used by every authenticated app page.
// Populates all shared layout locals (topbar, sidebar rail, theme,
// user profile) so route handlers only need to specify what is new
// for that particular page.
// ============================================================

const { NAV_DEFAULTS, PAGE_WHITELIST } = require("./nav");

// Default authenticated profile used when no session is attached yet.
// Later phases will replace this with a real user from req.user.
const DEFAULT_AUTH_PROFILE = {
  name: "Student User",
  email: "student@example.com",
  imageUrl: "",
};

/**
 * Render the main app layout with a given page partial inside.
 *
 * @param {import('express').Response} res
 * @param {Object} options
 * @param {string}  options.title        - Browser tab title.
 * @param {string}  options.activeNav    - One of chat|tasks|calendar|notes.
 * @param {string}  options.page         - Page file under views/pages/ (no .ejs).
 * @param {Object=} options.rail         - Data forwarded to sidebar.ejs.
 * @param {Object=} options.pageLocals   - Extra locals only for the page partial.
 * @param {Object=} options.authProfile  - Current user profile.
 * @param {string=} options.theme        - paper | dark | retro.
 * @param {string=} options.plan         - free | pro | max.
 * @param {boolean=} options.isLoggedIn  - True only for a real login session.
 */
function renderLayout(res, options) {
  const page = options.page;

  // Reject unknown page names so a bad route cannot include an arbitrary file.
  if (!PAGE_WHITELIST.has(page)) {
    res.status(500).send(`renderLayout: unknown page "${page}"`);
    return;
  }

  res.render("layout", {
    // Core meta
    title: options.title || "Butler",
    // Default to the paper/parchment aesthetic.  The CSS file names
    // this theme "retro" for historical reasons, but visually it is
    // the true paper look: cream bg, minimal blur, handwritten fonts,
    // olive + brass accents.  The theme called "paper" in the CSS is
    // actually an iOS-style glass look and is intentionally not used
    // as the default.
    theme: options.theme || "retro",
    lang: options.lang || "en",

    // Navigation state
    activeNav: options.activeNav || "chat",
    activeCustomPanelId: null,
    tabsOrder: NAV_DEFAULTS,
    hiddenTabs: [],
    customPanels: [],

    // Main content
    page,
    pageLocals: options.pageLocals || {},

    // Sidebar data (shape varies by activeNav; see data/mockRail.js)
    rail: options.rail || {},

    // User + plan for topbar user menu
    authProfile: options.authProfile || DEFAULT_AUTH_PROFILE,
    plan: options.plan || "free",
    planName: options.planName,
    // True only when there's a real login session (not the shared demo
    // profile) — lets page partials personalise things like the chat
    // empty-state greeting without guessing from the name alone.
    isLoggedIn: Boolean(options.isLoggedIn),

    // i18n placeholders (used by layout.ejs / sidebar.ejs)
    labels: options.labels || {},
    searchQuery: options.searchQuery || "",
    miniAppsOpen: false,
  });
}

module.exports = { renderLayout };
