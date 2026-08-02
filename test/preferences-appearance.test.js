// Owner: HeinThuNyiNyi - Automated Testing
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ejs = require("ejs");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function contrastRatio(first, second) {
  function luminance(hex) {
    const channels = hex
      .replace("#", "")
      .match(/.{2}/g)
      .map((part) => parseInt(part, 16) / 255)
      .map((channel) =>
        channel <= 0.03928
          ? channel / 12.92
          : Math.pow((channel + 0.055) / 1.055, 2.4)
      );
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

test("Preferences renders labelled button-colour controls and a live preview", async () => {
  const html = await ejs.renderFile(path.join(root, "src/views/preferences.ejs"), {
    title: "Preferences — Butler",
    lang: "en",
  });
  const options = html.match(/<button\b[\s\S]*?data-button-color-value="[^"]+"[\s\S]*?<\/button>/g) || [];

  assert.match(html, /id="pref-button-color-title">Button color</);
  assert.match(html, /data-button-color-grid/);
  assert.match(html, /Live preview/);
  assert.equal(options.length, 5);
  options.forEach((option) => {
    assert.match(option, /type="button"/);
    assert.match(option, /aria-pressed="false"/);
    assert.match(option, /aria-label="[^"]+"/);
    assert.match(option, /data-button-color-status/);
  });
  ["default", "forest", "ocean", "plum", "clay"].forEach((value) => {
    assert.match(html, new RegExp(`data-button-color-value="${value}"`));
  });
});

test("saved button colour is allow-listed and applied before CSS", () => {
  const source = read("src/public/js/appearance-preload.js");
  const attributes = {};
  const documentElement = {
    setAttribute(name, value) {
      attributes[name] = value;
    },
    removeAttribute(name) {
      delete attributes[name];
    },
  };

  vm.runInNewContext(source, {
    localStorage: { getItem: () => "ocean" },
    document: { documentElement },
  });
  assert.equal(attributes["data-button-color"], "ocean");

  vm.runInNewContext(source, {
    localStorage: { getItem: () => "not-a-palette" },
    document: { documentElement },
  });
  assert.equal(attributes["data-button-color"], undefined);
});

test("appearance preference persists, resets to theme default, and syncs across tabs", () => {
  const preferences = read("src/public/js/preferences.js");
  const shell = read("src/public/js/shell.js");

  assert.match(preferences, /BUTTON_COLOR_STORAGE_KEY = "butler-button-color"/);
  assert.match(preferences, /localStorage\.setItem\(BUTTON_COLOR_STORAGE_KEY, color\)/);
  assert.match(preferences, /localStorage\.removeItem\(BUTTON_COLOR_STORAGE_KEY\)/);
  assert.match(preferences, /setAttribute\("data-button-color", color\)/);
  assert.match(preferences, /removeAttribute\("data-button-color"\)/);
  assert.match(preferences, /setAttribute\("aria-pressed", selected \? "true" : "false"\)/);
  assert.match(shell, /event\.key === "butler-button-color"/);
  assert.match(shell, /window\.addEventListener\("pageshow", applySavedAppearance\)/);
});

test("every standalone page preloads the button colour before the stylesheet", () => {
  [
    "src/views/layout.ejs",
    "src/views/preferences.ejs",
    "src/views/settings.ejs",
    "src/views/billing.ejs",
    "src/views/pricing.ejs",
    "src/views/achievements.ejs",
    "src/views/auth/login.ejs",
  ].forEach((viewPath) => {
    const view = read(viewPath);
    assert.match(
      view,
      /<script src="\/js\/appearance-preload\.js"><\/script>\s*<link rel="stylesheet" href="\/css\/style\.css"/,
      `${viewPath} must preload appearance before CSS`
    );
  });
});

test("button palettes use semantic tokens and keep white button text AA-readable", () => {
  const css = read("src/public/css/style.css");
  const palettes = {
    forest: "#2d4a3e",
    ocean: "#2f5e75",
    plum: "#60405f",
    clay: "#834536",
  };

  Object.entries(palettes).forEach(([name, primary]) => {
    assert.match(css, new RegExp(`html\\[data-button-color="${name}"\\]\\s*\\{`));
    assert.match(css, new RegExp(`--color-primary:\\s*${primary}`, "i"));
    assert.ok(
      contrastRatio(primary, "#ffffff") >= 4.5,
      `${name} primary must meet WCAG AA contrast against white`
    );
  });
  assert.match(css, /\.glass-btn-primary[\s\S]*?background:\s*var\(--color-primary\)/);
  assert.match(css, /\.sidebar-primary[\s\S]*?background:\s*var\(--color-primary\)/);
  assert.match(css, /\.pill-nav-item\.active[\s\S]*?background:\s*var\(--color-primary\)/);
});
