/* ============ CONFIG ============ */
const API = "/api/workouts";
const RACE_DATE = new Date("2026-11-08T00:00:00");
const SPORT_LABELS = { course: "Course", velo: "Vélo", muscu: "Muscu", natation: "Natation" };
const SPORT_COLORS = { course: "#00E5FF", velo: "#39FF14", muscu: "#FF3D71", natation: "#00F5D4" };
const ELECTRIC_ACCENT = "#D4FF00";
const ELECTRIC_GOLD = "#FFD60A";
const ELECTRIC_TEXT = "#F4F6FB";
const ELECTRIC_FAINT = "#5D6684";

let sessions = [];
let sleepEntries = [];
let mealEntries = [];
let currentFilterSport = "all";
let planningMode = "week"; // 'week' | 'month'
let planningAnchor = new Date(); // reference date for nav

/* ============ HELPERS ============ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
}
function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ============ API ============ */
async function apiList() {
  const res = await fetch(API);
  if (!res.ok) throw new Error("Erreur de chargement");
  return res.json();
}
async function apiCreate(data) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Erreur de création");
  return res.json();
}
async function apiUpdate(data) {
  const res = await fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Erreur de mise à jour");
  return res.json();
}
async function apiDelete(id) {
  const res = await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Erreur de suppression");
}

/* ===== Generic CRUD factory for sleep / nutrition ===== */
function makeApi(endpoint) {
  return {
    list: async () => {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Erreur de chargement");
      return res.json();
    },
    create: async (data) => {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Erreur de création");
      return res.json();
    },
    update: async (data) => {
      const res = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Erreur de mise à jour");
      return res.json();
    },
    delete: async (id) => {
      const res = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Erreur de suppression");
    },
  };
}
const sleepApi = makeApi("/api/sleep");
const mealApi = makeApi("/api/nutrition");

/* ============ LOAD & BOOT ============ */
async function loadAll() {
  try {
    [sessions, sleepEntries, mealEntries] = await Promise.all([apiList(), sleepApi.list(), mealApi.list()]);
  } catch (e) {
    console.error(e);
    toast("Impossible de charger les données");
    sessions = sessions || [];
    sleepEntries = sleepEntries || [];
    mealEntries = mealEntries || [];
  }
  renderAll();
}

function renderAll() {
  renderCountdown();
  renderWeekSummary();
  renderDashboardLists();
  renderPlanningView();
  renderJournal();
  renderProgression();
  renderSleep();
  renderNutrition();
}

/* ============ COUNTDOWN ============ */
function renderCountdown() {
  const now = new Date();
  const diffMs = RACE_DATE - now;
  const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  $("#cd-days").textContent = days;
}

/* ============ WEEK SUMMARY ============ */
function renderWeekSummary() {
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const weekSessions = sessions.filter((s) => {
    const d = new Date(s.date + "T00:00:00");
    return d >= start && d < end;
  });

  const sports = ["course", "velo", "muscu", "natation"];
  const el = $("#week-summary");
  el.innerHTML = "";

  sports.forEach((sport) => {
    const items = weekSessions.filter((s) => s.sport === sport);
    const done = items.filter((s) => s.status === "realise");
    const planned = items.filter((s) => s.status === "planifie");
    const km = done.reduce((sum, s) => sum + (parseFloat(s.distance) || 0), 0);

    const card = document.createElement("div");
    card.className = "week-card";
    card.style.setProperty("--sport-color", SPORT_COLORS[sport]);
    card.innerHTML = `
      <div class="wk-label">${SPORT_LABELS[sport]} · cette semaine</div>
      <div class="wk-value">${km > 0 ? km.toFixed(1) + " km" : done.length + "/" + items.length}</div>
      <div class="wk-sub">${done.length} réalisée${done.length > 1 ? "s" : ""} · ${planned.length} planifiée${planned.length > 1 ? "s" : ""}</div>
    `;
    el.appendChild(card);
  });
}

/* ============ SESSION ITEM RENDERING ============ */
function sessionItemHTML(s) {
  const metaParts = [];
  if (s.distance) metaParts.push(`${s.distance} km`);
  if (s.duree) metaParts.push(`${s.duree} min`);
  if (s.status === "realise" && s.allure) metaParts.push(s.allure);
  const statusLabel = { planifie: "Planifiée", realise: "Réalisée", annulee: "Annulée" }[s.status] || s.status;
  return `
    <div class="session-item ${s.status === "annulee" ? "is-cancelled" : ""}" data-id="${s.id}">
      <span class="tag ${s.sport}">${SPORT_LABELS[s.sport]}</span>
      <div class="si-main">
        <div class="si-type">${escapeHtml(s.type || "Séance")}</div>
        <div class="si-meta">${metaParts.join(" · ") || "—"}</div>
      </div>
      <span class="si-date">${fmtDate(s.date)}</span>
      <span class="si-status ${s.status}">${statusLabel}</span>
    </div>
  `;
}
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}
function bindSessionClicks(container) {
  container.querySelectorAll(".session-item").forEach((el) => {
    el.addEventListener("click", () => openEdit(el.dataset.id));
  });
}

/* ============ DASHBOARD LISTS ============ */
function renderDashboardLists() {
  const upcoming = sessions
    .filter((s) => s.status === "planifie")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const recent = sessions
    .filter((s) => s.status === "realise")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  const nextEl = $("#dash-next");
  nextEl.innerHTML = upcoming.length ? upcoming.map(sessionItemHTML).join("") : emptyState("Aucune séance planifiée.");
  bindSessionClicks(nextEl);

  const recentEl = $("#dash-recent");
  recentEl.innerHTML = recent.length ? recent.map(sessionItemHTML).join("") : emptyState("Aucune séance enregistrée.");
  bindSessionClicks(recentEl);
}
function emptyState(msg) {
  return `<div class="empty-state">${msg}</div>`;
}

/* ============ PLANNING VIEW (semaine / mois) ============ */
function renderPlanningView() {
  if (planningMode === "week") {
    $("#planning-week").style.display = "";
    $("#planning-month").style.display = "none";
    renderPlanningWeek();
  } else {
    $("#planning-week").style.display = "none";
    $("#planning-month").style.display = "";
    renderPlanningMonth();
  }
}

function sessionsOnDate(iso) {
  return sessions.filter((s) => s.date === iso);
}

function renderPlanningWeek() {
  const start = startOfWeek(planningAnchor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const todayIso = isoToday();

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  $("#nav-label").textContent = `${start.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`;

  const el = $("#planning-week");
  el.innerHTML = days
    .map((d) => {
      const iso = d.toISOString().slice(0, 10);
      const items = sessionsOnDate(iso);
      const isToday = iso === todayIso;
      const dayLabel = d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
      const itemsHtml = items.length
        ? items
            .map(
              (s) => `
          <div class="mini-item ${s.status === "annulee" ? "is-cancelled" : ""}" data-id="${s.id}" style="border-left-color:${colorForKind(s.sport)}">
            <div class="mi-sport" style="color:${colorForKind(s.sport)}">${SPORT_LABELS[s.sport]}${s.status === "annulee" ? " · annulée" : ""}</div>
            <div class="mi-type">${escapeHtml(s.type || "")}</div>
          </div>`
            )
            .join("")
        : "";
      return `<div class="week-col ${isToday ? "is-today" : ""}">
        <div class="week-col-head">${dayLabel}</div>
        ${itemsHtml}
      </div>`;
    })
    .join("");

  el.querySelectorAll(".mini-item").forEach((it) => {
    it.addEventListener("click", () => openEdit(it.dataset.id));
  });
}

function colorForKind(sport) {
  return SPORT_COLORS[sport] || ELECTRIC_ACCENT;
}

function renderPlanningMonth() {
  const year = planningAnchor.getFullYear();
  const month = planningAnchor.getMonth();
  $("#nav-label").textContent = planningAnchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeek(firstOfMonth);
  const todayIso = isoToday();

  const headers = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    .map((h) => `<div class="month-head-cell">${h}</div>`)
    .join("");

  let cells = "";
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const outside = d.getMonth() !== month;
    const isToday = iso === todayIso;
    const items = sessionsOnDate(iso);
    const dots = items
      .slice(0, 4)
      .map((s) => `<span class="mc-dot ${s.status === "annulee" ? "is-cancelled" : ""}" style="background:${colorForKind(s.sport)}"></span>`)
      .join("");
    cells += `<div class="month-cell ${outside ? "outside" : ""} ${isToday ? "is-today" : ""}" data-date="${iso}">
      <div class="mc-daynum">${d.getDate()}</div>
      <div class="mc-dots">${dots}</div>
    </div>`;
    if (i === 41 && d.getMonth() === month) {
      // ensure at least full weeks covering month end (loop already covers 6 rows)
    }
  }

  $("#planning-month").innerHTML = headers + cells;
  $("#planning-month").querySelectorAll(".month-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      const iso = cell.dataset.date;
      const items = sessionsOnDate(iso);
      if (items.length === 1) {
        openEdit(items[0].id);
      } else if (items.length > 1) {
        planningAnchor = new Date(iso + "T00:00:00");
        planningMode = "week";
        $$("#planning-toggle button").forEach((b) => b.classList.toggle("active", b.dataset.mode === "week"));
        renderPlanningView();
      } else {
        openNew("planifie", iso);
      }
    });
  });
}

$("#planning-toggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  planningMode = btn.dataset.mode;
  $$("#planning-toggle button").forEach((b) => b.classList.toggle("active", b === btn));
  renderPlanningView();
});
$("#nav-prev").addEventListener("click", () => {
  planningAnchor = shiftDate(planningAnchor, planningMode === "week" ? -7 : -1, planningMode === "month");
  renderPlanningView();
});
$("#nav-next").addEventListener("click", () => {
  planningAnchor = shiftDate(planningAnchor, planningMode === "week" ? 7 : 1, planningMode === "month");
  renderPlanningView();
});
$("#nav-today").addEventListener("click", () => {
  planningAnchor = new Date();
  renderPlanningView();
});
function shiftDate(base, amount, isMonth) {
  const d = new Date(base);
  if (isMonth) d.setMonth(d.getMonth() + amount);
  else d.setDate(d.getDate() + amount);
  return d;
}

/* ============ JOURNAL VIEW ============ */
function renderJournal() {
  const list = sessions
    .filter((s) => s.status === "realise")
    .sort((a, b) => b.date.localeCompare(a.date));
  const el = $("#journal-list");
  el.innerHTML = list.length ? list.map(sessionItemHTML).join("") : emptyState("Aucune séance réalisée pour le moment.");
  bindSessionClicks(el);
}

/* ============ PROGRESSION VIEW ============ */
function renderProgression() {
  renderVolumeChart();
  renderPaceChart();
  renderPRCards();
}

function filteredDone() {
  return sessions.filter(
    (s) => s.status === "realise" && (currentFilterSport === "all" || s.sport === currentFilterSport)
  );
}

function renderVolumeChart() {
  const box = $("#chart-volume");
  const done = filteredDone().filter((s) => s.distance);
  if (!done.length) {
    box.innerHTML = `<div class="chart-empty">Pas encore de données de distance.</div>`;
    return;
  }

  // group by ISO week (last 10 weeks)
  const weeks = {};
  done.forEach((s) => {
    const d = new Date(s.date + "T00:00:00");
    const ws = startOfWeek(d);
    const key = ws.toISOString().slice(0, 10);
    weeks[key] = (weeks[key] || 0) + (parseFloat(s.distance) || 0);
  });
  const keys = Object.keys(weeks).sort().slice(-10);
  const values = keys.map((k) => weeks[k]);
  const max = Math.max(...values, 1);

  const w = Math.max(360, keys.length * 60);
  const h = 160;
  const barW = 34;
  const gap = (w - keys.length * barW) / (keys.length + 1);

  let bars = "";
  keys.forEach((k, i) => {
    const val = weeks[k];
    const barH = (val / max) * 110;
    const x = gap + i * (barW + gap);
    const y = h - 30 - barH;
    const label = new Date(k + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    bars += `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${ELECTRIC_ACCENT}" opacity="0.9"></rect>
      <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-family="Space Mono" fill="${ELECTRIC_GOLD}">${val.toFixed(1)}</text>
      <text x="${x + barW / 2}" y="${h - 10}" text-anchor="middle" font-size="10" fill="${ELECTRIC_FAINT}">${label}</text>
    `;
  });

  box.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bars}</svg>`;
}

function paceToSeconds(str) {
  if (!str) return null;
  const m = str.match(/(\d+)[:h](\d+)/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function renderPaceChart() {
  const panel = $("#pace-panel");
  const box = $("#chart-pace");
  if (currentFilterSport !== "all" && currentFilterSport !== "course") {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "";

  const runs = sessions
    .filter((s) => s.status === "realise" && s.sport === "course" && s.allure)
    .map((s) => ({ date: s.date, sec: paceToSeconds(s.allure) }))
    .filter((s) => s.sec)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12);

  if (runs.length < 2) {
    box.innerHTML = `<div class="chart-empty">Ajoute au moins 2 courses avec une allure (format mm:ss) pour voir la tendance.</div>`;
    return;
  }

  const w = Math.max(360, runs.length * 50);
  const h = 140;
  const max = Math.max(...runs.map((r) => r.sec));
  const min = Math.min(...runs.map((r) => r.sec));
  const range = Math.max(max - min, 10);

  const points = runs.map((r, i) => {
    const x = 20 + (i / (runs.length - 1)) * (w - 40);
    const y = 20 + ((r.sec - min) / range) * 90;
    return { x, y, r };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const dots = points
    .map(
      (p) => `
      <circle cx="${p.x}" cy="${p.y}" r="4" fill="${SPORT_COLORS.course}"></circle>
      <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="10" font-family="Space Mono" fill="${ELECTRIC_TEXT}">${Math.floor(p.r.sec / 60)}:${String(p.r.sec % 60).padStart(2, "0")}</text>
    `
    )
    .join("");

  box.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <path d="${path}" fill="none" stroke="${SPORT_COLORS.course}" stroke-width="2" opacity="0.6"></path>
    ${dots}
  </svg>`;
}

function renderPRCards() {
  const el = $("#pr-cards");
  const sports = currentFilterSport === "all" ? ["course", "velo", "muscu", "natation"] : [currentFilterSport];
  let cards = "";

  sports.forEach((sport) => {
    const items = sessions.filter((s) => s.status === "realise" && s.sport === sport);
    if (!items.length) return;

    const totalKm = items.reduce((sum, s) => sum + (parseFloat(s.distance) || 0), 0);
    const longest = items.reduce((max, s) => (parseFloat(s.distance) || 0) > (parseFloat(max.distance) || 0) ? s : max, items[0]);
    const count = items.length;

    cards += `
      <div class="pr-card">
        <div class="pr-sport">${SPORT_LABELS[sport]}</div>
        <div class="pr-value">${totalKm > 0 ? totalKm.toFixed(1) + " km" : count}</div>
        <div class="pr-label">${totalKm > 0 ? "cumul total" : "séances au total"}</div>
      </div>
      ${
        longest && longest.distance
          ? `<div class="pr-card">
              <div class="pr-sport">${SPORT_LABELS[sport]} · plus longue</div>
              <div class="pr-value">${longest.distance} km</div>
              <div class="pr-label">${fmtDate(longest.date)}</div>
            </div>`
          : ""
      }
    `;

    if (sport === "course") {
      const paced = items.filter((s) => paceToSeconds(s.allure));
      if (paced.length) {
        const best = paced.reduce((b, s) => (paceToSeconds(s.allure) < paceToSeconds(b.allure) ? s : b), paced[0]);
        cards += `
          <div class="pr-card">
            <div class="pr-sport">Course · meilleure allure</div>
            <div class="pr-value">${best.allure}</div>
            <div class="pr-label">${fmtDate(best.date)}</div>
          </div>
        `;
      }
    }
  });

  el.innerHTML = cards || emptyState("Pas encore de séances réalisées pour afficher des records.");
}

/* ============ NAVIGATION ============ */
function switchView(view) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
}
$("#tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (btn) switchView(btn.dataset.view);
});
$$(".link-btn[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.goto));
});

/* ============ SPORT FILTER (progression) ============ */
$("#sport-filter").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  currentFilterSport = chip.dataset.sport;
  $$("#sport-filter .chip").forEach((c) => c.classList.toggle("active", c === chip));
  renderProgression();
});

/* ============ MODAL / FORM ============ */
const backdrop = $("#modal-backdrop");
const form = $("#session-form");

function openNew(status, presetDate) {
  form.reset();
  $("#f-id").value = "";
  $("#f-status").value = status;
  $("#f-date").value = presetDate || isoToday();
  $("#f-ressenti").value = "";
  $$("#ressenti-scale button").forEach((b) => b.classList.remove("active"));
  setStatusToggle(status);
  $("#modal-title").textContent = status === "realise" ? "Enregistrer une séance" : "Planifier une séance";
  $("#btn-delete").style.display = "none";
  backdrop.classList.add("open");
}

function openEdit(id) {
  const s = sessions.find((x) => x.id === id);
  if (!s) return;
  $("#f-id").value = s.id;
  $("#f-status").value = s.status;
  $("#f-sport").value = s.sport;
  $("#f-date").value = s.date;
  $("#f-type").value = s.type || "";
  $("#f-distance").value = s.distance || "";
  $("#f-duree").value = s.duree || "";
  $("#f-allure").value = s.allure || "";
  $("#f-fc").value = s.fc || "";
  $("#f-notes").value = s.notes || "";
  $("#f-ressenti").value = s.ressenti || "";
  $$("#ressenti-scale button").forEach((b) => b.classList.toggle("active", b.dataset.val === String(s.ressenti)));
  setStatusToggle(s.status);
  $("#modal-title").textContent = "Modifier la séance";
  $("#btn-delete").style.display = "";
  backdrop.classList.add("open");
}

function closeModal() {
  backdrop.classList.remove("open");
}
function setStatusToggle(status) {
  $("#f-status").value = status;
  $$("#status-toggle button").forEach((b) => b.classList.toggle("active", b.dataset.status === status));
}

$("#status-toggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  setStatusToggle(btn.dataset.status);
});

$("#ressenti-scale").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  $("#f-ressenti").value = btn.dataset.val;
  $$("#ressenti-scale button").forEach((b) => b.classList.toggle("active", b === btn));
});

$("#btn-new-planned").addEventListener("click", () => openNew("planifie"));
$("#btn-new-done").addEventListener("click", () => openNew("realise"));
$("#modal-close").addEventListener("click", closeModal);
$("#modal-cancel").addEventListener("click", closeModal);
backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) closeModal();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#f-id").value;
  const data = {
    sport: $("#f-sport").value,
    date: $("#f-date").value,
    type: $("#f-type").value.trim(),
    distance: $("#f-distance").value ? parseFloat($("#f-distance").value) : null,
    duree: $("#f-duree").value ? parseInt($("#f-duree").value, 10) : null,
    allure: $("#f-allure").value.trim(),
    fc: $("#f-fc").value ? parseInt($("#f-fc").value, 10) : null,
    ressenti: $("#f-ressenti").value ? parseInt($("#f-ressenti").value, 10) : null,
    notes: $("#f-notes").value.trim(),
    status: $("#f-status").value,
  };

  try {
    if (id) {
      data.id = id;
      await apiUpdate(data);
      toast("Séance mise à jour");
    } else {
      await apiCreate(data);
      toast("Séance enregistrée");
    }
    closeModal();
    await loadAll();
  } catch (err) {
    console.error(err);
    toast("Une erreur est survenue");
  }
});

$("#btn-delete").addEventListener("click", async () => {
  const id = $("#f-id").value;
  if (!id) return;
  if (!confirm("Supprimer cette séance ?")) return;
  try {
    await apiDelete(id);
    toast("Séance supprimée");
    closeModal();
    await loadAll();
  } catch (err) {
    console.error(err);
    toast("Erreur lors de la suppression");
  }
});

/* ============ SOMMEIL ============ */
function sleepItemHTML(s) {
  const hrs = s.hours != null ? `${s.hours} h` : "—";
  return `
    <div class="session-item" data-id="${s.id}">
      <span class="tag sommeil">Sommeil</span>
      <div class="si-main">
        <div class="si-type">${s.quality ? "Qualité " + s.quality + "/5" : "Nuit"}</div>
        <div class="si-meta">${hrs}</div>
      </div>
      <span class="si-date">${fmtDate(s.date)}</span>
    </div>
  `;
}

function lastNDates(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function renderSleep() {
  const list = [...sleepEntries].sort((a, b) => b.date.localeCompare(a.date));
  const el = $("#sleep-list");
  el.innerHTML = list.length ? list.map(sleepItemHTML).join("") : emptyState("Aucune nuit enregistrée pour le moment.");
  el.querySelectorAll(".session-item").forEach((it) => it.addEventListener("click", () => openSleepEdit(it.dataset.id)));

  // barres des 7 derniers jours, objectif 8h
  const TARGET = 8;
  const days = lastNDates(7);
  const barsEl = $("#sleep-bars");
  barsEl.innerHTML = days
    .map((iso) => {
      const entry = sleepEntries.find((s) => s.date === iso);
      const label = new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
      if (!entry || entry.hours == null) {
        return `<div class="sleep-bar-row empty" data-date="${iso}">
          <div class="sbr-label">${label}</div>
          <div class="sbr-track"></div>
          <div class="sbr-value">+</div>
        </div>`;
      }
      const pct = Math.min(100, (entry.hours / TARGET) * 100);
      const over = entry.hours > TARGET;
      return `<div class="sleep-bar-row" data-id="${entry.id}">
        <div class="sbr-label">${label}</div>
        <div class="sbr-track">
          <div class="sbr-fill ${over ? "over" : ""}" style="width:${pct}%"></div>
          <div class="sbr-target-mark"></div>
        </div>
        <div class="sbr-value">${entry.hours} h</div>
      </div>`;
    })
    .join("");
  barsEl.querySelectorAll(".sleep-bar-row").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.dataset.id) openSleepEdit(row.dataset.id);
      else openSleepNew(row.dataset.date);
    });
  });

  // stats 7 jours
  const withHours = days.map((iso) => sleepEntries.find((s) => s.date === iso)).filter((s) => s && s.hours != null);
  const avgDur = withHours.length ? withHours.reduce((sum, s) => sum + Number(s.hours), 0) / withHours.length : null;
  const withQuality = withHours.filter((s) => s.quality);
  const avgQuality = withQuality.length ? withQuality.reduce((sum, s) => sum + Number(s.quality), 0) / withQuality.length : null;

  $("#sleep-stats").innerHTML = `
    <div class="stat-card">
      <div class="st-label">Durée moyenne (7j)</div>
      <div class="st-value">${avgDur ? avgDur.toFixed(1) + " h" : "—"}</div>
    </div>
    <div class="stat-card">
      <div class="st-label">Qualité moyenne (7j)</div>
      <div class="st-value">${avgQuality ? avgQuality.toFixed(1) + "/5" : "—"}</div>
    </div>
  `;
}

const sleepBackdrop = $("#sleep-modal-backdrop");
const sleepForm = $("#sleep-form");

function openSleepNew(presetDate) {
  sleepForm.reset();
  $("#s-id").value = "";
  $("#s-date").value = presetDate || isoToday();
  $("#s-quality").value = "";
  $$("#sleep-quality-scale button").forEach((b) => b.classList.remove("active"));
  $("#sleep-modal-title").textContent = "Nouvelle nuit";
  $("#sleep-btn-delete").style.display = "none";
  sleepBackdrop.classList.add("open");
}
function openSleepEdit(id) {
  const s = sleepEntries.find((x) => x.id === id);
  if (!s) return;
  $("#s-id").value = s.id;
  $("#s-date").value = s.date;
  $("#s-hours").value = s.hours != null ? s.hours : "";
  $("#s-quality").value = s.quality || "";
  $("#s-notes").value = s.notes || "";
  $$("#sleep-quality-scale button").forEach((b) => b.classList.toggle("active", b.dataset.val === String(s.quality)));
  $("#sleep-modal-title").textContent = "Modifier la nuit";
  $("#sleep-btn-delete").style.display = "";
  sleepBackdrop.classList.add("open");
}
$("#btn-new-sleep").addEventListener("click", () => openSleepNew());
$("#s-hit-target").addEventListener("click", () => { $("#s-hours").value = 8; });
$("#sleep-modal-close").addEventListener("click", () => sleepBackdrop.classList.remove("open"));
$("#sleep-modal-cancel").addEventListener("click", () => sleepBackdrop.classList.remove("open"));
sleepBackdrop.addEventListener("click", (e) => { if (e.target === sleepBackdrop) sleepBackdrop.classList.remove("open"); });
$("#sleep-quality-scale").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  $("#s-quality").value = btn.dataset.val;
  $$("#sleep-quality-scale button").forEach((b) => b.classList.toggle("active", b === btn));
});
sleepForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#s-id").value;
  const data = {
    date: $("#s-date").value,
    hours: $("#s-hours").value ? parseFloat($("#s-hours").value) : null,
    quality: $("#s-quality").value ? parseInt($("#s-quality").value, 10) : null,
    notes: $("#s-notes").value.trim(),
  };
  try {
    if (id) { data.id = id; await sleepApi.update(data); toast("Nuit mise à jour"); }
    else { await sleepApi.create(data); toast("Nuit enregistrée"); }
    sleepBackdrop.classList.remove("open");
    await loadAll();
  } catch (err) { console.error(err); toast("Une erreur est survenue"); }
});
$("#sleep-btn-delete").addEventListener("click", async () => {
  const id = $("#s-id").value;
  if (!id || !confirm("Supprimer cette nuit ?")) return;
  try { await sleepApi.delete(id); toast("Nuit supprimée"); sleepBackdrop.classList.remove("open"); await loadAll(); }
  catch (err) { console.error(err); toast("Erreur lors de la suppression"); }
});

/* ============ NOURRITURE ============ */
function mealItemHTML(m) {
  const metaParts = [];
  if (m.hydration) metaParts.push(`${m.hydration} L`);
  if (m.feel) metaParts.push(`Énergie ${m.feel}/5`);
  return `
    <div class="session-item" data-id="${m.id}">
      <span class="tag nourriture">${escapeHtml(m.type || "Repas")}</span>
      <div class="si-main">
        <div class="si-type">${escapeHtml((m.description || "").slice(0, 60))}</div>
        <div class="si-meta">${metaParts.join(" · ") || "—"}</div>
      </div>
      <span class="si-date">${fmtDate(m.date)}</span>
    </div>
  `;
}
function renderNutrition() {
  const list = [...mealEntries].sort((a, b) => b.date.localeCompare(a.date));
  const el = $("#nutrition-list");
  el.innerHTML = list.length ? list.map(mealItemHTML).join("") : emptyState("Aucun repas enregistré pour le moment.");
  el.querySelectorAll(".session-item").forEach((it) => it.addEventListener("click", () => openMealEdit(it.dataset.id)));

  const start = startOfWeek(new Date());
  const weekMeals = mealEntries.filter((m) => new Date(m.date + "T00:00:00") >= start);
  const withHydration = weekMeals.filter((m) => m.hydration);
  const avgHydration = withHydration.length
    ? withHydration.reduce((sum, m) => sum + parseFloat(m.hydration), 0) / new Set(withHydration.map((m) => m.date)).size
    : null;

  $("#nutrition-stats").innerHTML = `
    <div class="stat-card">
      <div class="st-label">Repas loggés cette semaine</div>
      <div class="st-value">${weekMeals.length}</div>
    </div>
    <div class="stat-card">
      <div class="st-label">Hydratation moy. / jour</div>
      <div class="st-value">${avgHydration ? avgHydration.toFixed(1) + " L" : "—"}</div>
    </div>
  `;
}

const mealBackdrop = $("#meal-modal-backdrop");
const mealForm = $("#meal-form");

function openMealNew() {
  mealForm.reset();
  $("#m-id").value = "";
  $("#m-date").value = isoToday();
  $("#m-feel").value = "";
  $$("#meal-feel-scale button").forEach((b) => b.classList.remove("active"));
  $("#meal-modal-title").textContent = "Nouveau repas";
  $("#meal-btn-delete").style.display = "none";
  mealBackdrop.classList.add("open");
}
function openMealEdit(id) {
  const m = mealEntries.find((x) => x.id === id);
  if (!m) return;
  $("#m-id").value = m.id;
  $("#m-date").value = m.date;
  $("#m-type").value = m.type || "Petit-déjeuner";
  $("#m-description").value = m.description || "";
  $("#m-hydration").value = m.hydration || "";
  $("#m-feel").value = m.feel || "";
  $("#m-notes").value = m.notes || "";
  $$("#meal-feel-scale button").forEach((b) => b.classList.toggle("active", b.dataset.val === String(m.feel)));
  $("#meal-modal-title").textContent = "Modifier le repas";
  $("#meal-btn-delete").style.display = "";
  mealBackdrop.classList.add("open");
}
$("#btn-new-meal").addEventListener("click", openMealNew);
$("#meal-modal-close").addEventListener("click", () => mealBackdrop.classList.remove("open"));
$("#meal-modal-cancel").addEventListener("click", () => mealBackdrop.classList.remove("open"));
mealBackdrop.addEventListener("click", (e) => { if (e.target === mealBackdrop) mealBackdrop.classList.remove("open"); });
$("#meal-feel-scale").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  $("#m-feel").value = btn.dataset.val;
  $$("#meal-feel-scale button").forEach((b) => b.classList.toggle("active", b === btn));
});
mealForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#m-id").value;
  const data = {
    date: $("#m-date").value,
    type: $("#m-type").value,
    description: $("#m-description").value.trim(),
    hydration: $("#m-hydration").value ? parseFloat($("#m-hydration").value) : null,
    feel: $("#m-feel").value ? parseInt($("#m-feel").value, 10) : null,
    notes: $("#m-notes").value.trim(),
  };
  try {
    if (id) { data.id = id; await mealApi.update(data); toast("Repas mis à jour"); }
    else { await mealApi.create(data); toast("Repas enregistré"); }
    mealBackdrop.classList.remove("open");
    await loadAll();
  } catch (err) { console.error(err); toast("Une erreur est survenue"); }
});
$("#meal-btn-delete").addEventListener("click", async () => {
  const id = $("#m-id").value;
  if (!id || !confirm("Supprimer ce repas ?")) return;
  try { await mealApi.delete(id); toast("Repas supprimé"); mealBackdrop.classList.remove("open"); await loadAll(); }
  catch (err) { console.error(err); toast("Erreur lors de la suppression"); }
});

/* ============ SUGGESTIONS ALIMENTAIRES ============ */
const FOOD_SUGGESTIONS = [
  { title: "Avant vélo / course du matin", items: ["Banane", "Pain blanc + miel", "Compote de fruits", "Dattes", "Flocons d'avoine (petite quantité)"] },
  { title: "Avant la sortie longue", items: ["Riz blanc + miel", "Banane + raisins secs", "Porridge léger", "Pain + confiture"] },
  { title: "Avant la salle", items: ["Yaourt grec + banane", "Œuf + pain", "Fromage blanc + fruits secs"] },
  { title: "Après l'effort", items: ["Yaourt + fruit", "Œuf", "Jambon/poulet + fruit"] },
];
function renderFoodSuggestions() {
  const el = $("#food-suggestions");
  if (!el) return;
  el.innerHTML = FOOD_SUGGESTIONS.map(
    (group) => `
    <div class="food-group">
      <div class="food-group-title">${group.title}</div>
      <div class="food-chips">
        ${group.items.map((item) => `<button type="button" class="food-chip">${item}</button>`).join("")}
      </div>
    </div>`
  ).join("");
  el.querySelectorAll(".food-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      openMealNew();
      $("#m-description").value = chip.textContent;
    });
  });
}

/* ============ INIT ============ */
renderFoodSuggestions();
loadAll();
setInterval(renderCountdown, 60 * 1000);
