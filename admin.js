const adminShell = document.querySelector(".app-shell");
const adminAccessError = document.getElementById("admin-access-error");
let csrfToken = "";

async function adminRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.method && options.method !== "GET") headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(url, { ...options, headers, credentials: "same-origin" });
  if (response.status === 401) {
    window.location.replace("/admin-login.html");
    throw new Error("Votre session a expiré.");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "La demande a échoué.");
  return result;
}

function renderAdminImages(images) {
  const grid = document.getElementById("admin-image-grid");
  grid.replaceChildren();
  if (images.length === 0) {
    const empty = document.createElement("div");
    empty.className = "gallery-empty";
    empty.textContent = "Aucune photo pour le moment. Ajoutez vos premières images.";
    grid.append(empty);
    return;
  }
  for (const image of images) {
    const card = document.createElement("article");
    card.className = "admin-image-card";
    const preview = document.createElement("img");
    preview.src = image.url;
    preview.alt = image.title;
    preview.loading = "lazy";
    const details = document.createElement("div");
    details.className = "admin-image-details";
    const title = document.createElement("strong");
    title.textContent = image.title;
    const category = document.createElement("small");
    category.textContent = { bus: "Flotte de bus", travel: "Voyage", agency: "Agence et gare" }[image.category];
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "image-delete";
    remove.textContent = "Supprimer";
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Supprimer « ${image.title} » de la galerie ?`)) return;
      try {
        await adminRequest(`/api/admin/images/${encodeURIComponent(image.id)}`, { method: "DELETE" });
        await loadAdminImages();
      } catch (error) {
        window.alert(error.message);
      }
    });
    details.append(title, category, remove);
    card.append(preview, details);
    grid.append(card);
  }
}

async function loadAdminImages() {
  const result = await adminRequest("/api/admin/images");
  renderAdminImages(result.images);
}

async function initializeAdmin() {
  try {
    const session = await adminRequest("/api/admin/session");
    csrfToken = session.csrfToken;
    adminShell.hidden = false;
    await loadAdminImages();
  } catch (error) {
    if (!adminShell.hidden) return;
    adminAccessError.hidden = false;
    adminAccessError.textContent = window.location.protocol === "file:"
      ? "L’administration est protégée par le serveur. Ouvrez http://localhost:8000 puis connectez-vous."
      : error.message;
  }
}

document.getElementById("admin-logout").addEventListener("click", async () => {
  try {
    await adminRequest("/api/admin/logout", { method: "POST" });
    window.location.assign("/connexion.html");
  } catch (error) {
    window.alert(error.message);
  }
});

document.getElementById("image-files").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const files = [...input.files];
  if (files.length > 10) {
    window.alert("Ajoutez au maximum 10 images à la fois.");
    input.value = "";
    return;
  }
  try {
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} dépasse la limite de 5 Mo.`);
      const params = new URLSearchParams({
        category: document.getElementById("image-category").value,
        title: document.getElementById("image-title").value.trim() || file.name.replace(/\.[^.]+$/, "")
      });
      await adminRequest(`/api/admin/images?${params}`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file
      });
    }
    input.value = "";
    await loadAdminImages();
  } catch (error) {
    window.alert(error.message);
  }
});

initializeAdmin();
