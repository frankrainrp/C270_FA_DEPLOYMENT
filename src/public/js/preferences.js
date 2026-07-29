// ============================================================
// public/js/preferences.js
// Applies theme and primary button-colour choices from Preferences.
// Persists them in localStorage for every Butler page on this device.
// The inline <head> script in each page reads this key BEFORE the
// stylesheet loads so the correct theme is applied without a flash.
// ============================================================

(function initPreferences() {
  var STORAGE_KEY = "butler-theme";
  var BUTTON_COLOR_STORAGE_KEY = "butler-button-color";
  var VALID = { paper: true, retro: true, dark: true };
  var VALID_BUTTON_COLORS = {
    default: true,
    forest: true,
    ocean: true,
    plum: true,
    clay: true,
  };
  var META_COLORS = { retro: "#f3eee0", paper: "#eff6f5", dark: "#0a0a0b" };

  var cards = document.querySelectorAll("[data-theme-value]");
  var buttonColorOptions = document.querySelectorAll("[data-button-color-value]");
  if (cards.length === 0 && buttonColorOptions.length === 0) return;

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

  function currentButtonColor() {
    try {
      var saved = localStorage.getItem(BUTTON_COLOR_STORAGE_KEY);
      if (saved && VALID_BUTTON_COLORS[saved] && saved !== "default") return saved;
    } catch (_) { /* ignore */ }
    return "default";
  }

  function markButtonColorSelected(color) {
    buttonColorOptions.forEach(function (option) {
      var selected = option.getAttribute("data-button-color-value") === color;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", selected ? "true" : "false");
      var status = option.querySelector("[data-button-color-status]");
      if (status) status.hidden = !selected;
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

  function applyButtonColor(color) {
    if (!VALID_BUTTON_COLORS[color]) return;
    try {
      if (color === "default") {
        localStorage.removeItem(BUTTON_COLOR_STORAGE_KEY);
        document.documentElement.removeAttribute("data-button-color");
      } else {
        localStorage.setItem(BUTTON_COLOR_STORAGE_KEY, color);
        document.documentElement.setAttribute("data-button-color", color);
      }
    } catch (_) {
      if (color === "default") document.documentElement.removeAttribute("data-button-color");
      else document.documentElement.setAttribute("data-button-color", color);
    }
    markButtonColorSelected(color);
  }

  markSelected(currentTheme());
  markButtonColorSelected(currentButtonColor());

  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      var theme = card.getAttribute("data-theme-value");
      applyTheme(theme);
    });
  });

  buttonColorOptions.forEach(function (option) {
    option.addEventListener("click", function () {
      applyButtonColor(option.getAttribute("data-button-color-value"));
    });
  });
})();
