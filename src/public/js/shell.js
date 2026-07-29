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
(function initAppearanceSync() {
  var VALID = { paper: true, retro: true, dark: true };
  var VALID_BUTTON_COLORS = { forest: true, ocean: true, plum: true, clay: true };
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

  function applySavedButtonColor() {
    try {
      var saved = localStorage.getItem("butler-button-color");
      if (saved && VALID_BUTTON_COLORS[saved]) {
        document.documentElement.setAttribute("data-button-color", saved);
      } else {
        document.documentElement.removeAttribute("data-button-color");
      }
    } catch (_) { /* ignore */ }
  }

  function applySavedAppearance() {
    applySavedTheme();
    applySavedButtonColor();
  }

  // Fires on fresh load AND when the page is restored from bfcache.
  window.addEventListener("pageshow", applySavedAppearance);

  // Fires when any other tab writes to localStorage.
  window.addEventListener("storage", function (event) {
    if (event.key === "butler-theme") applySavedTheme();
    if (event.key === "butler-button-color") applySavedButtonColor();
  });
})();

// ---------- Layout DOM wiring ----------
(function initShell() {
  var userRoot = document.querySelector("[data-user-menu]");
  var userTrigger = document.querySelector("[data-user-menu-trigger]");
  var userPanel = document.querySelector("[data-user-menu-panel]");
  var miniAppsTrigger = document.querySelector("[data-action='toggle-mini-apps']");
  var miniAppsPanel = document.querySelector("[data-mini-apps-panel]");
  var closeMiniAppsButton = document.querySelector("[data-close-mini-apps]");
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

  function closeMiniApps() {
    if (!miniAppsPanel || !miniAppsTrigger) return;
    miniAppsPanel.hidden = true;
    miniAppsTrigger.setAttribute("aria-pressed", "false");
  }

  function openMiniApps() {
    if (!miniAppsPanel || !miniAppsTrigger) return;
    miniAppsPanel.hidden = false;
    miniAppsTrigger.setAttribute("aria-pressed", "true");
    loadLearningTools();
  }

  function setActiveMiniAppTab(tabName) {
    var tabButtons = miniAppsPanel.querySelectorAll(".mini-app-tab");
    var panels = miniAppsPanel.querySelectorAll("[data-panel]");
    tabButtons.forEach(function (button) {
      var active = button.dataset.tab === tabName;
      button.classList.toggle("mini-app-tab-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== tabName;
    });
  }

  function formatTimer(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return mins.toString().padStart(2, "0") + ":" + secs.toString().padStart(2, "0");
  }

  var timerState = {
    duration: 25 * 60,
    remaining: 25 * 60,
    interval: null,
    activePreset: 25,
  };

  // ---------- Custom duration ----------
  var CUSTOM_MIN = 1;
  var CUSTOM_MAX = 180;

  function setCustomFocusTimerDuration(rawValue) {
    var parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) return;
    var clamped = Math.min(Math.max(parsed, CUSTOM_MIN), CUSTOM_MAX);
    var input = miniAppsPanel.querySelector("[data-custom-duration]");
    if (input) input.value = clamped;
    setFocusTimerDuration(clamped);
  }

  function updateFocusTimerDisplay() {
    var timeEl = miniAppsPanel.querySelector(".focus-timer-time");
    var stateEl = miniAppsPanel.querySelector(".focus-timer-state");
    if (!timeEl || !stateEl) return;
    timeEl.textContent = formatTimer(timerState.remaining);
    stateEl.textContent = timerState.interval ? "Focus session active" : "Ready to begin";
  }

  function setFocusTimerDuration(minutes) {
    timerState.activePreset = minutes;
    timerState.duration = minutes * 60;
    timerState.remaining = timerState.duration;
    updateFocusTimerDisplay();
  }

  function startFocusTimer() {
    var playButton = miniAppsPanel.querySelector(".focus-timer-play");
    if (!playButton) return;
    if (timerState.interval) {
      clearInterval(timerState.interval);
      timerState.interval = null;
      playButton.textContent = "Start";
      updateFocusTimerDisplay();
      return;
    }

    playButton.textContent = "Pause";
    timerState.interval = setInterval(function () {
      timerState.remaining -= 1;
      if (timerState.remaining <= 0) {
        clearInterval(timerState.interval);
        timerState.interval = null;
        timerState.remaining = 0;
        playButton.textContent = "Start";
      }
      updateFocusTimerDisplay();
    }, 1000);
  }

  function resetFocusTimer() {
    clearInterval(timerState.interval);
    timerState.interval = null;
    setFocusTimerDuration(timerState.activePreset);
    var playButton = miniAppsPanel.querySelector(".focus-timer-play");
    if (playButton) playButton.textContent = "Start";
  }

  function renderWeeklyTrend(completedTasks) {
  var weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var now = new Date();
  var currentDayOfWeek = now.getDay(); // 0 = Sunday ... 6 = Saturday

  // Find this week's Sunday (go back to the most recent Sunday).
  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - currentDayOfWeek);
  weekStart.setHours(0, 0, 0, 0, 0);

  var days = [];
  for (var i = 0; i <= 6; i += 1) {
    var day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push({
      label: weekdayNames[i],
      date: day,
      count: 0,
    });
  }

  completedTasks.forEach(function (task) {
    var dateValue = task.updatedAt || task.createdAt;
    var completedDate = dateValue ? new Date(dateValue) : null;
    if (!completedDate || !task.completed) return;
    completedDate.setHours(0, 0, 0, 0, 0);
    days.forEach(function (day) {
      if (completedDate.getTime() === day.date.getTime()) day.count += 1;
    });
  });

  var total = days.reduce(function (sum, item) { return sum + item.count; }, 0);
  miniAppsPanel.querySelector("[data-weekly-total]").textContent = total + " completed";
  var bars = miniAppsPanel.querySelector("[data-weekly-bars]");
  if (!bars) return;
  bars.innerHTML = "";
  var maxCount = Math.max(1, total, days.reduce(function (max, item) { return Math.max(max, item.count); }, 0));
  days.forEach(function (day) {
    var bar = document.createElement("div");
    bar.className = "weekly-bar";
    var height = total === 0 ? 50 : Math.round((day.count / maxCount) * 100);
    var visibleHeight = day.count === 0 ? 40 : Math.max(height, 30);
    if (day.count === 0) {
      bar.classList.add("weekly-bar-empty");
    }
    var countLabel = total === 0 ? "–" : day.count;
    bar.innerHTML = "<span>" + countLabel + "</span>";
    bar.style.height = visibleHeight + "%";
    bar.title = day.label + ": " + day.count;
    bar.appendChild(document.createElement("span"));
    bars.appendChild(bar);
  });

  var note = miniAppsPanel.querySelector("[data-weekly-note]");
  if (note) {
    note.textContent = total === 0 ? "No completed tasks yet, start adding tasks to see your trend." : "";
  }

  var labels = miniAppsPanel.querySelector("[data-weekly-labels]");
  if (!labels) return;
  labels.innerHTML = "";
  days.forEach(function (day) {
    var label = document.createElement("div");
    label.className = "weekly-label";
    label.textContent = day.label.slice(0, 3);
    labels.appendChild(label);
  });
}

  // ---------- Multi-week completion trend ----------
  function renderMultiWeekTrend(weeklyStats) {
    var bars = miniAppsPanel.querySelector("[data-multiweek-bars]");
    var labels = miniAppsPanel.querySelector("[data-multiweek-labels]");
    var note = miniAppsPanel.querySelector("[data-multiweek-note]");
    var totalEl = miniAppsPanel.querySelector("[data-multiweek-total]");
    if (!bars || !labels || !Array.isArray(weeklyStats)) return;

    var total = weeklyStats.reduce(function (sum, w) { return sum + w.count; }, 0);
    if (totalEl) totalEl.textContent = total + " completed";

    bars.innerHTML = "";
    labels.innerHTML = "";
    var maxCount = Math.max(1, weeklyStats.reduce(function (max, w) { return Math.max(max, w.count); }, 0));

    weeklyStats.forEach(function (week) {
      var bar = document.createElement("div");
      bar.className = "weekly-bar";
      var height = total === 0 ? 50 : Math.round((week.count / maxCount) * 100);
      var visibleHeight = week.count === 0 ? 40 : Math.max(height, 30);
      if (week.count === 0) bar.classList.add("weekly-bar-empty");
      var countLabel = total === 0 ? "–" : week.count;
      bar.innerHTML = "<span>" + countLabel + "</span>";
      bar.style.height = visibleHeight + "%";
      bar.title = week.label + ": " + week.count;
      bars.appendChild(bar);

      var label = document.createElement("div");
      label.className = "weekly-label";
      label.textContent = week.label;
      labels.appendChild(label);
    });

    if (note) {
      note.textContent = total === 0 ? "No completions in this window yet." : "";
    }
  }

  // ---------- Trend direction indicator (new) ----------
  function renderTrendIndicator(trend) {
    var el = miniAppsPanel.querySelector("[data-trend-indicator]");
    if (!el || !trend) return;

    if (trend.previousWeekCount === 0 && trend.currentWeekCount === 0) {
      el.textContent = "No completions yet this week or last week.";
      el.className = "trend-indicator trend-neutral";
      return;
    }

    if (trend.previousWeekCount === 0) {
      el.textContent = "↑ " + trend.currentWeekCount + " completed this week (no completions last week to compare against)";
      el.className = "trend-indicator trend-up";
      return;
    }

    var arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
    var changeText = trend.percentChange === null ? "" : " (" + (trend.percentChange > 0 ? "+" : "") + trend.percentChange + "%)";
    var comparisonWord = trend.direction === "up" ? "more" : trend.direction === "down" ? "fewer" : "the same as";

    el.textContent = arrow + " " + trend.currentWeekCount + " completed this week — " + comparisonWord + " than last week" + changeText;
    el.className = "trend-indicator trend-" + trend.direction;
  }

  function renderTagDistribution(tasks) {
    var tagCounts = {};
    tasks.forEach(function (task) {
      var text = (task.title || "") + " " + (task.description || "");
      var matches = text.match(/#([A-Za-z0-9_-]+)/g) || [];
      matches.forEach(function (tag) {
        var normalized = tag.toLowerCase();
        tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
      });
    });
    var list = miniAppsPanel.querySelector("[data-tag-list]");
    if (!list) return;
    list.innerHTML = "";
    var entries = Object.entries(tagCounts).sort(function (a, b) { return b[1] - a[1]; });
    if (entries.length === 0) {
      list.innerHTML = "<span class='tag-empty'>No tags yet. Add #tags to tasks to see distribution here.</span>";
      return;
    }
    entries.forEach(function (entry) {
      var item = document.createElement("span");
      item.className = "tag-pill";
      item.textContent = entry[0] + " (" + entry[1] + ")";
      list.appendChild(item);
    });
  }

  function updateShareCard(stats) {
    var titleDate = miniAppsPanel.querySelector("[data-share-date]");
    var summary = miniAppsPanel.querySelector("[data-share-summary]");
    var shareText = miniAppsPanel.querySelector("[data-share-text]");
    var completed = miniAppsPanel.querySelector("[data-share-completed]");
    var active = miniAppsPanel.querySelector("[data-share-active]");
    var upcoming = miniAppsPanel.querySelector("[data-share-upcoming]");
    if (!titleDate || !summary || !shareText || !completed || !active || !upcoming) return;
    var now = new Date();
    titleDate.textContent = now.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    completed.textContent = stats.completed;
    active.textContent = stats.active;
    upcoming.textContent = stats.upcoming;
    var text = "Butler progress update:\nCompleted " + stats.completed + " tasks, " + stats.active + " in progress, " + stats.upcoming + " upcoming, and " + stats.overdue + " overdue. Completion rate: " + stats.completionRate + "%. Keep the study momentum going!";
    summary.textContent = "Today I have completed " + stats.completed + " tasks and I’m working on " + stats.active + " more.";
    shareText.value = text;
  }

  async function loadLearningTools() {
    if (!window.ButlerApi || !miniAppsPanel) return;

    try {
      var statsResponse = await window.ButlerApi.get("/tasks/stats");
      var stats = statsResponse.stats; // unwrap, matches makeOk({ stats }) shape

      var weeklyResponse = await window.ButlerApi.get("/tasks/weekly-stats?weeks=6");
      var weeklyData = weeklyResponse.weeklyStats || { weeks: [], trend: null };

      var allTasks = await window.ButlerApi.get("/tasks?view=all");
      var completedTasks = Array.isArray(allTasks.tasks) ? allTasks.tasks.filter(function (task) { return task.completed; }) : [];

      miniAppsPanel.querySelector("[data-stat-completed]").textContent = stats.completed;
      miniAppsPanel.querySelector("[data-stat-active]").textContent = stats.active;
      miniAppsPanel.querySelector("[data-stat-upcoming]").textContent = stats.upcoming;

      var overdueEl = miniAppsPanel.querySelector("[data-stat-overdue]");
      if (overdueEl) overdueEl.textContent = stats.overdue;

      var rateEl = miniAppsPanel.querySelector("[data-stat-completion-rate]");
      if (rateEl) rateEl.textContent = stats.completionRate + "%";

      renderWeeklyTrend(completedTasks);
      renderMultiWeekTrend(weeklyData.weeks);
      renderTrendIndicator(weeklyData.trend);
      renderTagDistribution(Array.isArray(allTasks.tasks) ? allTasks.tasks : []);
      updateShareCard(stats);
    } catch (err) {
      console.error("Learning tools load failed:", err);
    }
  }

  function copyShareText() {
    var shareText = miniAppsPanel.querySelector("[data-share-text]");
    if (!shareText) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareText.value);
    } else {
      shareText.select();
      document.execCommand("copy");
    }
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

  if (miniAppsTrigger) {
    miniAppsTrigger.addEventListener("click", function (event) {
      event.stopPropagation();
      if (miniAppsPanel && miniAppsPanel.hidden) openMiniApps();
      else closeMiniApps();
    });
  }

  if (miniAppsPanel) {
    miniAppsPanel.addEventListener("click", function (event) {
      var tabButton = event.target.closest(".mini-app-tab");
      if (tabButton) {
        setActiveMiniAppTab(tabButton.dataset.tab);
        if (tabButton.dataset.tab === "stats" || tabButton.dataset.tab === "share") {
          loadLearningTools();
        }
        return;
      }

      if (event.target.matches("[data-preset]")) {
        setFocusTimerDuration(Number(event.target.dataset.preset));
        return;
      }

      if (event.target.matches("[data-custom-set]")) {
        var customInput = miniAppsPanel.querySelector("[data-custom-duration]");
        if (customInput) setCustomFocusTimerDuration(customInput.value);
        return;
      }

      if (event.target.matches(".focus-timer-play")) {
        startFocusTimer();
        return;
      }

      if (event.target.matches(".focus-timer-reset")) {
        resetFocusTimer();
        return;
      }

      if (event.target.matches("[data-share-copy]")) {
        copyShareText();
        return;
      }
    });

    miniAppsPanel.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && event.target.matches("[data-custom-duration]")) {
        setCustomFocusTimerDuration(event.target.value);
      }
    });
  }

  if (closeMiniAppsButton) {
    closeMiniAppsButton.addEventListener("click", function () {
      closeMiniApps();
    });
  }

  document.addEventListener("click", function (event) {
    if (userRoot && !userRoot.contains(event.target)) closeUserMenu();
    if (miniAppsPanel && !miniAppsPanel.hidden && miniAppsTrigger && !miniAppsTrigger.contains(event.target) && !miniAppsPanel.contains(event.target)) {
      closeMiniApps();
    }
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
    if (drawerEl) {
      drawerEl.classList.remove("is-open");
      drawerEl.removeAttribute("aria-hidden");
    }
  }

  function openTaskDrawer(event) {
    var card = event.currentTarget;
    var drawerEl = document.getElementById("task-detail-drawer");

    if (!drawerEl || !card) return;

    document.getElementById("task-detail-title").textContent = card.getAttribute("data-title") || "Untitled";
    document.getElementById("task-detail-priority").textContent = "Priority: " + (card.getAttribute("data-priority") || "medium");
    document.getElementById("task-detail-due").textContent = card.getAttribute("data-due") || "No due date";
    document.getElementById("task-detail-description").textContent = card.getAttribute("data-description") || "No description.";
    document.getElementById("task-detail-notes").textContent = card.getAttribute("data-notes") || "No notes yet.";
    drawerEl.classList.add("is-open");
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
