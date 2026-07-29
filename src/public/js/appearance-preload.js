// Applies locally saved appearance choices before the stylesheet loads.
// This file intentionally stays tiny and synchronous to prevent a flash of
// the default button colour while navigating between standalone pages.
(function preloadAppearance() {
  var VALID_BUTTON_COLORS = {
    forest: true,
    ocean: true,
    plum: true,
    clay: true,
  };

  try {
    var savedButtonColor = localStorage.getItem("butler-button-color");
    if (savedButtonColor && VALID_BUTTON_COLORS[savedButtonColor]) {
      document.documentElement.setAttribute("data-button-color", savedButtonColor);
    } else {
      document.documentElement.removeAttribute("data-button-color");
    }
  } catch (_) { /* localStorage unavailable */ }
})();
