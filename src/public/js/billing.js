// ============================================================
// public/js/billing.js
// Billing & Credits page (Task 6): simulated credit top-up.
// No real payment processor — this just calls the API which
// updates MongoDB and returns the fresh balance + history.
// ============================================================

(function initBilling() {
  var creditsNumberEl = document.querySelector("[data-credits-number]");
  var statusEl = document.querySelector("[data-topup-status]");
  var historyList = document.querySelector("[data-history-list]");
  var buttons = document.querySelectorAll("[data-topup]");

  if (buttons.length === 0) return;

  function renderHistory(history) {
    if (!historyList) return;
    historyList.innerHTML = "";

    if (!history || history.length === 0) {
      var empty = document.createElement("p");
      empty.className = "history-empty";
      empty.textContent = "No billing activity yet.";
      historyList.appendChild(empty);
      return;
    }

    history.slice(0, 10).forEach(function (entry) {
      var item = document.createElement("div");
      item.className = "history-item";

      var note = document.createElement("span");
      note.className = "history-note";
      note.textContent = entry.note || "";

      var meta = document.createElement("span");
      meta.className = "history-meta";
      meta.textContent = entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "";

      item.appendChild(note);
      item.appendChild(meta);
      historyList.appendChild(item);
    });
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      var amount = Number(button.getAttribute("data-topup"));

      buttons.forEach(function (b) { b.disabled = true; });
      if (statusEl) statusEl.textContent = "Processing (simulated)...";

      fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount }),
      })
        .then(function (res) {
          return res.json().then(function (body) { return { ok: res.ok, body: body }; });
        })
        .then(function (result) {
          if (!result.ok || !result.body.ok) {
            throw new Error((result.body && result.body.error) || "Top-up failed.");
          }
          if (creditsNumberEl) creditsNumberEl.textContent = result.body.data.credits;
          renderHistory(result.body.data.history);
          if (statusEl) statusEl.textContent = "Added " + amount + " credits (simulated).";
        })
        .catch(function (err) {
          if (statusEl) statusEl.textContent = err.message || "Top-up failed.";
        })
        .finally(function () {
          buttons.forEach(function (b) { b.disabled = false; });
        });
    });
  });
})();
