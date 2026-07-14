// ============================================================
// public/js/calendar-ui.js
// Client controller for the /calendar page.
// It reads the active month from the URL, fetches that month's events
// from the API, renders the grid in place, and keeps the modal-based
// new-event flow working without depending on server-rendered month state.
// ============================================================

(function initCalendarUi() {
  var root = document.querySelector("[data-calendar-root]");
  if (!root) return;
  var body = document.body;

  var monthLabel = root.querySelector("[data-calendar-month-label]");
  var eventCount = root.querySelector("[data-calendar-event-count]");
  var chipList = root.querySelector("[data-calendar-selected-chip-list]");
  var grid = root.querySelector("[data-calendar-grid]");
  var detailTitle = root.querySelector("[data-calendar-detail-title]");
  var detailText = root.querySelector("[data-calendar-detail-text]");
  var detailBadge = root.querySelector("[data-calendar-detail-badge]");

  var calendarState = {
    year: null,
    month: null,
    events: [],
    selectedDay: 1,
  };

  function injectStyles() {
    if (document.getElementById("calendar-ui-styles")) return;

    var style = document.createElement("style");
    style.id = "calendar-ui-styles";
    style.textContent = [
      ".calendar-event-modal-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(20,24,28,.45);backdrop-filter:blur(8px);}",
      ".calendar-event-modal{width:min(760px,calc(100vw - 32px));max-height:min(90vh,900px);overflow:auto;border:1px solid var(--glass-border);border-radius:24px;background:var(--color-surface);box-shadow:0 30px 80px rgba(0,0,0,.18);color:var(--color-text);}",
      ".calendar-event-modal-header,.calendar-event-modal-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;}",
      ".calendar-event-modal-header{border-bottom:1px solid var(--color-border-soft);}",
      ".calendar-event-modal-footer{border-top:1px solid var(--color-border-soft);align-items:flex-end;}",
      ".calendar-event-modal-body{display:grid;gap:14px;padding:18px 20px 8px;}",
      ".calendar-event-field{display:grid;gap:6px;}",
      ".calendar-event-field span{font-size:12px;font-weight:700;letter-spacing:.02em;color:var(--color-text-muted);text-transform:uppercase;}",
      ".calendar-event-field input,.calendar-event-field textarea,.calendar-event-field select{width:100%;box-sizing:border-box;border:1px solid var(--color-border-soft);border-radius:14px;background:var(--color-bg);color:var(--color-text);padding:12px 14px;font:inherit;outline:none;}",
      ".calendar-event-field input:focus,.calendar-event-field textarea:focus,.calendar-event-field select:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);}",
      ".calendar-event-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}",
      ".calendar-event-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}",
      ".calendar-month-chip{display:inline-flex;align-items:center;justify-content:center;min-width:38px;padding:8px 12px;border:1px solid var(--color-border-soft);border-radius:999px;background:var(--color-surface);color:var(--color-text-muted);font:inherit;cursor:pointer;}",
      ".calendar-month-chip:hover{border-color:var(--color-primary);color:var(--color-text);}",
      ".calendar-month-chip.is-empty{opacity:.7;cursor:default;}",
      ".calendar-month-chip.is-selected{border-color:var(--color-primary);color:var(--color-text);background:color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));}",
      ".calendar-day.is-selected{border-color:var(--color-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--color-primary) 16%, transparent);}",
      "@media (max-width: 720px){.calendar-event-grid{grid-template-columns:1fr;}.calendar-event-modal-header,.calendar-event-modal-footer{flex-direction:column;align-items:stretch;}.calendar-event-actions{justify-content:stretch;}.calendar-event-actions .glass-btn{width:100%;}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseCursor() {
    var params = new URLSearchParams(window.location.search);
    var now = new Date();
    var year = Number(params.get("year"));
    var month = Number(params.get("month"));

    if (!Number.isInteger(year) || year < 1900 || year > 3000) {
      year = Number(root.getAttribute("data-calendar-year"));
      if (!Number.isInteger(year) || year < 1900 || year > 3000) year = now.getFullYear();
    }
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      month = Number(root.getAttribute("data-calendar-month"));
      if (!Number.isInteger(month) || month < 0 || month > 11) month = now.getMonth();
    }

    return { year: year, month: month };
  }

  function monthKey(year, month) {
    return year + "-" + String(month + 1).padStart(2, "0");
  }

  function monthLabelText(year, month) {
    return new Date(year, month, 1).toLocaleDateString("en", { month: "long", year: "numeric" });
  }

  function formatDateIso(year, month, day) {
    return year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  }

  function normalizeDateKey(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatDateIso(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function getColorVar(color) {
    var map = {
      red: "var(--color-danger)",
      orange: "var(--color-warning)",
      yellow: "var(--color-warning)",
      green: "var(--color-success, #3d8b6e)",
      blue: "var(--color-primary)",
      purple: "var(--color-accent)",
      gray: "var(--color-text-muted)",
    };
    return map[color] || map.blue;
  }

  function uniqueIdempotencyKey() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "event-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function toDateInputValue(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function ensureModal() {
    var existing = document.querySelector("[data-calendar-event-modal]");
    if (existing) return existing;

    var modal = document.createElement("div");
    modal.className = "calendar-event-modal-overlay";
    modal.hidden = true;
    modal.setAttribute("data-calendar-event-modal", "true");
    modal.innerHTML = [
      '<div class="calendar-event-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title">',
      '  <div class="calendar-event-modal-header">',
      '    <div>',
      '      <p class="hero-kicker" data-calendar-event-kicker>New event</p>',
      '      <h3 id="calendar-event-title">Create a calendar event</h3>',
      '    </div>',
      '    <button type="button" class="glass-btn" data-calendar-event-close>Close</button>',
      '  </div>',
      '  <div class="calendar-event-modal-body">',
      '    <label class="calendar-event-field">',
      '      <span>Title</span>',
      '      <input type="text" maxlength="200" data-calendar-event-title placeholder="Team study session" />',
      '    </label>',
      '    <label class="calendar-event-field">',
      '      <span>Date</span>',
      '      <input type="date" data-calendar-event-date />',
      '    </label>',
      '    <label class="calendar-event-field">',
      '      <span>Description</span>',
      '      <textarea rows="4" data-calendar-event-description placeholder="What should be remembered?"></textarea>',
      '    </label>',
      '    <div class="calendar-event-grid">',
      '      <label class="calendar-event-field">',
      '        <span>Calendar color</span>',
      '        <select data-calendar-event-color>',
      '          <option value="blue">Blue</option>',
      '          <option value="green">Green</option>',
      '          <option value="orange">Orange</option>',
      '          <option value="red">Red</option>',
      '          <option value="purple">Purple</option>',
      '          <option value="gray">Gray</option>',
      '        </select>',
      '      </label>',
      '      <label class="calendar-event-field">',
      '        <span>Tag</span>',
      '        <input type="text" data-calendar-event-tag placeholder="Study, Assignment, Personal" />',
      '      </label>',
      '    </div>',
      '    <label class="calendar-event-field">',
      '      <span><input type="checkbox" data-calendar-event-all-day /> All day</span>',
      '    </label>',
      '  </div>',
      '  <div class="calendar-event-modal-footer">',
      '    <p class="task-create-note">Use this modal to create events directly from the calendar page. Month navigation stays in the header.</p>',
      '    <div class="calendar-event-actions">',
      '      <button type="button" class="glass-btn" data-calendar-event-cancel>Cancel</button>',
      '      <button type="button" class="glass-btn" data-calendar-event-submit>Create event</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join("");

    body.appendChild(modal);
    return modal;
  }

  function closeModal(modal, onBackdropClick, onKeydown) {
    modal.hidden = true;
    modal.removeEventListener("click", onBackdropClick);
    document.removeEventListener("keydown", onKeydown);
  }

  function openEventModal() {
    var modal = ensureModal();
    var kicker = modal.querySelector("[data-calendar-event-kicker]");
    var titleHeading = modal.querySelector("#calendar-event-title");
    var titleInput = modal.querySelector("[data-calendar-event-title]");
    var dateInput = modal.querySelector("[data-calendar-event-date]");
    var descInput = modal.querySelector("[data-calendar-event-description]");
    var colorInput = modal.querySelector("[data-calendar-event-color]");
    var tagInput = modal.querySelector("[data-calendar-event-tag]");
    var allDayInput = modal.querySelector("[data-calendar-event-all-day]");
    var submitBtn = modal.querySelector("[data-calendar-event-submit]");
    var cancelBtn = modal.querySelector("[data-calendar-event-cancel]");
    var closeBtn = modal.querySelector("[data-calendar-event-close]");
    var cursor = parseCursor();

    kicker.textContent = "New event";
    titleHeading.textContent = "Create a calendar event";
    titleInput.value = "";
    dateInput.value = toDateInputValue(new Date(cursor.year, cursor.month, 1));
    descInput.value = "";
    colorInput.value = "blue";
    tagInput.value = "";
    allDayInput.checked = false;

    function onBackdropClick(ev) {
      if (ev.target === modal) closeModal(modal, onBackdropClick, onKeydown);
    }

    function onKeydown(ev) {
      if (ev.key === "Escape") closeModal(modal, onBackdropClick, onKeydown);
    }

    function saveEvent() {
      var title = titleInput.value.trim();
      if (!title) {
        alert("Title is required.");
        titleInput.focus();
        return;
      }
      if (!dateInput.value) {
        alert("Date is required.");
        dateInput.focus();
        return;
      }

      submitBtn.disabled = true;
      ButlerApi.post("/calendar", {
        title: title,
        date: dateInput.value,
        description: descInput.value.trim(),
        color: colorInput.value,
        tag: tagInput.value.trim(),
        allDay: allDayInput.checked,
      }, { headers: { "Idempotency-Key": uniqueIdempotencyKey() } }).then(function () {
        closeModal(modal, onBackdropClick, onKeydown);
        loadMonth(parseCursor().year, parseCursor().month, true);
      }).catch(function (err) {
        submitBtn.disabled = false;
        alert("Create failed: " + (err && err.message ? err.message : "unknown"));
      });
    }

    submitBtn.onclick = saveEvent;
    cancelBtn.onclick = function () { closeModal(modal, onBackdropClick, onKeydown); };
    closeBtn.onclick = function () { closeModal(modal, onBackdropClick, onKeydown); };
    modal.onclick = onBackdropClick;
    document.addEventListener("keydown", onKeydown);
    modal.hidden = false;
    titleInput.focus();
  }

  function updateUrl(year, month, replace) {
    var url = new URL(window.location.href);
    url.searchParams.set("year", String(year));
    url.searchParams.set("month", String(month));
    var nextHref = url.pathname + "?" + url.searchParams.toString();
    if (replace) window.history.replaceState({}, "", nextHref);
    else window.history.pushState({}, "", nextHref);
  }

  function buildDayCell(year, month, day, events, isToday, isSelected) {
    var detailTitle = events.length ? events[0].title : "Free day";
    var detailText = events.length ? (events[0].description || "No details yet.") : "Open space for revision and reflection.";
    var html = [
      '<button class="calendar-day' + (isToday ? " today" : "") + (isSelected ? " is-selected" : "") + '" type="button" data-day="' + day + '" data-title="' + escapeHtml(detailTitle) + '" data-detail="' + escapeHtml(detailText) + '">',
      '  <span class="calendar-day-number">' + day + '</span>'
    ];

    if (events.length) {
      html.push('  <div class="event-list">');
      events.slice(0, 3).forEach(function (event) {
        html.push('    <span class="event-pill" style="--event-color: ' + escapeHtml(getColorVar(event.color)) + '">');
        if (event.isTask) html.push('      <span class="event-pill-badge">Task</span>');
        html.push('      <span>' + escapeHtml(event.title) + '</span>');
        html.push('    </span>');
      });
      html.push('  </div>');
    }

    html.push('</button>');
    return html.join("\n");
  }

  function renderCalendar(year, month, events, selectedDayOverride) {
    var today = new Date();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var firstDayJs = new Date(year, month, 1).getDay();
    var leading = (firstDayJs + 6) % 7;
    var byDate = {};
    var cells = [];
    var selectedDay = Number.isInteger(selectedDayOverride) ? selectedDayOverride : 1;

    events.forEach(function (event) {
      var key = normalizeDateKey(event.date);
      if (!key) return;
      (byDate[key] = byDate[key] || []).push(event);
    });

    for (var i = 0; i < leading; i += 1) {
      cells.push('<button class="calendar-day muted" type="button" disabled></button>');
    }

    for (var day = 1; day <= daysInMonth; day += 1) {
      var iso = formatDateIso(year, month, day);
      var dayEvents = byDate[iso] || [];
      if (!Number.isInteger(selectedDayOverride) && dayEvents.length && selectedDay === 1) selectedDay = day;
      cells.push(buildDayCell(year, month, day, dayEvents, day === today.getDate() && month === today.getMonth() && year === today.getFullYear(), day === selectedDay));
    }

    while (cells.length % 7 !== 0) {
      cells.push('<button class="calendar-day muted" type="button" disabled></button>');
    }

    calendarState.year = year;
    calendarState.month = month;
    calendarState.events = events;
    calendarState.selectedDay = selectedDay;

    if (monthLabel) monthLabel.textContent = monthLabelText(year, month);
    if (eventCount) eventCount.textContent = events.length + " event" + (events.length === 1 ? "" : "s");
    if (grid) grid.innerHTML = cells.join("");

    var selectedIso = formatDateIso(year, month, selectedDay);
    var selectedEvents = byDate[selectedIso] || [];
    var detailEvent = selectedEvents[0] || null;

    if (chipList) {
      if (selectedEvents.length === 0) {
        chipList.innerHTML = '<span class="calendar-chip">Free day</span>';
      } else {
        chipList.innerHTML = selectedEvents.slice(0, 3).map(function (event) {
          return '<span class="calendar-chip">' + escapeHtml(event.title) + '</span>';
        }).join("");
      }
    }

    if (detailTitle) detailTitle.textContent = "Day " + selectedDay;
    if (detailText) detailText.textContent = detailEvent ? (detailEvent.description || "No details yet.") : "Open a day to review its plan.";
    if (detailBadge) detailBadge.textContent = detailEvent ? detailEvent.title : "No plans";
  }

  function syncNavButtons(year, month) {
    var prev = root.querySelector("[data-calendar-prev]");
    var next = root.querySelector("[data-calendar-next]");
    var prevYear = month === 0 ? year - 1 : year;
    var prevMonth = month === 0 ? 11 : month - 1;
    var nextYear = month === 11 ? year + 1 : year;
    var nextMonth = month === 11 ? 0 : month + 1;

    if (prev) {
      prev.setAttribute("data-calendar-target-year", String(prevYear));
      prev.setAttribute("data-calendar-target-month", String(prevMonth));
    }
    if (next) {
      next.setAttribute("data-calendar-target-year", String(nextYear));
      next.setAttribute("data-calendar-target-month", String(nextMonth));
    }
  }

  async function loadMonth(year, month, replace) {
    if (!Number.isInteger(year) || year < 1900 || year > 3000) year = new Date().getFullYear();
    if (!Number.isInteger(month) || month < 0 || month > 11) month = new Date().getMonth();
    updateUrl(year, month, replace);
    root.setAttribute("data-calendar-year", String(year));
    root.setAttribute("data-calendar-month", String(month));
    syncNavButtons(year, month);

    try {
      var data = await ButlerApi.get("/calendar/month/" + year + "/" + month);
      renderCalendar(year, month, Array.isArray(data.events) ? data.events : [], calendarState.year === year && calendarState.month === month ? calendarState.selectedDay : null);
    } catch (err) {
      alert("Calendar load failed: " + (err && err.message ? err.message : "unknown"));
    }
  }

  var refresh = root.querySelector("[data-refresh-calendar]");
  if (refresh) {
    refresh.addEventListener("click", function () {
      loadMonth(calendarState.year, calendarState.month, true);
    });
  }

  var prev = root.querySelector("[data-calendar-prev]");
  var next = root.querySelector("[data-calendar-next]");
  var todayBtn = root.querySelector("[data-calendar-today]");

  if (prev) {
    prev.addEventListener("click", function () {
      loadMonth(Number(prev.getAttribute("data-calendar-target-year")), Number(prev.getAttribute("data-calendar-target-month")));
    });
  }

  if (next) {
    next.addEventListener("click", function () {
      loadMonth(Number(next.getAttribute("data-calendar-target-year")), Number(next.getAttribute("data-calendar-target-month")));
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener("click", function () {
      var now = new Date();
      loadMonth(now.getFullYear(), now.getMonth());
    });
  }

  document.addEventListener("click", function (ev) {
    var trigger = ev.target && ev.target.closest ? ev.target.closest("[data-action='new-event']") : null;
    if (!trigger) return;
    ev.preventDefault();
    openEventModal();
  });

  root.addEventListener("click", function (ev) {
    var dayButton = ev.target && ev.target.closest ? ev.target.closest(".calendar-day[data-day]") : null;
    if (!dayButton || dayButton.disabled) return;
    var day = Number(dayButton.getAttribute("data-day"));
    if (!Number.isInteger(day)) return;
    var year = calendarState.year;
    var month = calendarState.month;
    var iso = formatDateIso(year, month, day);
    var dayEvents = calendarState.events.filter(function (event) { return normalizeDateKey(event.date) === iso; });
    calendarState.selectedDay = day;
    renderCalendar(year, month, calendarState.events, day);
  });

  injectStyles();

  window.addEventListener("butler:data-changed", function (ev) {
    var tool = ev && ev.detail && ev.detail.tool;
    if (!tool || tool.indexOf("event_") === 0 || tool.indexOf("task_") === 0) loadMonth(calendarState.year, calendarState.month, true);
  });

  try {
    var bc = new BroadcastChannel("butler-data");
    bc.onmessage = function (ev) {
      var tool = ev.data && ev.data.tool;
      if (!tool || tool.indexOf("event_") === 0 || tool.indexOf("task_") === 0) loadMonth(calendarState.year, calendarState.month, true);
    };
  } catch (_) {}

  var initial = parseCursor();
  syncNavButtons(initial.year, initial.month);
  loadMonth(initial.year, initial.month, true);
})();