async function submitJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "La demande a échoué.");
  return result;
}

async function initializeAuthPage() {
  const login = document.getElementById("admin-login-form");
  const setup = document.getElementById("admin-setup-form");
  if (login) {
    const status = await fetch("/api/admin/status", { credentials: "same-origin" }).then((response) => response.json());
    document.getElementById("setup-link-wrap").hidden = status.configured;
    login.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = document.getElementById("auth-error");
      error.textContent = "";
      try {
        await submitJson("/api/admin/login", {
          email: document.getElementById("admin-email").value,
          password: document.getElementById("admin-password").value
        });
        window.location.assign("/index.html");
      } catch (reason) {
        error.textContent = reason.message;
      }
    });
  }
  if (setup) {
    const status = await fetch("/api/admin/status", { credentials: "same-origin" }).then((response) => response.json());
    if (status.configured) {
      window.location.replace("/admin-login.html");
      return;
    }
    setup.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = document.getElementById("setup-error");
      const password = document.getElementById("setup-password").value;
      const confirmation = document.getElementById("setup-password-confirm").value;
      error.textContent = "";
      if (password !== confirmation) {
        error.textContent = "Les deux mots de passe ne correspondent pas.";
        return;
      }
      try {
        await submitJson("/api/admin/setup", {
          email: document.getElementById("setup-email").value,
          password
        });
        window.location.assign("/index.html");
      } catch (reason) {
        error.textContent = reason.message;
      }
    });
  }
}

initializeAuthPage().catch((error) => {
  const target = document.getElementById("auth-error") || document.getElementById("setup-error");
  if (target) target.textContent = error.message;
});
