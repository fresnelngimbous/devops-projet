const DEMO_TRACKING_KEY = "fresneltravel-demo-tracking";
const DEMO_REMINDER_KEY = "fresneltravel-demo-reminder";
const DEMO_CHECKINS_KEY = "fresneltravel-demo-checkins";
const demoStops = [
  { name: "Yaoundé · Agence centrale", coordinates: "3.8480, 11.5021", progress: 5 },
  { name: "Mbankomo · point de passage", coordinates: "3.7833, 11.3833", progress: 22 },
  { name: "Boumnyebel · point de passage", coordinates: "3.4330, 10.8730", progress: 47 },
  { name: "Edéa · point de passage", coordinates: "3.8000, 10.1333", progress: 75 },
  { name: "Douala · gare routière", coordinates: "4.0511, 9.7679", progress: 100 }
];
let currentStop = 0;
let gpsTimer = null;

function showPortalToast(message, isError = false) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  container.append(toast);
  window.setTimeout(() => toast.remove(), 4000);
}

async function initializePublicGallery() {
  const section = document.getElementById("photos");
  const grid = document.getElementById("client-image-grid");
  if (!section || !grid) return;
  try {
    const response = await fetch("/api/public/images");
    if (!response.ok) throw new Error("Impossible de charger la galerie.");
    const result = await response.json();
    if (!result.images.length) return;
    section.hidden = false;
    for (const image of result.images) {
      const card = document.createElement("figure");
      card.className = "client-image-card";
      const preview = document.createElement("img");
      preview.src = image.url;
      preview.alt = image.title;
      preview.loading = "lazy";
      const caption = document.createElement("figcaption");
      caption.textContent = image.title;
      card.append(preview, caption);
      grid.append(card);
    }
  } catch (error) {
    console.error("La galerie publique n’a pas pu être chargée.", error);
  }
}

function getTrackingState() {
  try {
    const saved = localStorage.getItem(DEMO_TRACKING_KEY);
    if (!saved) return { active: false, stop: 0, updatedAt: null };
    const parsed = JSON.parse(saved);
    const stop = Number(parsed.stop);
    return {
      active: parsed.active === true,
      stop: Number.isInteger(stop) && stop >= 0 && stop < demoStops.length ? stop : 0,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : null
    };
  } catch (error) {
    console.error("Impossible de lire la position de démonstration.", error);
    return { active: false, stop: 0, updatedAt: null };
  }
}

function saveTrackingState(state) {
  try {
    localStorage.setItem(DEMO_TRACKING_KEY, JSON.stringify(state));
  } catch (error) {
    showPortalToast("Le navigateur ne permet pas d’enregistrer la simulation GPS.", true);
    console.error("Impossible d’enregistrer la position de démonstration.", error);
  }
}

function drawClientTracking() {
  const location = document.getElementById("client-location");
  if (!location) return;
  const state = getTrackingState();
  const stop = demoStops[state.stop];
  location.textContent = state.active ? stop.name : "En attente du partage chauffeur";
  document.getElementById("location-updated").textContent = state.updatedAt
    ? `Mise à jour à ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(state.updatedAt)} · GPS simulé`
    : "Aucune position partagée pour le moment";
  document.getElementById("progress-label").textContent = state.active
    ? state.stop === demoStops.length - 1 ? "Bus arrivé à destination" : `Étape ${state.stop + 1} sur ${demoStops.length}`
    : "Le chauffeur n’a pas encore démarré";
  document.getElementById("route-progress-bar").style.width = `${state.active ? stop.progress : 0}%`;
  document.getElementById("map-progress").style.strokeDasharray = `${state.active ? stop.progress : 0} 100`;
  const marker = document.getElementById("bus-marker");
  const halo = document.getElementById("bus-marker-halo");
  const positions = [[42, 154], [180, 91], [337, 136], [483, 89], [599, 66]];
  const [x, y] = positions[state.stop];
  marker.setAttribute("cx", x);
  marker.setAttribute("cy", y);
  halo.setAttribute("cx", x);
  halo.setAttribute("cy", y);
}

function initializeClientPage() {
  const date = document.querySelector("[data-demo-date]");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formattedDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(tomorrow);
  document.querySelectorAll("[data-demo-departure-date]").forEach((element) => {
    element.textContent = formattedDate;
  });
  if (date) {
    date.textContent = formattedDate;
  }
  const toggle = document.getElementById("reminder-toggle");
  if (toggle) {
    toggle.checked = localStorage.getItem(DEMO_REMINDER_KEY) !== "off";
    toggle.addEventListener("change", () => {
      localStorage.setItem(DEMO_REMINDER_KEY, toggle.checked ? "on" : "off");
      showPortalToast(toggle.checked
        ? "Rappel de démonstration programmé une heure avant le départ."
        : "Rappel de démonstration désactivé.");
    });
  }
  document.getElementById("simulate-reminder")?.addEventListener("click", () => {
    if (!toggle.checked) {
      showPortalToast("Activez le rappel avant de tester sa simulation.", true);
      return;
    }
    showPortalToast("Simulation du rappel 1 h avant : il serait envoyé à nadia@example.com. Aucun e-mail réel n’a été envoyé.");
  });
  drawClientTracking();
  window.setInterval(drawClientTracking, 2000);
  window.addEventListener("storage", (event) => {
    if (event.key === DEMO_TRACKING_KEY) drawClientTracking();
  });
}

function initializeDriverPage() {
  const toggle = document.getElementById("gps-toggle");
  if (!toggle) return;
  const status = document.getElementById("gps-status");
  const location = document.getElementById("driver-location");
  const coordinates = document.getElementById("driver-coordinates");
  const radar = document.querySelector(".gps-radar>span");

  function renderDriver(state) {
    currentStop = state.stop;
    const stop = demoStops[currentStop];
    location.textContent = stop.name;
    coordinates.textContent = `Position fictive · ${stop.coordinates}`;
    status.classList.toggle("active", state.active);
    status.innerHTML = `<i></i> ${state.active ? "PARTAGE ACTIF · SIMULÉ" : "ARRÊTÉ"}`;
    radar.classList.toggle("pulsing", state.active);
    toggle.textContent = state.active ? "Ⅱ Arrêter le partage simulé" : "▶ Démarrer le partage GPS simulé";
    document.getElementById("gps-next").disabled = !state.active;
    document.querySelectorAll(".driver-stop").forEach((stopElement, index) => {
      stopElement.classList.toggle("active", index <= currentStop);
      stopElement.querySelector("i").textContent = index < currentStop ? "✓" : index + 1;
    });
  }

  function updatePosition() {
    const previous = getTrackingState();
    if (!previous.active) return;
    const nextStop = Math.min(previous.stop + 1, demoStops.length - 1);
    const state = { active: true, stop: nextStop, updatedAt: Date.now() };
    saveTrackingState(state);
    renderDriver(state);
    if (nextStop === demoStops.length - 1) {
      window.clearInterval(gpsTimer);
      gpsTimer = null;
      showPortalToast("Simulation : le bus est arrivé à Douala.");
    }
  }

  const saved = getTrackingState();
  renderDriver(saved);
  if (saved.active) {
    gpsTimer = window.setInterval(updatePosition, 8000);
  }
  toggle.addEventListener("click", () => {
    const state = getTrackingState();
    if (state.active) {
      if (gpsTimer) window.clearInterval(gpsTimer);
      gpsTimer = null;
      saveTrackingState({ ...state, active: false, updatedAt: Date.now() });
      renderDriver({ ...state, active: false });
      showPortalToast("Partage GPS simulé arrêté.");
      return;
    }
    const started = { active: true, stop: currentStop, updatedAt: Date.now() };
    saveTrackingState(started);
    renderDriver(started);
    gpsTimer = window.setInterval(updatePosition, 8000);
    showPortalToast("Partage de position simulé activé. Consultez l’espace client.");
  });
  document.getElementById("gps-next").addEventListener("click", () => {
    const state = getTrackingState();
    if (!state.active) {
      showPortalToast("Démarrez le partage GPS simulé avant d’avancer.", true);
      return;
    }
    updatePosition();
  });
  document.getElementById("gps-reset").addEventListener("click", () => {
    if (gpsTimer) window.clearInterval(gpsTimer);
    gpsTimer = null;
    const resetState = { active: false, stop: 0, updatedAt: null };
    saveTrackingState(resetState);
    renderDriver(resetState);
    showPortalToast("Simulation du trajet réinitialisée.");
  });
  window.addEventListener("storage", (event) => {
    if (event.key === DEMO_TRACKING_KEY) renderDriver(getTrackingState());
  });
}

function initializeAgentPage() {
  const table = document.getElementById("agent-passengers");
  if (!table) return;
  const count = document.getElementById("agent-count");
  const boarded = document.getElementById("agent-boarded-count");
  const remaining = document.getElementById("agent-remaining-count");
  const stat = document.getElementById("agent-unboarded-stat");
  const search = document.getElementById("agent-search");

  function setCheckedIn(row, checkedIn) {
    const status = row.querySelector(".checkin-status");
    const button = row.querySelector(".checkin-button");
    status.className = `checkin-status${checkedIn ? " checked-in" : ""}`;
    status.textContent = checkedIn ? "✓ Embarqué" : "À embarquer";
    button.textContent = checkedIn ? "Embarqué" : "Enregistrer";
    button.classList.toggle("done", checkedIn);
    button.disabled = checkedIn;
  }

  function updateCheckinCount() {
    const rows = [...table.querySelectorAll("tr")];
    const checkedIn = rows.filter((row) => row.querySelector(".checkin-status").classList.contains("checked-in")).length;
    const unboarded = rows.length - checkedIn;
    boarded.textContent = checkedIn;
    remaining.textContent = unboarded;
    stat.textContent = unboarded;
    count.textContent = rows.length;
  }

  let savedCheckins = [];
  try {
    const stored = JSON.parse(localStorage.getItem(DEMO_CHECKINS_KEY) || "[]");
    if (Array.isArray(stored)) savedCheckins = stored.filter((name) => typeof name === "string");
  } catch (error) {
    console.error("Impossible de lire les embarquements de démonstration.", error);
  }
  table.querySelectorAll("tr").forEach((row) => {
    const initiallyChecked = row.querySelector(".checkin-status").classList.contains("checked-in");
    setCheckedIn(row, initiallyChecked || savedCheckins.includes(row.dataset.name));
  });
  updateCheckinCount();

  table.querySelectorAll(".checkin-button:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest("tr");
      setCheckedIn(row, true);
      try {
        const checkedIn = [...table.querySelectorAll("tr")]
          .filter((item) => item.querySelector(".checkin-status").classList.contains("checked-in"))
          .map((item) => item.dataset.name);
        localStorage.setItem(DEMO_CHECKINS_KEY, JSON.stringify(checkedIn));
      } catch (error) {
        showPortalToast("Impossible de conserver ce pointage dans le navigateur.", true);
        console.error("Impossible d’enregistrer l’embarquement de démonstration.", error);
      }
      updateCheckinCount();
      showPortalToast(`Embarquement confirmé : ${row.querySelector(".passenger strong").textContent}.`);
    });
  });
  search.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase("fr");
    let visibleCount = 0;
    table.querySelectorAll("tr").forEach((row) => {
      row.hidden = !row.dataset.name.includes(query);
      if (!row.hidden) visibleCount += 1;
    });
    document.getElementById("agent-empty").hidden = visibleCount > 0;
  });
  document.getElementById("agent-reset").addEventListener("click", () => {
    localStorage.removeItem(DEMO_CHECKINS_KEY);
    window.location.reload();
  });
}

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});
initializeClientPage();
initializePublicGallery();
initializeDriverPage();
initializeAgentPage();
