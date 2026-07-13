// ============================================================
// public/js/settings.js
// Settings page (Task 6): profile form + avatar upload preview.
// Shows an instant client-side preview (FileReader) before the
// upload round-trip completes, then swaps to the real hosted URL.
// ============================================================

(function initSettings() {
  var MAX_BYTES = 2 * 1024 * 1024; // 2MB, mirrors server-side limit
  var ALLOWED_TYPES = {
    "image/png": true,
    "image/jpeg": true,
    "image/webp": true,
    "image/gif": true,
  };

  var avatarInput = document.getElementById("avatar-input");
  var avatarTrigger = document.querySelector("[data-avatar-trigger]");
  var avatarPreview = document.querySelector("[data-avatar-preview]");
  var avatarError = document.querySelector("[data-avatar-error]");
  var form = document.querySelector("[data-settings-form]");
  var saveButton = document.querySelector("[data-save-button]");
  var saveStatus = document.querySelector("[data-save-status]");

  function setAvatarError(message) {
    if (avatarError) avatarError.textContent = message || "";
  }

  function renderAvatarImage(src) {
    if (!avatarPreview) return;
    avatarPreview.innerHTML = "";
    var img = document.createElement("img");
    img.src = src;
    img.alt = "";
    avatarPreview.appendChild(img);
  }

  function parseJsonResponse(res) {
    return res.json().then(function (body) {
      return { ok: res.ok, body: body };
    });
  }

  if (avatarTrigger && avatarInput) {
    avatarTrigger.addEventListener("click", function () {
      avatarInput.click();
    });
  }

  if (avatarInput) {
    avatarInput.addEventListener("change", function () {
      setAvatarError("");
      var file = avatarInput.files && avatarInput.files[0];
      if (!file) return;

      if (!ALLOWED_TYPES[file.type]) {
        setAvatarError("Only PNG, JPEG, WEBP or GIF images are allowed.");
        avatarInput.value = "";
        return;
      }
      if (file.size > MAX_BYTES) {
        setAvatarError("Image is too large. Max size is 2MB.");
        avatarInput.value = "";
        return;
      }

      // Instant local preview before the network round-trip.
      var reader = new FileReader();
      reader.onload = function (event) {
        renderAvatarImage(event.target.result);
      };
      reader.readAsDataURL(file);

      // Upload in the background; swap to the real hosted URL on success.
      var formData = new FormData();
      formData.append("avatar", file);

      fetch("/api/profile/avatar", { method: "POST", body: formData })
        .then(parseJsonResponse)
        .then(function (result) {
          if (!result.ok || !result.body.ok) {
            throw new Error((result.body && result.body.error) || "Upload failed.");
          }
          renderAvatarImage(result.body.data.avatarUrl);
        })
        .catch(function (err) {
          setAvatarError(err.message || "Upload failed.");
        });
    });
  }

  if (form) {
    var nameInput = document.getElementById("settings-name");
    var emailInput = document.getElementById("settings-email");
    var nameError = document.querySelector('[data-error-for="name"]');
    var emailError = document.querySelector('[data-error-for="email"]');
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (nameError) nameError.textContent = "";
      if (emailError) emailError.textContent = "";
      if (saveStatus) saveStatus.textContent = "";

      var name = (nameInput.value || "").trim();
      var email = (emailInput.value || "").trim();
      var hasError = false;

      if (!name) {
        if (nameError) nameError.textContent = "Name cannot be empty.";
        hasError = true;
      }
      // Email is read-only once logged in (it's the verified login
      // identity) — skip validating a field the user can't edit.
      if (!emailInput.hasAttribute("readonly") && !EMAIL_RE.test(email)) {
        if (emailError) emailError.textContent = "Enter a valid email address.";
        hasError = true;
      }
      if (hasError) return;

      if (saveButton) saveButton.disabled = true;
      if (saveStatus) saveStatus.textContent = "Saving...";

      fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, email: email }),
      })
        .then(parseJsonResponse)
        .then(function (result) {
          if (!result.ok || !result.body.ok) {
            throw new Error((result.body && result.body.error) || "Could not save changes.");
          }
          if (saveStatus) saveStatus.textContent = "Saved.";
        })
        .catch(function (err) {
          if (saveStatus) saveStatus.textContent = err.message || "Could not save changes.";
        })
        .finally(function () {
          if (saveButton) saveButton.disabled = false;
        });
    });
  }
})();
