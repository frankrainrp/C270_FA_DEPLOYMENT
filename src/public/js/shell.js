// ============================================================
// public/js/shell.js
// Layout-only interactions: user menu, mobile drawer, escape key.
// Also keeps the theme in sync with the user's saved preference
// across bfcache restores and cross-tab changes.
// No business logic; loaded on every page via layout.ejs.
// ============================================================

// ---------- Theme sync ----------
// The inline <script> in each page <head> already applies the saved
// theme on the very first load (before CSS) to prevent flashing.
// These listeners cover the two cases the inline script cannot:
//   1. Back/forward navigation restored from bfcache — scripts do
//      not re-execute, so the inline script never runs again.
//   2. The user switches the theme in another tab — the current tab
//      would otherwise keep the old theme until reload.
(function initThemeSync() {
  var VALID = { paper: true, retro: true, dark: true };
  // Keeps the mobile browser chrome (address bar tint) in sync
  // with the current theme.  Values match the theme bg colours.
  var META_COLORS = { retro: "#f3eee0", paper: "#eff6f5", dark: "#0a0a0b" };

  function applySavedTheme() {
    try {
      var saved = localStorage.getItem("butler-theme");
      if (saved && VALID[saved]) {
        document.documentElement.setAttribute("data-theme", saved);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta && META_COLORS[saved]) {
          meta.setAttribute("content", META_COLORS[saved]);
        }
      }
    } catch (_) { /* ignore */ }
  }

  // Fires on fresh load AND when the page is restored from bfcache.
  window.addEventListener("pageshow", applySavedTheme);

  // Fires when any other tab writes to localStorage.
  window.addEventListener("storage", function (event) {
    if (event.key === "butler-theme") applySavedTheme();
  });
})();

// ---------- Layout DOM wiring ----------
(function initShell() {
  var userRoot = document.querySelector("[data-user-menu]");
  var userTrigger = document.querySelector("[data-user-menu-trigger]");
  var userPanel = document.querySelector("[data-user-menu-panel]");
  var drawer = document.querySelector("[data-mobile-drawer]");
  var drawerTrigger = document.querySelector("[data-mobile-drawer-trigger]");
  var drawerBackdrop = document.querySelector("[data-mobile-drawer-backdrop]");

  function closeUserMenu() {
    if (!userPanel || !userTrigger) return;
    userPanel.hidden = true;
    userTrigger.setAttribute("aria-expanded", "false");
  }

  function openUserMenu() {
    if (!userPanel || !userTrigger) return;
    userPanel.hidden = false;
    userTrigger.setAttribute("aria-expanded", "true");
  }

  function closeDrawer() {
    if (!drawer || !drawerBackdrop) return;
    drawer.classList.remove("is-open");
    drawerBackdrop.hidden = true;
    document.body.classList.remove("drawer-open");
  }

  function openDrawer() {
    if (!drawer || !drawerBackdrop) return;
    drawer.classList.add("is-open");
    drawerBackdrop.hidden = false;
    document.body.classList.add("drawer-open");
  }

  if (userTrigger) {
    userTrigger.addEventListener("click", function (event) {
      event.stopPropagation();
      if (userPanel && userPanel.hidden) openUserMenu();
      else closeUserMenu();
    });
  }

  document.addEventListener("click", function (event) {
    if (userRoot && !userRoot.contains(event.target)) closeUserMenu();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeUserMenu();
      closeDrawer();
      closeTaskDrawer();
    }
  });

  if (drawerTrigger) drawerTrigger.addEventListener("click", openDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeDrawer);

  function closeTaskDrawer() {
    var drawerEl = document.getElementById("task-detail-drawer");
    if (drawerEl) drawerEl.hidden = true;
  }

  function openTaskDrawer(event) {
    var card = event.currentTarget;
    var drawerEl = document.getElementById("task-detail-drawer");

    if (!drawerEl || !card) return;

    document.getElementById("task-detail-title").textContent = card.getAttribute("data-title");
    document.getElementById("task-detail-priority").textContent = "Priority: " + card.getAttribute("data-priority");
    document.getElementById("task-detail-due").textContent = "Due: " + card.getAttribute("data-due");
    document.getElementById("task-detail-description").textContent = card.getAttribute("data-description");
    document.getElementById("task-detail-notes").textContent = card.getAttribute("data-notes");
    drawerEl.hidden = false;
  }

  document.querySelectorAll(".task-card").forEach(function (card) {
    var trigger = card.querySelector(".task-detail-trigger");
    if (trigger) trigger.addEventListener("click", openTaskDrawer.bind(null, { currentTarget: card }));
  });

  var closeDrawerButton = document.querySelector("[data-close-drawer]");
  if (closeDrawerButton) closeDrawerButton.addEventListener("click", closeTaskDrawer);

  document.querySelectorAll(".calendar-day").forEach(function (button) {
    button.addEventListener("click", function () {
      if (button.disabled) return;
      document.querySelectorAll(".calendar-day").forEach(function (day) {
        day.classList.remove("is-active");
      });
      button.classList.add("is-active");
      var card = document.getElementById("calendar-detail-card");
      if (!card) return;
      document.getElementById("calendar-detail-title").textContent = "Day " + button.getAttribute("data-day");
      document.getElementById("calendar-detail-detail").textContent = button.getAttribute("data-detail");
      document.getElementById("calendar-detail-badge").textContent = button.getAttribute("data-title");
    });
  });

  // Note search only.  Open / save / delete are handled by notes-ui.js
  // against the real MongoDB API — do not wire mock select/save here.
  var noteButtons = document.querySelectorAll(".note-list-item");
  var searchInput = document.getElementById("note-search");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      var query = searchInput.value.trim().toLowerCase();
      noteButtons.forEach(function (button) {
        var text = (
          (button.getAttribute("data-note-title") || "") + " " +
          (button.getAttribute("data-note-preview") || "")
        ).toLowerCase();
        button.style.display = text.indexOf(query) >= 0 ? "" : "none";
      });
    });
  }
})();
