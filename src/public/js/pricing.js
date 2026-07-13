// ============================================================
// public/js/pricing.js
// Pricing page (Task 6): simulated plan change.
// No real payment processor — calls the API to update the plan
// in MongoDB, then reloads so the page reflects the new state
// (current-plan button disabled, etc.) straight from the server.
// ============================================================

(function initPricing() {
  var statusEl = document.querySelector("[data-pricing-status]");
  var buttons = document.querySelectorAll("[data-choose-plan]");

  if (buttons.length === 0) return;

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      var plan = button.getAttribute("data-choose-plan");

      buttons.forEach(function (b) { b.disabled = true; });
      if (statusEl) statusEl.textContent = "Updating plan (simulated)...";

      fetch("/api/billing/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan }),
      })
        .then(function (res) {
          return res.json().then(function (body) { return { ok: res.ok, body: body }; });
        })
        .then(function (result) {
          if (!result.ok || !result.body.ok) {
            throw new Error((result.body && result.body.error) || "Plan change failed.");
          }
          if (statusEl) statusEl.textContent = "Plan updated to " + result.body.data.plan + ".";
          window.location.reload();
        })
        .catch(function (err) {
          if (statusEl) statusEl.textContent = err.message || "Plan change failed.";
          buttons.forEach(function (b) { b.disabled = false; });
        });
    });
  });
})();
