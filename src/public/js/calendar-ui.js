// ============================================================
// public/js/calendar-ui.js
// Client controller for the /calendar page.
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
  var initialSelectedDate = root.getAttribute("data-calendar-selected-date") || "";
  var initialSelectedDay = Number(initialSelectedDate.split("-")[2]);
  
  var calendarState = {
    year: null,
    month: null,
    events: [],
    selectedDay: Number.isInteger(initialSelectedDay) && initialSelectedDay > 0
      ? initialSelectedDay
      : new Date().getDate(),
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
      ".event-pill.is-dragging{opacity: 0.4; transform: scale(0.95);}",
      ".calendar-day.drag-hover{background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); border: 2px dashed var(--color-primary);}",
      "@media (max-width: 720px){.calendar-event-grid{grid-template-columns:1fr;}.calendar-event-modal-header,.calendar-event-modal-footer{flex-direction:column;align-items:stretch;}.calendar-event-actions{justify-content:stretch;}.calendar-event-actions .glass-btn{width:100%;}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function escapeHtml(value) { return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }

  function parseIsoDate(value) {
    var match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]) - 1;
    var day = Number(match[3]);
    var date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return { year: year, month: month, day: day };
  }
  
  function parseCursor() {
    var params = new URLSearchParams(window.location.search);
    var now = new Date();
    var selectedDate = parseIsoDate(params.get("date"));
    var year = Number(params.get("year"));
    var month = Number(params.get("month"));
    if (!Number.isInteger(year) || year < 1900 || year > 3000) {
      year = selectedDate ? selectedDate.year : now.getFullYear();
    }
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      month = selectedDate ? selectedDate.month : now.getMonth();
    }
    return { year: year, month: month };
  }
  
  function formatDateIso(year, month, day) { return year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0"); }
  
  function normalizeDateKey(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatDateIso(date.getFullYear(), date.getMonth(), date.getDate());
  }
  
  function getColorVar(color) {
    var map = { red: "var(--color-danger)", orange: "var(--color-warning)", yellow: "var(--color-warning)", green: "var(--color-success, #3d8b6e)", blue: "var(--color-primary)", purple: "var(--color-accent)", gray: "var(--color-text-muted)" };
    return map[color] || map.blue;
  }
  
  function updateUrl(year, month, replace) {
    var url = new URL(window.location.href);
    url.searchParams.set("year", String(year));
    url.searchParams.set("month", String(month));
    url.searchParams.set("date", formatDateIso(year, month, calendarState.selectedDay));
    var nextHref = url.pathname + "?" + url.searchParams.toString();
    if (replace) window.history.replaceState({}, "", nextHref);
    else window.history.pushState({}, "", nextHref);
  }

  function syncMiniCalendar(isoDate) {
    document.querySelectorAll(".mini-calendar-day.selected").forEach(function (day) {
      day.classList.remove("selected");
      day.removeAttribute("aria-current");
    });
    var selected = document.querySelector('.mini-calendar-day[data-date="' + isoDate + '"]');
    if (selected) {
      selected.classList.add("selected");
      selected.setAttribute("aria-current", "date");
    }
  }

  function renderMiniCalendar(year, month) {
    var miniCalendar = document.querySelector(".mini-calendar");
    if (!miniCalendar) return;
    var today = new Date();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var leading = (new Date(year, month, 1).getDay() + 6) % 7;
    var selectedIso = formatDateIso(year, month, calendarState.selectedDay);
    var eventDates = new Set(calendarState.events.map(function (event) {
      return normalizeDateKey(event.date);
    }).filter(Boolean));
    var html = [];

    for (var empty = 0; empty < leading; empty += 1) {
      html.push('<span class="mini-calendar-day muted" aria-hidden="true"></span>');
    }
    for (var day = 1; day <= daysInMonth; day += 1) {
      var isoDate = formatDateIso(year, month, day);
      var isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
      var isSelected = isoDate === selectedIso;
      html.push(
        '<a class="mini-calendar-day'
        + (isToday ? " today" : "")
        + (isSelected ? " selected" : "")
        + (eventDates.has(isoDate) ? " has-events" : "")
        + '" href="/calendar?date=' + isoDate + '" data-date="' + isoDate + '"'
        + (isSelected ? ' aria-current="date"' : "")
        + "><span>" + day + "</span></a>"
      );
    }
    miniCalendar.innerHTML = html.join("");
  }
  
  function syncNavButtons(year, month) {
    var prev = root.querySelector("[data-calendar-prev]");
    var next = root.querySelector("[data-calendar-next]");
    if (!prev || !next) return;
    prev.setAttribute("data-calendar-target-year", String(month === 0 ? year - 1 : year));
    prev.setAttribute("data-calendar-target-month", String(month === 0 ? 11 : month - 1));
    next.setAttribute("data-calendar-target-year", String(month === 11 ? year + 1 : year));
    next.setAttribute("data-calendar-target-month", String(month === 11 ? 0 : month + 1));
  }

  function toDateInputValue(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  // --- MODAL RENDERING ---
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
      '      <p class="hero-kicker" data-calendar-event-kicker>New Event</p>',
      '      <h3 id="calendar-event-title">Create a calendar event</h3>',
      '    </div>',
      '    <button type="button" class="glass-btn" data-calendar-event-close>Close</button>',
      '  </div>',
      '  <div class="calendar-event-modal-body">',
      '    <label class="calendar-event-field">',
      '      <span>Title</span>',
      '      <input type="text" maxlength="200" data-calendar-event-title placeholder="Event title" />',
      '    </label>',
      '    <label class="calendar-event-field">',
      '      <span>Description</span>',
      '      <textarea rows="4" data-calendar-event-description placeholder="Event description"></textarea>',
      '    </label>',
      '    <div class="calendar-event-grid">',
      '      <label class="calendar-event-field">',
      '        <span>Date</span>',
      '        <input type="date" data-calendar-event-date />',
      '      </label>',
      '      <label class="calendar-event-field">',
      '        <span>Color</span>',
      '        <select data-calendar-event-color>',
      '          <option value="blue" selected>Blue</option>',
      '          <option value="green">Green</option>',
      '          <option value="orange">Orange</option>',
      '          <option value="red">Red</option>',
      '          <option value="purple">Purple</option>',
      '          <option value="gray">Gray</option>',
      '        </select>',
      '      </label>',
      '    </div>',
      '    <label class="calendar-event-field">',
      '      <span>Calendar / tag</span>',
      '      <input type="text" maxlength="80" data-calendar-event-tag placeholder="Default" />',
      '    </label>',
      '  </div>',
      '  <div class="calendar-event-modal-footer">',
      '    <p class="task-create-note" style="font-size: 13px; color: var(--color-text-muted);">The event will appear on this calendar.</p>',
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
    var createEvent = ButlerApi.createOperation("event");
    var titleInput = modal.querySelector("[data-calendar-event-title]");
    var dateInput = modal.querySelector("[data-calendar-event-date]");
    var descInput = modal.querySelector("[data-calendar-event-description]");
    var colorInput = modal.querySelector("[data-calendar-event-color]");
    var tagInput = modal.querySelector("[data-calendar-event-tag]");
    var submitBtn = modal.querySelector("[data-calendar-event-submit]");
    var cancelBtn = modal.querySelector("[data-calendar-event-cancel]");
    var closeBtn = modal.querySelector("[data-calendar-event-close]");
    
    var cursor = parseCursor();
    
    titleInput.value = "";
    dateInput.value = toDateInputValue(new Date(cursor.year, cursor.month, calendarState.selectedDay || 1));
    descInput.value = "";
    colorInput.value = "blue";
    tagInput.value = "";
    
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
        alert("Due date is required.");
        dateInput.focus();
        return;
      }
      
      submitBtn.disabled = true;
      
      createEvent("/calendar", {
        title: title,
        date: dateInput.value,
        description: descInput.value.trim(),
        color: colorInput.value,
        tag: tagInput.value.trim(),
        allDay: true
      }).then(function () {
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

  // --- DAY RENDERING ---
  function buildDayCell(year, month, day, events, isToday, isSelected) {
    var isoDate = formatDateIso(year, month, day);

    // We no longer attach data-title and data-detail directly to the HTML string.
    // Instead, the selectDay() function will parse the events Array directly.
    var html = [
      '<button class="calendar-day' + (isToday ? " today" : "") + (isSelected ? " is-selected" : "") + '" type="button" data-day="' + day + '" data-iso="' + isoDate + '">',
      '  <span class="calendar-day-number">' + day + '</span>'
    ];
    
    if (events.length) {
      html.push('  <div class="event-list">');
      events.slice(0, 3).forEach(function (event) {
        if (event.isTask) {
           html.push('    <span class="event-pill" draggable="true" data-task-id="' + escapeHtml(event._id) + '" style="--event-color: ' + escapeHtml(getColorVar(event.color)) + '">');
           html.push('      <span class="event-pill-badge">Task</span>');
        } else {
           html.push('    <span class="event-pill" style="--event-color: ' + escapeHtml(getColorVar(event.color)) + '">');
        }
        html.push('      <span>' + escapeHtml(event.title) + '</span>');
        html.push('    </span>');
      });
      html.push('  </div>');
    }
    html.push('</button>');
    return html.join("\n");
  }

  // --- SELECTION LOGIC ---
  function selectDay(dayElement) {
    var prevs = grid.querySelectorAll(".calendar-day.is-selected");
    prevs.forEach(function (prev) {
      prev.classList.remove("is-selected");
      prev.setAttribute("aria-pressed", "false");
    });
    
    dayElement.classList.add("is-selected");
    dayElement.setAttribute("aria-pressed", "true");
    
    var day = dayElement.getAttribute("data-day");
    calendarState.selectedDay = Number(day);
    var isoDate = dayElement.getAttribute("data-iso");
    root.setAttribute("data-calendar-selected-date", isoDate || "");
    if (isoDate) {
      syncMiniCalendar(isoDate);
      updateUrl(calendarState.year, calendarState.month, true);
    }
    
    if (detailTitle) detailTitle.textContent = "Day " + day;
    
    if (!isoDate) return;
    
    // Grab ALL events for the clicked day
    var selectedEvents = calendarState.events.filter(function (e) {
      return normalizeDateKey(e.date) === isoDate;
    });
    
    // Display logic for the bottom panel descriptions
    if (selectedEvents.length === 0) {
      if (detailText) {
        detailText.textContent = "Open space for revision and reflection.";
        detailText.style.whiteSpace = "normal";
      }
      if (detailBadge) detailBadge.textContent = "Free day";
    } else if (selectedEvents.length === 1) {
      if (detailText) {
        detailText.textContent = selectedEvents[0].description || "No details yet.";
        detailText.style.whiteSpace = "normal";
      }
      if (detailBadge) detailBadge.textContent = selectedEvents[0].title;
    } else {
      // Multiple Events: Build a bulleted list!
      var combinedText = selectedEvents.map(function(e) {
        return "• " + e.title + (e.description ? " - " + e.description : "");
      }).join("\n");
      
      if (detailText) {
        detailText.textContent = combinedText;
        detailText.style.whiteSpace = "pre-wrap"; // This ensures \n creates a visual line break
      }
      if (detailBadge) detailBadge.textContent = selectedEvents.length + " Scheduled Items";
    }
    
    // Update the chips (if they are shown on the screen)
    if (!chipList) return;
    chipList.innerHTML = "";
    if (selectedEvents.length === 0) {
      chipList.innerHTML = '<span class="calendar-chip">Free day</span>';
    } else {
      selectedEvents.slice(0, 3).forEach(function (ev) {
        var chip = document.createElement("span");
        chip.className = "calendar-chip";
        chip.textContent = ev.title;
        chipList.appendChild(chip);
      });
    }
  }

  // --- DRAG AND DROP ---
  function initDragAndDrop() {
    var draggablePills = document.querySelectorAll('.event-pill[draggable="true"]');
    
    draggablePills.forEach(function (pill) {
      pill.addEventListener('dragstart', function (event) {
        event.stopPropagation();
        event.dataTransfer.setData('text/plain', pill.getAttribute('data-task-id'));
        pill.classList.add('is-dragging');
      });

      pill.addEventListener('dragend', function () {
        pill.classList.remove('is-dragging');
      });
    });

    var calendarDays = document.querySelectorAll('.calendar-day');

    calendarDays.forEach(function (daySquare) {
      daySquare.addEventListener('dragover', function (event) {
        event.preventDefault(); 
        daySquare.classList.add('drag-hover');
      });

      daySquare.addEventListener('dragleave', function () {
        daySquare.classList.remove('drag-hover');
      });

      daySquare.addEventListener('drop', function (event) {
        event.preventDefault();
        event.stopPropagation();
        daySquare.classList.remove('drag-hover');

        var taskId = event.dataTransfer.getData('text/plain');
        var newDate = daySquare.getAttribute('data-iso');

        if (!taskId || !newDate) return;

        ButlerApi.put("/tasks/" + taskId, { dueDate: newDate })
          .then(function () {
            loadMonth(calendarState.year, calendarState.month, true);
          })
          .catch(function (error) {
            console.error("Failed to reschedule task:", error);
            alert("Could not reschedule task. Please try again.");
          });
      });
    });
  }

  // --- API CALL & GRID BUILDER ---
  function loadMonth(year, month, replace) {
    ButlerApi.get("/calendar/month/" + year + "/" + month)
      .then(function (data) {
        calendarState.year = year;
        calendarState.month = month;
        calendarState.events = Array.isArray(data.events) ? data.events : [];

        if (monthLabel) {
          monthLabel.textContent = new Date(year, month, 1).toLocaleDateString("en", {
            month: "long",
            year: "numeric"
          });
        }
        if (eventCount) eventCount.textContent = String(calendarState.events.length);
        
        var today = new Date();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        
        if (calendarState.selectedDay > daysInMonth) {
            calendarState.selectedDay = daysInMonth;
        }

        var firstDayJs = new Date(year, month, 1).getDay();
        var leading = (firstDayJs + 6) % 7;
        
        var html = [];
        for (var i = 0; i < leading; i += 1) {
          html.push('<div class="calendar-day muted" aria-hidden="true"></div>');
        }
        
        for (var d = 1; d <= daysInMonth; d += 1) {
          var isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
          var isSelected = d === calendarState.selectedDay;
          var isoDate = formatDateIso(year, month, d);
          var dayEvents = calendarState.events.filter(function (e) {
            return normalizeDateKey(e.date) === isoDate;
          });
          html.push(buildDayCell(year, month, d, dayEvents, isToday, isSelected));
        }
        
        var totalCells = leading + daysInMonth;
        while (totalCells % 7 !== 0) {
          html.push('<div class="calendar-day muted" aria-hidden="true"></div>');
          totalCells += 1;
        }
        
        grid.innerHTML = html.join("");
        updateUrl(year, month, replace);
        syncNavButtons(year, month);
        renderMiniCalendar(year, month);
        
        var activeBtn = grid.querySelector('.calendar-day[data-day="' + calendarState.selectedDay + '"]');
        if (activeBtn) selectDay(activeBtn);

        initDragAndDrop();
      })
      .catch(function (err) {
        console.error("Failed to load month:", err);
      });
  }

  // Handle standard clicks
  grid.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".calendar-day");
    if (!btn || btn.disabled) return;
    selectDay(btn);
  });

  root.addEventListener("click", function (ev) {
    var actionBtn = ev.target.closest("button");
    if (!actionBtn) return;
    if (actionBtn.hasAttribute("data-calendar-prev") || actionBtn.hasAttribute("data-calendar-next")) {
      var ty = Number(actionBtn.getAttribute("data-calendar-target-year"));
      var tm = Number(actionBtn.getAttribute("data-calendar-target-month"));
      if (!Number.isNaN(ty) && !Number.isNaN(tm)) {
        calendarState.selectedDay = 1; 
        loadMonth(ty, tm, false);
      }
    } else if (actionBtn.hasAttribute("data-calendar-today")) {
      var now = new Date();
      calendarState.selectedDay = now.getDate();
      loadMonth(now.getFullYear(), now.getMonth(), false);
    } else if (actionBtn.hasAttribute("data-calendar-new-event")) {
      ev.stopPropagation();
      openEventModal();
    } else if (actionBtn.hasAttribute("data-refresh-calendar")) {
      var cursor = parseCursor();
      loadMonth(cursor.year, cursor.month, true);
    }
  });

  // Global listener for the Sidebar button
  document.addEventListener("click", function (ev) {
    var miniDateLink = ev.target.closest(".mini-calendar-day[data-date]");
    if (miniDateLink) {
      var selectedDate = parseIsoDate(miniDateLink.getAttribute("data-date"));
      if (selectedDate) {
        ev.preventDefault();
        calendarState.selectedDay = selectedDate.day;
        if (calendarState.year === selectedDate.year && calendarState.month === selectedDate.month) {
          var selectedButton = grid.querySelector('.calendar-day[data-iso="' + miniDateLink.getAttribute("data-date") + '"]');
          if (selectedButton) selectDay(selectedButton);
        } else {
          loadMonth(selectedDate.year, selectedDate.month, false);
        }
        return;
      }
    }

    var newEventBtn = ev.target.closest('[data-action="new-event"]');
    if (newEventBtn) {
      ev.preventDefault();
      openEventModal();
    }
  });

  injectStyles();
  var initialCursor = parseCursor();
  loadMonth(initialCursor.year, initialCursor.month, true);
  if (new URLSearchParams(window.location.search).get("create") === "event") {
    openEventModal();
    var cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("create");
    window.history.replaceState({}, "", cleanUrl.pathname + "?" + cleanUrl.searchParams.toString());
  }
})();
