const routes = {
  "Yaoundé|Douala": { price: 18000, duration: "3 h 30" },
  "Douala|Yaoundé": { price: 18000, duration: "3 h 30" },
  "Douala|Bafoussam": { price: 12000, duration: "4 h 00" },
  "Bafoussam|Douala": { price: 12000, duration: "4 h 00" },
  "Yaoundé|Bafoussam": { price: 15000, duration: "4 h 30" },
  "Bafoussam|Yaoundé": { price: 15000, duration: "4 h 30" },
  "Yaoundé|Bertoua": { price: 18000, duration: "5 h 00" },
  "Bertoua|Yaoundé": { price: 18000, duration: "5 h 00" },
  "Douala|Kribi": { price: 8000, duration: "2 h 30" },
  "Kribi|Douala": { price: 8000, duration: "2 h 30" },
  "Yaoundé|Kribi": { price: 10000, duration: "3 h 00" },
  "Kribi|Yaoundé": { price: 10000, duration: "3 h 00" },
  "Douala|Bamenda": { price: 15000, duration: "5 h 00" },
  "Bamenda|Douala": { price: 15000, duration: "5 h 00" },
  "Yaoundé|Garoua": { price: 35000, duration: "10 h 00" },
  "Garoua|Yaoundé": { price: 35000, duration: "10 h 00" },
  "Douala|Limbe": { price: 5000, duration: "1 h 30" },
  "Limbe|Douala": { price: 5000, duration: "1 h 30" },
  "Yaoundé|Ebolowa": { price: 8000, duration: "2 h 30" },
  "Ebolowa|Yaoundé": { price: 8000, duration: "2 h 30" },
  "Yaoundé|Bamenda": { price: 25000, duration: "7 h 00" },
  "Bamenda|Yaoundé": { price: 25000, duration: "7 h 00" },
  "Douala|Buea": { price: 5000, duration: "1 h 30" },
  "Buea|Douala": { price: 5000, duration: "1 h 30" },
  "Douala|Edea": { price: 5000, duration: "1 h 30" },
  "Edea|Douala": { price: 5000, duration: "1 h 30" },
  "Bafoussam|Bamenda": { price: 10000, duration: "2 h 30" },
  "Bamenda|Bafoussam": { price: 10000, duration: "2 h 30" },
  "Yaoundé|Ngaoundéré": { price: 30000, duration: "8 h 00" },
  "Ngaoundéré|Yaoundé": { price: 30000, duration: "8 h 00" },
  "Ngaoundéré|Garoua": { price: 16000, duration: "4 h 00" },
  "Garoua|Ngaoundéré": { price: 16000, duration: "4 h 00" },
  "Garoua|Maroua": { price: 12000, duration: "3 h 00" },
  "Maroua|Garoua": { price: 12000, duration: "3 h 00" }
};

const modal = document.getElementById("booking-modal");
const routeSelect = document.getElementById("departure-city");
const arrivalSelect = document.getElementById("arrival-city");
const dateInput = document.getElementById("travel-date");
const tripsContainer = document.getElementById("available-trips");
const routeError = document.getElementById("route-error");
let matchingTrips = [];
let selectedTrip = null;
let selectedSeat = null;
let bookingCode = "";
let reservations = 248;
const reservedSeats = new Map();

const pad = (value) => String(value).padStart(2, "0");
const today = new Date();
dateInput.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
dateInput.value = dateInput.min;
document.getElementById("current-date").textContent = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short", day: "numeric", month: "short"
}).format(today);
document.getElementById("footer-year").textContent = today.getFullYear();

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  document.getElementById("toast-container").append(toast);
  window.setTimeout(() => toast.remove(), 3700);
}

function setStep(step) {
  document.getElementById("step-route").hidden = step !== 1;
  document.getElementById("step-passenger").hidden = step !== 2;
  document.getElementById("step-success").hidden = step !== 3;
  document.querySelectorAll("[data-step-indicator]").forEach((indicator) => {
    const number = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle("active", number === step);
    indicator.classList.toggle("done", number < step);
  });
  document.querySelector(".booking-steps").hidden = step === 3;
}

function openModal() {
  routeError.textContent = "";
  document.getElementById("passenger-error").textContent = "";
  tripsContainer.replaceChildren();
  matchingTrips = [];
  selectedTrip = null;
  selectedSeat = null;
  document.getElementById("find-trips").innerHTML = 'Rechercher les départs <span>→</span>';
  setStep(1);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

document.getElementById("new-booking").addEventListener("click", openModal);
document.getElementById("close-modal").addEventListener("click", closeModal);
document.getElementById("finish-booking").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("open")) closeModal();
});

document.getElementById("swap-cities").addEventListener("click", () => {
  const departure = routeSelect.value;
  routeSelect.value = arrivalSelect.value;
  arrivalSelect.value = departure;
});

function resetTripSearch() {
  matchingTrips = [];
  selectedTrip = null;
  selectedSeat = null;
  tripsContainer.replaceChildren();
  document.getElementById("find-trips").innerHTML = 'Rechercher les départs <span>→</span>';
}
routeSelect.addEventListener("change", resetTripSearch);
arrivalSelect.addEventListener("change", resetTripSearch);
dateInput.addEventListener("change", resetTripSearch);
document.getElementById("swap-cities").addEventListener("click", resetTripSearch);

function searchTrips() {
  const departure = routeSelect.value;
  const arrival = arrivalSelect.value;
  routeError.textContent = "";
  tripsContainer.replaceChildren();
  matchingTrips = [];
  selectedTrip = null;

  if (departure === arrival) {
    routeError.textContent = "Les villes de départ et d’arrivée doivent être différentes.";
    return;
  }
  if (!dateInput.value || dateInput.value < dateInput.min) {
    routeError.textContent = "Choisissez une date de voyage valide.";
    return;
  }

  const route = routes[`${departure}|${arrival}`];
  if (!route) {
    tripsContainer.innerHTML = '<div class="trip-empty">Aucun départ disponible sur cette ligne pour le moment. Choisissez un autre trajet.</div>';
    return;
  }

  matchingTrips = [
    { time: "08:00", type: "Express", baseSeats: 13, capacity: 45, price: route.price },
    { time: "10:30", type: "Confort", baseSeats: 21, capacity: 45, price: route.price + 2000 },
    { time: "14:00", type: "VIP", baseSeats: 7, capacity: 32, price: route.price + 5000 }
  ].map((trip) => {
    const key = `${dateInput.value}|${departure}|${arrival}|${trip.time}`;
    const bookedSeats = reservedSeats.get(key) || new Set();
    return { ...trip, key, seats: trip.baseSeats - bookedSeats.size };
  }).filter((trip) => trip.seats > 0);

  if (matchingTrips.length === 0) {
    tripsContainer.innerHTML = '<div class="trip-empty">Tous les départs sont complets pour cette ligne et cette date.</div>';
    return;
  }

  matchingTrips.forEach((trip, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "trip-option";
    option.innerHTML = `<span class="trip-time">${trip.time}</span><span class="trip-detail">${trip.type}<small>${route.duration} · Départ de la gare routière</small></span><span class="trip-price">${trip.price.toLocaleString("fr-FR")} FCFA<small>${trip.seats} places disponibles</small></span>`;
    option.addEventListener("click", () => {
      selectedTrip = trip;
      tripsContainer.querySelectorAll(".trip-option").forEach((item) => item.classList.remove("selected"));
      option.classList.add("selected");
    });
    if (index === 0) {
      selectedTrip = trip;
      option.classList.add("selected");
    }
    tripsContainer.append(option);
  });
  document.getElementById("find-trips").innerHTML = 'Continuer avec ce départ <span>→</span>';
}

document.getElementById("find-trips").addEventListener("click", () => {
  if (matchingTrips.length === 0) {
    searchTrips();
    return;
  }
  if (!selectedTrip) {
    routeError.textContent = "Sélectionnez un départ avant de continuer.";
    return;
  }
  document.getElementById("selected-trip").innerHTML = `<div class="trip-option selected"><span class="trip-time">${selectedTrip.time}</span><span class="trip-detail">${routeSelect.value} → ${arrivalSelect.value}<small>${selectedTrip.type} · ${routes[`${routeSelect.value}|${arrivalSelect.value}`].duration}</small></span><span class="trip-price">${selectedTrip.price.toLocaleString("fr-FR")} FCFA</span></div>`;
  drawSeats();
  setStep(2);
});
document.getElementById("back-to-route").addEventListener("click", () => {
  setStep(1);
  document.getElementById("find-trips").innerHTML = matchingTrips.length ? 'Continuer avec ce départ <span>→</span>' : 'Rechercher les départs <span>→</span>';
});

function drawSeats() {
  const layout = document.getElementById("seat-layout");
  layout.replaceChildren();
  const alreadyBooked = reservedSeats.get(selectedTrip.key) || new Set();
  const initiallyOccupied = selectedTrip.capacity - selectedTrip.baseSeats;
  for (let seatNumber = 1; seatNumber <= selectedTrip.capacity; seatNumber += 1) {
    if (seatNumber % 4 === 3) {
      const aisle = document.createElement("span");
      aisle.className = "seat-aisle";
      layout.append(aisle);
    }
    const seat = document.createElement("button");
    seat.type = "button";
    const occupied = seatNumber <= initiallyOccupied || alreadyBooked.has(seatNumber);
    seat.className = `seat${occupied ? " occupied" : ""}`;
    seat.textContent = `A${pad(seatNumber)}`;
    seat.disabled = occupied;
    seat.setAttribute("aria-label", `Siège A${pad(seatNumber)}${occupied ? ", occupé" : ""}`);
    seat.addEventListener("click", () => {
      layout.querySelectorAll(".seat.selected").forEach((item) => item.classList.remove("selected"));
      seat.classList.add("selected");
      selectedSeat = seat.textContent;
    });
    layout.append(seat);
  }
}

document.getElementById("back-to-route").addEventListener("click", () => setStep(1));
document.getElementById("confirm-booking").addEventListener("click", () => {
  const name = document.getElementById("passenger-name").value.trim();
  const email = document.getElementById("passenger-email").value.trim();
  const phone = document.getElementById("passenger-phone").value.trim();
  const error = document.getElementById("passenger-error");
  error.textContent = "";
  if (name.length < 2) {
    error.textContent = "Saisissez le nom complet du passager.";
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error.textContent = "Saisissez une adresse e-mail valide pour recevoir le billet.";
    return;
  }
  if (!/^\+?[\d\s().-]{8,20}$/.test(phone)) {
    error.textContent = "Saisissez un numéro de téléphone valide.";
    return;
  }
  if (!selectedSeat) {
    error.textContent = "Choisissez un siège pour continuer.";
    return;
  }
  const bookedSeats = reservedSeats.get(selectedTrip.key) || new Set();
  const seatNumber = Number(selectedSeat.slice(1));
  if (seatNumber <= selectedTrip.capacity - selectedTrip.baseSeats || bookedSeats.has(seatNumber)) {
    error.textContent = "Ce siège vient d’être réservé. Choisissez une autre place.";
    drawSeats();
    return;
  }

  reservations += 1;
  bookedSeats.add(seatNumber);
  reservedSeats.set(selectedTrip.key, bookedSeats);
  bookingCode = `FT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const date = new Date(`${dateInput.value}T12:00:00`);
  const dateLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date);
  document.getElementById("ticket-preview").innerHTML = `
    <div class="ticket-top"><span class="ticket-brand">fresneltravel</span><span class="ticket-code">${bookingCode}</span></div>
    <div class="ticket-route">${routeSelect.value}<span>→</span>${arrivalSelect.value}</div>
    <div class="ticket-meta"><span><small>Passager</small><strong>${escapeHtml(name)}</strong></span><span><small>Date · Départ</small><strong>${dateLabel} · ${selectedTrip.time}</strong></span><span><small>Siège</small><strong>${selectedSeat}</strong></span></div>
  `;
  document.getElementById("success-copy").textContent = `Merci ${name}. Votre place est réservée et votre billet est prêt à être envoyé à ${email}.`;
  document.getElementById("stat-bookings").innerHTML = `${reservations} <span class="trend">↗ 13,2%</span>`;
  document.getElementById("reservation-count").textContent = reservations - 240;
  document.querySelector(".reservation-count").textContent = reservations - 240;
  const row = document.createElement("tr");
  row.dataset.search = `${name} ${email} ${routeSelect.value} ${arrivalSelect.value}`.toLocaleLowerCase("fr");
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0].toLocaleUpperCase("fr")).join("");
  const avatarColors = ["avatar-purple", "avatar-pink", "avatar-blue", "avatar-green", "avatar-yellow"];
  const avatarClass = avatarColors[reservations % avatarColors.length];
  row.innerHTML = `<td><div class="passenger"><span class="avatar ${avatarClass}">${escapeHtml(initials)}</span><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(email)}</small></span></div></td><td>${escapeHtml(routeSelect.value)} <span class="table-arrow">→</span> ${escapeHtml(arrivalSelect.value)}</td><td>${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date)} · ${selectedTrip.time}</td><td><span class="seat-tag">${selectedSeat}</span></td><td>${selectedTrip.price.toLocaleString("fr-FR")} <small>FCFA</small></td><td><span class="table-status issued">✓ Billet émis</span></td><td><button class="row-more" aria-label="Options pour ${escapeHtml(name)}">···</button></td>`;
  document.getElementById("reservation-rows").prepend(row);
  row.querySelector(".row-more").addEventListener("click", () => showToast("Le billet de ce passager est disponible dans son dossier client."));
  const searchQuery = searchInput.value.trim().toLocaleLowerCase("fr");
  if (searchQuery && !row.dataset.search.includes(searchQuery)) row.hidden = true;
  else document.getElementById("visible-count").textContent = Number(document.getElementById("visible-count").textContent) + 1;
  document.querySelector("#reservation-rows tr:not([hidden])")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setStep(3);
});

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

document.getElementById("email-ticket").addEventListener("click", () => {
  const email = document.getElementById("passenger-email").value.trim();
  const name = document.getElementById("passenger-name").value.trim();
  const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dateInput.value}T12:00:00`));
  const subject = encodeURIComponent(`Votre billet FresnelTravel · ${bookingCode}`);
  const body = encodeURIComponent(`Bonjour ${name},\n\nVotre billet FresnelTravel est confirmé !\n\nRéférence : ${bookingCode}\nTrajet : ${routeSelect.value} → ${arrivalSelect.value}\nDate : ${date} à ${selectedTrip.time}\nSiège : ${selectedSeat}\nPrix : ${selectedTrip.price.toLocaleString("fr-FR")} FCFA\n\nPrésentez-vous à la gare 30 minutes avant le départ.\n\nBon voyage avec FresnelTravel !`);
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  showToast("Votre application e-mail va s’ouvrir avec le billet prérempli.");
});

const searchInput = document.getElementById("reservation-search");
searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLocaleLowerCase("fr");
  let visible = 0;
  document.querySelectorAll("#reservation-rows tr").forEach((row) => {
    const match = row.dataset.search.includes(query);
    row.hidden = !match;
    if (match) visible += 1;
  });
  document.getElementById("visible-count").textContent = visible;
  document.getElementById("empty-search").hidden = visible !== 0;
});

document.getElementById("filter-button").addEventListener("click", () => showToast("Les réservations sont affichées : les plus récentes d’abord."));
document.querySelectorAll(".row-more").forEach((button) => {
  button.addEventListener("click", () => showToast("Le billet de ce passager est disponible dans son dossier client."));
});
document.getElementById("notification-button").addEventListener("click", () => {
  const popover = document.getElementById("notification-popover");
  popover.hidden = !popover.hidden;
});
document.getElementById("close-notifications").addEventListener("click", () => {
  document.getElementById("notification-popover").hidden = true;
});
document.getElementById("mobile-menu").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("mobile-open");
});
document.querySelectorAll("[data-section], [data-section-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const name = link.dataset.section || link.dataset.sectionLink;
    const target = document.getElementById(name) || document.getElementById("overview");
    if (!document.getElementById(name)) showToast(`La rubrique « ${link.textContent.trim()} » sera disponible dans votre espace de gestion.`);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.toggle("active", item.dataset.section === name));
    document.getElementById("sidebar").classList.remove("mobile-open");
  });
});

document.querySelectorAll("[data-bus-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const row = button.closest(".fleet-row");
    const status = row.querySelector(".fleet-status");
    const isPaused = button.classList.toggle("paused");
    button.textContent = isPaused ? "▶" : "Ⅱ";
    button.setAttribute("aria-label", `${isPaused ? "Remettre" : "Mettre"} le bus ${row.querySelector(".fleet-bus strong").childNodes[0].textContent.trim()} ${isPaused ? "en service" : "en pause"}`);
    status.textContent = isPaused ? "En pause" : "En service";
    status.className = `fleet-status ${isPaused ? "paused-status" : "service"}`;
    showToast(isPaused ? "Bus mis en pause dans la flotte." : "Bus remis en service.");
  });
});
