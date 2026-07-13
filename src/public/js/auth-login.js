// ============================================================
// public/js/auth-login.js
// Drives the two-step email + OTP flow on auth/login.ejs.
// Step 1: POST /api/auth/request-otp  { email, name }
// Step 2: POST /api/auth/verify-otp   { email, code }
// On success, the server sets the session cookie and this script
// redirects to nextUrl (defaults to /chat).
// ============================================================

(function initLogin() {
  var nextUrl = (window.__BUTLER_LOGIN__ && window.__BUTLER_LOGIN__.nextUrl) || "/chat";

  var emailStep = document.querySelector('[data-step="email"]');
  var codeStep = document.querySelector('[data-step="code"]');
  var emailForm = document.querySelector("[data-email-form]");
  var codeForm = document.querySelector("[data-code-form]");
  var emailError = document.querySelector("[data-email-error]");
  var codeError = document.querySelector("[data-code-error]");
  var emailSubmit = document.querySelector("[data-email-submit]");
  var codeSubmit = document.querySelector("[data-code-submit]");
  var codeEmailLabel = document.querySelector("[data-code-email]");
  var changeEmailBtn = document.querySelector("[data-change-email]");
  var resendBtn = document.querySelector("[data-resend-code]");

  if (!emailForm || !codeForm || !window.ButlerApi) return;

  var state = { email: "", name: "" };
  var resendTimer = null;

  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? "Please wait…" : label;
  }

  function startResendCooldown(seconds) {
    if (!resendBtn) return;
    var remaining = seconds;
    resendBtn.disabled = true;
    resendBtn.textContent = "Resend code (" + remaining + "s)";

    clearInterval(resendTimer);
    resendTimer = setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(resendTimer);
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend code";
        return;
      }
      resendBtn.textContent = "Resend code (" + remaining + "s)";
    }, 1000);
  }

  function goToCodeStep() {
    emailStep.hidden = true;
    codeStep.hidden = false;
    if (codeEmailLabel) codeEmailLabel.textContent = state.email;
    var codeInput = codeForm.querySelector('input[name="code"]');
    if (codeInput) {
      codeInput.value = "";
      codeInput.focus();
    }
  }

  function goToEmailStep() {
    codeStep.hidden = true;
    emailStep.hidden = false;
    showError(codeError, "");
    clearInterval(resendTimer);
  }

  async function requestOtp(email, name) {
    return window.ButlerApi.post("/auth/request-otp", { email: email, name: name });
  }

  emailForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    showError(emailError, "");

    var email = String(emailForm.email.value || "").trim();
    var name = String(emailForm.name.value || "").trim();

    if (!email) {
      showError(emailError, "Enter your email address.");
      return;
    }

    setBusy(emailSubmit, true);
    try {
      await requestOtp(email, name);
      state.email = email;
      state.name = name;
      goToCodeStep();
      startResendCooldown(30);
    } catch (err) {
      showError(emailError, err.message || "Could not send the code. Try again.");
    } finally {
      setBusy(emailSubmit, false, "Send code");
    }
  });

  codeForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    showError(codeError, "");

    var code = String(codeForm.code.value || "").trim();
    if (!code) {
      showError(codeError, "Enter the 6-digit code.");
      return;
    }

    setBusy(codeSubmit, true);
    try {
      await window.ButlerApi.post("/auth/verify-otp", { email: state.email, code: code });
      window.location.href = nextUrl;
    } catch (err) {
      showError(codeError, err.message || "That code didn't work. Try again.");
      setBusy(codeSubmit, false, "Verify & sign in");
    }
  });

  if (changeEmailBtn) {
    changeEmailBtn.addEventListener("click", goToEmailStep);
  }

  if (resendBtn) {
    resendBtn.addEventListener("click", async function () {
      if (resendBtn.disabled) return;
      showError(codeError, "");
      try {
        await requestOtp(state.email, state.name);
        startResendCooldown(30);
      } catch (err) {
        showError(codeError, err.message || "Could not resend the code.");
      }
    });
  }
})();
