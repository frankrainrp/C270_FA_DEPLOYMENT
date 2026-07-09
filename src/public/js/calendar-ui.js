// ============================================================
// public/js/calendar-ui.js
// DOM controller for the /calendar page.  Handles:
//   - Refresh button          -> reload the page
//   - butler:data-changed     -> reload after agent writes event_*
// The month grid itself is rendered server-side by calendar.ejs.
// ============================================================

(function initCalendarUi() {
  var root = document.querySelector("[data-calendar-root]");
  if (!root) return;

  var refresh = root.querySelector("[data-refresh-calendar]");
  if (refresh) {
    refresh.addEventListener("click", function () {
      window.location.reload();
    });
  }

  window.addEventListener("butler:data-changed", function (ev) {
    var tool = ev && ev.detail && ev.detail.tool;
    if (!tool || tool.indexOf("event_") === 0 || tool.indexOf("task_") === 0) window.location.reload();
  });

  try {
    var bc = new BroadcastChannel("butler-data");
    bc.onmessage = function (ev) {
      var tool = ev.data && ev.data.tool;
      if (!tool || tool.indexOf("event_") === 0 || tool.indexOf("task_") === 0) window.location.reload();
    };
  } catch (_) {}
})();
