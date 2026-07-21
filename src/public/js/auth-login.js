// ============================================================
// public/js/auth-login.js
// Drives the two-step email OTP login/signup flow on auth/login.ejs.
//   1. POST /api/auth/request-otp  { name, email } -> n8n emails a code
//   2. POST /api/auth/verify-otp   { email, code }  -> sets session, redirect
// The code itself is never present in this file or in any response
// this page receives — only Butler's backend ever sees it.
//
// If the page was reached via requireAuthPage's redirect (e.g. someone
// tried to open /tasks while logged out), the URL carries
// ?next=<original path>. After a successful login we send them back
// there instead of always landing on /chat.
// ============================================================

(function initAuthLogin() {
  var RESEND_COOLDOWN_SECONDS = 30;

  var emailStep = document.querySelector('[data-auth-step="email"]');
  var codeStep = document.querySelector('[data-auth-step="code"]');
  var emailForm = document.querySelector("[data-email-form]");
  var codeForm = document.querySelector("[data-code-form]");
  var nameInput = document.getElementById("auth-name");
  var emailInput = document.getElementById("auth-email");
  var codeInput = document.getElementById("auth-code");
  var sendButton = document.querySelector("[data-send-code-button]");
  var verifyButton = document.querySelector("[data-verify-button]");
  var backButton = document.querySelector("[data-back-button]");
  var resendButton = document.querySelector("[data-resend-button]");
  var demoLoginButton = document.querySelector("[data-demo-login-button]");
  var errorEmail = document.querySelector("[data-auth-error]");
  var errorCode = document.querySelector("[data-auth-error-code]");
  var codeSentTo = document.querySelector("[data-code-sent-to]");
  var statusEl = document.querySelector("[data-auth-status]");

  if (!emailForm || !codeForm) return;

  var currentEmail = "";
  var currentName = "";
  var resendTimer = null;

  function showError(el, message) {
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || "";
  }

  function parseJson(res) {
    return res.json().then(function (body) {
      return { ok: res.ok, body: body };
    });
  }

  function getRedirectTarget() {
    var params = new URLSearchParams(window.location.search);
    var next = params.get("next");
    // Only ever follow a same-site relative path — never an absolute
    // or protocol-relative URL, so this can't be used to redirect
    // somewhere off Butler.
    if (next && next.charAt(0) === "/" && next.charAt(1) !== "/") {
      return next;
    }
    return "/chat";
  }

  function startResendCooldown() {
    if (!resendButton) return;
    var remaining = RESEND_COOLDOWN_SECONDS;
    resendButton.disabled = true;
    resendButton.textContent = "Resend code (" + remaining + "s)";

    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(resendTimer);
        resendTimer = null;
        resendButton.disabled = false;
        resendButton.textContent = "Resend code";
        return;
      }
      resendButton.textContent = "Resend code (" + remaining + "s)";
    }, 1000);
  }

  function goToCodeStep() {
    if (emailStep) emailStep.hidden = true;
    if (codeStep) codeStep.hidden = false;
    if (codeSentTo) codeSentTo.textContent = "We sent a code to " + currentEmail + ".";
    if (codeInput) {
      codeInput.value = "";
      codeInput.focus();
    }
    showError(errorCode, "");
  }

  function goToEmailStep() {
    if (codeStep) codeStep.hidden = true;
    if (emailStep) emailStep.hidden = false;
    showError(errorEmail, "");
    setStatus("");
    if (resendTimer) {
      clearInterval(resendTimer);
      resendTimer = null;
    }
    if (resendButton) {
      resendButton.disabled = false;
      resendButton.textContent = "Resend code";
    }
  }

  function requestOtp() {
    return fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentEmail, name: currentName }),
    })
      .then(parseJson)
      .then(function (result) {
        if (!result.ok || !result.body.ok) {
          throw new Error((result.body && result.body.error) || "Could not send a code. Try again.");
        }
        return result.body.data;
      });
  }

  emailForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showError(errorEmail, "");

    var email = (emailInput.value || "").trim();
    var name = (nameInput.value || "").trim();
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!EMAIL_RE.test(email)) {
      showError(errorEmail, "Enter a valid email address.");
      return;
    }

    currentEmail = email;
    currentName = name;

    if (sendButton) sendButton.disabled = true;
    setStatus("Sending code...");

    requestOtp()
      .then(function (data) {
        setStatus(data.isNew ? "Welcome! Creating your account..." : "Welcome back!");
        goToCodeStep();
        startResendCooldown();
      })
      .catch(function (err) {
        showError(errorEmail, err.message || "Could not send a code. Try again.");
      })
      .finally(function () {
        if (sendButton) sendButton.disabled = false;
        setStatus("");
      });
  });

  codeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showError(errorCode, "");

    var code = (codeInput.value || "").trim();
    if (!/^\d{4,8}$/.test(code)) {
      showError(errorCode, "Enter the code from your email.");
      return;
    }

    if (verifyButton) verifyButton.disabled = true;
    setStatus("Verifying...");

    fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentEmail, code: code }),
    })
      .then(parseJson)
      .then(function (result) {
        if (!result.ok || !result.body.ok) {
          throw new Error((result.body && result.body.error) || "Incorrect code.");
        }
        setStatus("You're in! Redirecting...");
        window.location.href = getRedirectTarget();
      })
      .catch(function (err) {
        showError(errorCode, err.message || "Incorrect code.");
      })
      .finally(function () {
        if (verifyButton) verifyButton.disabled = false;
      });
  });

  if (backButton) {
    backButton.addEventListener("click", goToEmailStep);
  }

  if (resendButton) {
    resendButton.addEventListener("click", function () {
      if (resendButton.disabled) return;
      resendButton.disabled = true;
      setStatus("Resending code...");

      requestOtp()
        .then(function () {
          setStatus("Code resent — check your email.");
          startResendCooldown();
        })
        .catch(function (err) {
          showError(errorCode, err.message || "Could not resend code.");
          resendButton.disabled = false;
        })
        .finally(function () {
          setTimeout(function () { setStatus(""); }, 2000);
      });
    });
  }

  if (demoLoginButton) {
    demoLoginButton.addEventListener("click", function () {
      showError(errorEmail, "");
      demoLoginButton.disabled = true;
      setStatus("Opening the local demo...");

      fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then(parseJson)
        .then(function (result) {
          if (!result.ok || !result.body.ok) {
            throw new Error((result.body && result.body.error) || "Could not open the local demo.");
          }
          window.location.href = getRedirectTarget();
        })
        .catch(function (err) {
          showError(errorEmail, err.message || "Could not open the local demo.");
          setStatus("");
          demoLoginButton.disabled = false;
        });
    });
  }
})();
