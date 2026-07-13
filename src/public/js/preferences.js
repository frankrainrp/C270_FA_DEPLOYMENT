// ============================================================
// public/js/preferences.js
// Applies the theme choice from the preferences page.
// Persists the selected theme in localStorage under "butler-theme".
// The inline <head> script in each page reads this key BEFORE the
// stylesheet loads so the correct theme is applied without a flash.
// ============================================================

(function initPreferences() {
  var STORAGE_KEY = "butler-theme";
  var VALID = { paper: true, retro: true, dark: true };
  var META_COLORS = { retro: "#f3eee0", paper: "#eff6f5", dark: "#0a0a0b" };

  var cards = document.querySelectorAll("[data-theme-value]");
  if (cards.length === 0) return;

  function currentTheme() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && VALID[saved]) return saved;
    } catch (_) { /* ignore */ }
    return document.documentElement.getAttribute("data-theme") || "retro";
  }

  function markSelected(theme) {
    cards.forEach(function (card) {
      var value = card.getAttribute("data-theme-value");
      if (value === theme) card.classList.add("selected");
      else card.classList.remove("selected");
    });
  }

  function applyTheme(theme) {
    if (!VALID[theme]) return;
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && META_COLORS[theme]) {
      meta.setAttribute("content", META_COLORS[theme]);
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) { /* ignore */ }
    markSelected(theme);
  }

  markSelected(currentTheme());

  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      var theme = card.getAttribute("data-theme-value");
      applyTheme(theme);
    });
  });
})();
