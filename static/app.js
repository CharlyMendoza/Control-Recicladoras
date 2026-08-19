// ---------- Estado global ----------
let STORES = [];
let GROUPS = [];
let GROUP_LABELS = {};
let currentGroupSelection = "__all__";

const markers = {};
let routeLine = null;
let map;

function groupColor(groupId) {
  const idx = GROUPS.indexOf(groupId);
  const hue = Math.round((idx * 360) / GROUPS.length);
  return `hsl(${hue}, 70%, 45%)`;
}

function recomputeGroups() {
  GROUPS = [...new Set(STORES.map((s) => s.grupo_id))].sort((a, b) => a - b);
  GROUP_LABELS = {};
  GROUPS.forEach((g) => {
    const count = STORES.filter((s) => s.grupo_id === g).length;
    GROUP_LABELS[g] = `Grupo ${g} (${count} tiendas)`;
  });
}

// ---------- Carga de datos ----------
async function loadStores() {
  const res = await fetch("/api/stores");
  if (res.status === 401) {
    window.location.href = "/login";
    return;
  }
  STORES = await res.json();
  recomputeGroups();
}

async function toggleStore(det) {
  const res = await fetch(`/api/stores/${det}/toggle`, { method: "POST" });
  if (res.status === 401) {
    window.location.href = "/login";
    return;
  }
  const updated = await res.json();
  const idx = STORES.findIndex((s) => s.det === updated.det);
  if (idx >= 0) STORES[idx] = updated;
}

async function markAllGroup(groupId, valor) {
  const res = await fetch(`/api/groups/${groupId}/mark_all?valor=${valor}`, { method: "POST" });
  if (res.status === 401) {
    window.location.href = "/login";
    return;
  }
  const updatedList = await res.json();
  updatedList.forEach((updated) => {
    const idx = STORES.findIndex((s) => s.det === updated.det);
    if (idx >= 0) STORES[idx] = updated;
  });
}

// ---------- Mapa ----------
function initMap() {
  map = L.map("map", { zoomControl: true }).setView([19.45, -99.25], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);
}

function popupHtml(s) {
  const estatusTxt = s.estatus || "N/D";
  const atendidaTxt = s.atendida
    ? `Atendida por ${s.atendida_por || "N/D"}`
    : "Pendiente";
  return `
    <div class="min-w-[220px]">
      <div class="font-bold text-sm mb-1">${s.nombre}</div>
      <div class="text-xs text-slate-500 mb-2">Det: ${s.det} (Col. A)</div>
      <div class="text-xs mb-1"><b>Nombre (Col. B):</b> ${s.nombre}</div>
      <div class="text-xs mb-1"><b>Estatus Adecuacion (Col. G):</b> ${estatusTxt}</div>
      <div class="text-xs mb-2"><b>Grupo Ruta (Col. Q):</b> ${GROUP_LABELS[s.grupo_id]} &middot; parada #${s.orden}</div>
      <div class="text-xs font-semibold ${s.atendida ? "text-green-600" : "text-amber-600"}">
        ${s.atendida ? "Atendida" : "Pendiente"} - ${atendidaTxt}
      </div>
    </div>
  `;
}

function renderMarkers() {
  STORES.forEach((s) => {
    const color = groupColor(s.grupo_id);
    if (!markers[s.det]) {
      const marker = L.circleMarker([s.lat, s.lon], {
        radius: 7,
        fillColor: color,
        color: "#ffffff",
        weight: 1.5,
        fillOpacity: 0.9,
      });
      marker.addTo(map);
      markers[s.det] = marker;
    }
    markers[s.det].bindPopup(popupHtml(s));
  });
}

function refreshMarkerStyles(selectedGroup) {
  STORES.forEach((s) => {
    const marker = markers[s.det];
    const inSelection = selectedGroup === "__all__" || s.grupo_id === selectedGroup;
    const color = groupColor(s.grupo_id);
    marker.setStyle({
      fillColor: s.atendida ? "#16A34A" : color,
      fillOpacity: inSelection ? 0.95 : 0.12,
      color: "#ffffff",
      weight: inSelection ? 2 : 1,
      radius: inSelection && selectedGroup !== "__all__" ? 9 : 7,
    });
    if (inSelection) marker.bringToFront();
    marker.setPopupContent(popupHtml(s));
  });

  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  if (selectedGroup !== "__all__") {
    const items = STORES.filter((s) => s.grupo_id === selectedGroup).sort((a, b) => a.orden - b.orden);
    const latlngs = items.map((s) => [s.lat, s.lon]);
    routeLine = L.polyline(latlngs, { color: groupColor(selectedGroup), weight: 3, dashArray: "6 6", opacity: 0.8 });
    routeLine.addTo(map);
  }
}

// ---------- Sidebar ----------
function groupStats(groupId) {
  const items = groupId === "__all__" ? STORES : STORES.filter((s) => s.grupo_id === groupId);
  const total = items.length;
  const done = items.filter((s) => s.atendida).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { items, total, done, pct };
}

function updateGlobalKpi() {
  const { total, pct } = groupStats("__all__");
  document.getElementById("kpi-total").textContent = total;
  document.getElementById("kpi-global-pct").textContent = pct + "%";
}

function populateGroupFilter() {
  const selectEl = document.getElementById("group-filter");
  selectEl.innerHTML = '<option value="__all__">Ver todos los grupos</option>';
  GROUPS.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = GROUP_LABELS[g];
    selectEl.appendChild(opt);
  });
}

function renderAllGroupsSummary() {
  const container = document.getElementById("panel-content");
  let rows = "";
  GROUPS.forEach((g) => {
    const { total, done, pct } = groupStats(g);
    const color = groupColor(g);
    rows += `
      <div class="store-row cursor-pointer border border-slate-200 rounded-lg p-3 mb-2" data-select-group="${g}">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full inline-block" style="background:${color}"></span>
            <span class="text-sm font-semibold">${GROUP_LABELS[g]}</span>
          </div>
          <span class="text-xs font-bold ${pct === 100 ? "text-green-600" : "text-slate-500"}">${pct}%</span>
        </div>
        <div class="progress-bar-bg h-2">
          <div class="progress-bar-fill h-2" style="width:${pct}%; background:${pct === 100 ? "#16A34A" : color}"></div>
        </div>
        <div class="text-[11px] text-slate-400 mt-1">${done} de ${total} unidades atendidas</div>
      </div>
    `;
  });
  container.innerHTML = `
    <div class="mb-3 text-xs text-slate-500">Selecciona un grupo para ver el detalle, la ruta sugerida y marcar unidades atendidas.</div>
    ${rows}
  `;
  container.querySelectorAll("[data-select-group]").forEach((el) => {
    el.addEventListener("click", () => selectGroup(Number(el.getAttribute("data-select-group"))));
  });
}

function renderGroupDetail(groupId) {
  const container = document.getElementById("panel-content");
  const { items, total, done, pct } = groupStats(groupId);
  const color = groupColor(groupId);
  const ordered = [...items].sort((a, b) => a.orden - b.orden);

  let rowsHtml = "";
  ordered.forEach((s) => {
    const checked = s.atendida ? "checked" : "";
    const meta = s.atendida ? `Atendida por ${s.atendida_por || "N/D"}` : `Estatus: ${s.estatus || "N/D"}`;
    rowsHtml += `
      <label class="store-row flex items-start gap-2 p-2 rounded-lg cursor-pointer">
        <input type="checkbox" data-det="${s.det}" class="mt-1 attend-checkbox w-4 h-4 accent-[#0071CE]" ${checked}>
        <div class="flex-1">
          <div class="text-sm font-medium leading-tight">#${s.orden} - ${s.nombre}</div>
          <div class="text-[11px] text-slate-400">Det ${s.det} - ${s.formato || ""} - ${meta}</div>
        </div>
      </label>
    `;
  });

  container.innerHTML = `
    <button id="btn-back-groups" class="text-xs text-[#0071CE] font-semibold mb-3 flex items-center gap-1">&larr; Volver a todos los grupos</button>
    <div class="border border-slate-200 rounded-lg p-3 mb-3">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full inline-block" style="background:${color}"></span>
          <span class="font-bold text-sm">${GROUP_LABELS[groupId]}</span>
        </div>
        <span class="text-lg font-bold" style="color:${pct === 100 ? "#16A34A" : color}">${pct}%</span>
      </div>
      <div class="progress-bar-bg h-3 mb-1">
        <div class="progress-bar-fill h-3" style="width:${pct}%; background:${pct === 100 ? "#16A34A" : color}"></div>
      </div>
      <div class="text-xs text-slate-500">${done} de ${total} unidades atendidas</div>
      <div class="flex gap-2 mt-3">
        <button id="btn-mark-all" class="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-200 hover:bg-green-100">Marcar todo atendido</button>
        <button id="btn-clear-all" class="text-xs bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100">Limpiar</button>
      </div>
    </div>
    <div class="text-xs font-semibold text-slate-500 uppercase mb-1">Ruta sugerida (checklist de atencion)</div>
    ${rowsHtml}
  `;

  document.getElementById("btn-back-groups").addEventListener("click", () => selectGroup("__all__"));
  document.getElementById("btn-mark-all").addEventListener("click", async () => {
    await markAllGroup(groupId, true);
    refreshMarkerStyles(groupId);
    renderGroupDetail(groupId);
    updateGlobalKpi();
  });
  document.getElementById("btn-clear-all").addEventListener("click", async () => {
    await markAllGroup(groupId, false);
    refreshMarkerStyles(groupId);
    renderGroupDetail(groupId);
    updateGlobalKpi();
  });

  container.querySelectorAll(".attend-checkbox").forEach((cb) => {
    cb.addEventListener("change", async (e) => {
      const det = Number(e.target.getAttribute("data-det"));
      await toggleStore(det);
      refreshMarkerStyles(groupId);
      renderGroupDetail(groupId);
      updateGlobalKpi();
    });
  });
}

function selectGroup(groupId) {
  currentGroupSelection = groupId;
  const selectEl = document.getElementById("group-filter");
  selectEl.value = groupId;
  refreshMarkerStyles(groupId);
  if (groupId === "__all__") {
    renderAllGroupsSummary();
    map.setView([19.45, -99.25], 9);
  } else {
    renderGroupDetail(groupId);
    const items = STORES.filter((s) => s.grupo_id === groupId);
    const bounds = L.latLngBounds(items.map((s) => [s.lat, s.lon]));
    map.fitBounds(bounds, { padding: [60, 60] });
    showMobileView("map");
  }
  updateGlobalKpi();
}

// ---------- Tabs mobile ----------
function showMobileView(view) {
  const mapView = document.getElementById("map-view");
  const panelView = document.getElementById("panel-view");
  const tabMap = document.getElementById("tab-map");
  const tabList = document.getElementById("tab-list");
  if (window.innerWidth >= 768) return;

  if (view === "map") {
    mapView.classList.remove("hidden-mobile");
    panelView.classList.add("hidden-mobile");
    tabMap.classList.add("active");
    tabList.classList.remove("active");
    setTimeout(() => map.invalidateSize(), 50);
  } else {
    mapView.classList.add("hidden-mobile");
    panelView.classList.remove("hidden-mobile");
    tabList.classList.add("active");
    tabMap.classList.remove("active");
  }
}

// ---------- Init ----------
async function init() {
  initMap();
  await loadStores();
  populateGroupFilter();
  renderMarkers();
  selectGroup("__all__");

  document.getElementById("group-filter").addEventListener("change", (e) => {
    const val = e.target.value === "__all__" ? "__all__" : Number(e.target.value);
    selectGroup(val);
  });
  document.getElementById("tab-map").addEventListener("click", () => showMobileView("map"));
  document.getElementById("tab-list").addEventListener("click", () => showMobileView("list"));
}

init();
