const STORAGE_KEY = "droneops_check_v1";

const defaultChecklistPhases = [
  {
    name: "Pré-voo",
    items: [
      "Baterias carregadas",
      "Hélices inspecionadas",
      "Cartão de memória",
      "Firmware verificado",
      "Controle carregado"
    ]
  },
  {
    name: "Regulatório",
    items: [
      "SISANT",
      "SARPAS",
      "ANATEL",
      "RETA"
    ]
  },
  {
    name: "Operacional",
    items: [
      "Risco de solo",
      "Pessoas não anuentes",
      "Plano de emergência",
      "RTH definido"
    ]
  },
  {
    name: "Registro de missão",
    items: [
      "Drone",
      "Piloto",
      "Cliente",
      "Local",
      "Observações"
    ]
  }
];

const state = {
  checklist: [],
  weather: null,
  uavData: null,
  flights: []
};

const el = {
  checklist: document.getElementById("checklist"),
  goNoGo: document.getElementById("goNoGo"),
  statusReason: document.getElementById("statusReason"),
  weatherBox: document.getElementById("weatherBox"),
  uavData: document.getElementById("uavData"),
  historyBody: document.getElementById("historyBody"),
  missionForm: document.getElementById("missionForm"),
  pilotResponsible: document.getElementById("pilotResponsible"),
  clientName: document.getElementById("clientName"),
  hadIncident: document.getElementById("hadIncident"),
  incidentDetails: document.getElementById("incidentDetails"),
  flightLog: document.getElementById("flightLog"),
  maxWind: document.getElementById("maxWind"),
  maxGust: document.getElementById("maxGust"),
  maxKp: document.getElementById("maxKp"),
  lat: document.getElementById("lat"),
  lon: document.getElementById("lon"),
  flightDate: document.getElementById("flightDate"),
  newItemInput: document.getElementById("newItemInput"),
  uavPayload: document.getElementById("uavPayload"),
  uavUrl: document.getElementById("uavUrl"),
  historySearch: document.getElementById("historySearch"),
  filterStatus: document.getElementById("filterStatus"),
  filterIncident: document.getElementById("filterIncident")
};

async function init() {
  const saved = loadState();
  const model = await loadChecklistModel();
  state.checklist = saved?.checklist?.length ? saved.checklist : model;
  state.flights = saved?.flights || [];

  el.flightDate.value = new Date().toISOString().slice(0, 16);

  renderChecklist();
  renderHistory();
  renderWeather();
  renderUav();
  syncMissionChecklistFromForm();
  evaluateFlightStatus();
  bindEvents();
}

function bindEvents() {
  document.getElementById("addItemBtn").addEventListener("click", addChecklistItem);
  document.getElementById("recheckBtn").addEventListener("click", evaluateFlightStatus);
  document.getElementById("weatherBtn").addEventListener("click", fetchWeather);
  document.getElementById("syncUavBtn").addEventListener("click", syncUavPayload);
  document.getElementById("openUavBtn").addEventListener("click", openUavForecast);
  document.getElementById("saveFlightBtn").addEventListener("click", saveFlight);
  document.getElementById("newFlightBtn").addEventListener("click", resetCurrentFlight);
  document.getElementById("exportJsonBtn").addEventListener("click", exportJSON);
  document.getElementById("exportCsvBtn").addEventListener("click", exportCSV);
  document.getElementById("clearFiltersBtn").addEventListener("click", clearHistoryFilters);

  [el.maxWind, el.maxGust, el.maxKp].forEach((node) => {
    node.addEventListener("input", evaluateFlightStatus);
  });

  [el.historySearch, el.filterStatus, el.filterIncident].forEach((node) => {
    node.addEventListener("input", renderHistory);
    node.addEventListener("change", renderHistory);
  });

  el.missionForm.addEventListener("input", () => {
    syncMissionChecklistFromForm();
    saveState();
    evaluateFlightStatus();
  });
}

function renderChecklist() {
  el.checklist.innerHTML = "";

  const byPhase = state.checklist.reduce((acc, item) => {
    const phase = item.phase || "Geral";
    if (!acc.has(phase)) acc.set(phase, []);
    acc.get(phase).push(item);
    return acc;
  }, new Map());

  byPhase.forEach((items, phase) => {
    const title = document.createElement("li");
    title.className = "phase-title";
    title.innerHTML = `<strong>${escapeHtml(phase)}</strong>`;
    el.checklist.appendChild(title);

    items.forEach((item) => {
      const li = document.createElement("li");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.done;
      checkbox.addEventListener("change", () => {
        item.done = checkbox.checked;
        saveState();
        evaluateFlightStatus();
      });

      const text = document.createElement("span");
      text.textContent = item.label;

      li.appendChild(checkbox);
      li.appendChild(text);
      el.checklist.appendChild(li);
    });
  });
}

function addChecklistItem() {
  const label = el.newItemInput.value.trim();
  if (!label) return;

  state.checklist.push({ id: Date.now(), phase: "Personalizado", label, done: false });
  el.newItemInput.value = "";
  renderChecklist();
  saveState();
  evaluateFlightStatus();
}

async function fetchWeather() {
  const lat = Number(el.lat.value);
  const lon = Number(el.lon.value);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    el.weatherBox.innerHTML = "<p>Informe latitude e longitude para consultar o clima.</p>";
    return;
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,wind_speed_10m,wind_gusts_10m,cloud_cover,precipitation,weather_code",
    timezone: "auto"
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!res.ok) throw new Error("Falha na consulta do clima");

    const json = await res.json();
    state.weather = {
      at: new Date().toISOString(),
      temperature: json.current?.temperature_2m,
      wind: json.current?.wind_speed_10m,
      gust: json.current?.wind_gusts_10m,
      cloud: json.current?.cloud_cover,
      rain: json.current?.precipitation,
      code: json.current?.weather_code
    };

    renderWeather();
    saveState();
    evaluateFlightStatus();
  } catch (err) {
    el.weatherBox.innerHTML = `<p>Erro ao buscar clima: ${err.message}</p>`;
  }
}

function renderWeather() {
  if (!state.weather) {
    el.weatherBox.innerHTML = "<p>Sem dados climáticos.</p>";
    return;
  }

  el.weatherBox.innerHTML = `
    <p><strong>Vento:</strong> ${safeNum(state.weather.wind)} km/h</p>
    <p><strong>Rajada:</strong> ${safeNum(state.weather.gust)} km/h</p>
    <p><strong>Temperatura:</strong> ${safeNum(state.weather.temperature)} °C</p>
    <p><strong>Nuvens:</strong> ${safeNum(state.weather.cloud)}%</p>
    <p><strong>Precipitação:</strong> ${safeNum(state.weather.rain)} mm</p>
    <p class="mini">Atualizado em ${fmtDate(state.weather.at)}</p>
  `;
}

function openUavForecast() {
  const url = el.uavUrl.value.trim();
  if (!url) return;

  const lat = el.lat.value.trim();
  const lon = el.lon.value.trim();
  const hasCoords = lat && lon;

  const finalUrl = hasCoords
    ? `${url}${url.includes("?") ? "&" : "?"}lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
    : url;

  window.open(finalUrl, "_blank", "noopener,noreferrer");
}

function syncUavPayload() {
  const raw = el.uavPayload.value.trim();
  if (!raw) {
    el.uavData.innerHTML = "<p>Cole um JSON para sincronizar.</p>";
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.uavData = {
      at: new Date().toISOString(),
      wind: pickFirst(parsed, ["wind", "windSpeed", "wind_speed", "windKmh"]),
      gust: pickFirst(parsed, ["gust", "windGust", "wind_gust", "gustKmh"]),
      kp: pickFirst(parsed, ["kp", "kpIndex", "geomagnetic"]),
      satellites: pickFirst(parsed, ["satellites", "gpsSatellites", "sat_count"])
    };

    renderUav();
    saveState();
    evaluateFlightStatus();
  } catch (err) {
    el.uavData.innerHTML = `<p>Payload inválido: ${err.message}</p>`;
  }
}

function renderUav() {
  if (!state.uavData) {
    el.uavData.innerHTML = "<p>Sem dados de integração.</p>";
    return;
  }

  el.uavData.innerHTML = `
    <p><strong>Vento (UAV):</strong> ${safeNum(state.uavData.wind)} km/h</p>
    <p><strong>Rajada (UAV):</strong> ${safeNum(state.uavData.gust)} km/h</p>
    <p><strong>Kp:</strong> ${safeNum(state.uavData.kp)}</p>
    <p><strong>Satélites:</strong> ${safeNum(state.uavData.satellites)}</p>
    <p class="mini">Sincronizado em ${fmtDate(state.uavData.at)}</p>
  `;
}

function evaluateFlightStatus() {
  const total = state.checklist.length;
  const done = state.checklist.filter((i) => i.done).length;

  const maxWind = Number(el.maxWind.value);
  const maxGust = Number(el.maxGust.value);
  const maxKp = Number(el.maxKp.value);

  const weatherWind = preferValue(state.uavData?.wind, state.weather?.wind);
  const weatherGust = preferValue(state.uavData?.gust, state.weather?.gust);
  const kp = state.uavData?.kp;

  const reasons = [];

  if (done < total) reasons.push(`Checklist incompleto (${done}/${total})`);
  if (Number.isFinite(weatherWind) && weatherWind > maxWind) reasons.push(`Vento acima do limite (${weatherWind} > ${maxWind})`);
  if (Number.isFinite(weatherGust) && weatherGust > maxGust) reasons.push(`Rajada acima do limite (${weatherGust} > ${maxGust})`);
  if (Number.isFinite(kp) && kp > maxKp) reasons.push(`Kp acima do limite (${kp} > ${maxKp})`);

  const hasWeather = Number.isFinite(weatherWind) || Number.isFinite(weatherGust);

  if (!hasWeather) {
    paintStatus("PENDENTE", "status-warn", "Sem dado de vento/rajada para decisão completa.");
    return;
  }

  if (reasons.length) {
    paintStatus("NO-GO", "status-no", reasons.join(" | "));
  } else {
    paintStatus("GO", "status-ok", "Checklist completo e clima dentro dos limites configurados.");
  }
}

function paintStatus(label, css, reason) {
  el.goNoGo.textContent = label;
  el.goNoGo.classList.remove("status-ok", "status-no", "status-warn");
  el.goNoGo.classList.add(css);
  el.statusReason.textContent = reason;
}

function saveFlight() {
  const payload = readMission();
  if (!payload.operator || !payload.drone) {
    alert("Preencha ao menos operador e drone para salvar.");
    return;
  }

  const missionId = buildMissionId();
  const finalStatus = el.goNoGo.textContent;

  const record = {
    id: missionId,
    ...payload,
    pilotResponsible: payload.pilotResponsible || payload.operator,
    finalStatus,
    status: finalStatus,
    reason: el.statusReason.textContent,
    checklistDone: state.checklist.filter((i) => i.done).length,
    checklistTotal: state.checklist.length,
    weather: state.weather,
    uavData: state.uavData,
    savedAt: new Date().toISOString()
  };

  state.flights.unshift(record);
  saveState();
  renderHistory();
}

function resetCurrentFlight() {
  el.missionForm.reset();
  el.flightDate.value = new Date().toISOString().slice(0, 16);
  state.weather = null;
  state.uavData = null;
  state.checklist = state.checklist.map((item) => ({ ...item, done: false }));
  syncMissionChecklistFromForm();
  renderChecklist();
  renderWeather();
  renderUav();
  evaluateFlightStatus();
  saveState();
}

function renderHistory() {
  el.historyBody.innerHTML = "";
  const flights = getFilteredFlights();

  if (!state.flights.length) {
    el.historyBody.innerHTML = `<tr><td colspan="10">Nenhum voo salvo.</td></tr>`;
    return;
  }

  if (!flights.length) {
    el.historyBody.innerHTML = `<tr><td colspan="10">Nenhum voo encontrado para os filtros aplicados.</td></tr>`;
    return;
  }

  flights.forEach((flight) => {
    const incidentBadge = flight.hadIncident
      ? `<span class="pill pill-yes">Com incidente</span>`
      : `<span class="pill pill-no">Sem incidente</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(flight.id || "-")}</td>
      <td>${fmtDate(flight.savedAt)}</td>
      <td>${escapeHtml(flight.operator || "-")}</td>
      <td>${escapeHtml(flight.pilotResponsible || flight.operator || "-")}</td>
      <td>${escapeHtml(flight.drone || "-")}</td>
      <td>${escapeHtml(flight.clientName || "-")}</td>
      <td>${escapeHtml(flight.location || "-")}</td>
      <td>${escapeHtml(flight.finalStatus || flight.status || "-")}</td>
      <td>${incidentBadge}</td>
      <td>${safeNum(flight.uavData?.wind ?? flight.weather?.wind)} km/h</td>
    `;
    el.historyBody.appendChild(tr);
  });
}

function readMission() {
  return {
    operator: document.getElementById("operatorName").value.trim(),
    pilotResponsible: document.getElementById("pilotResponsible").value.trim(),
    drone: document.getElementById("droneModel").value.trim(),
    clientName: document.getElementById("clientName").value.trim(),
    missionType: document.getElementById("missionType").value.trim(),
    location: document.getElementById("locationName").value.trim(),
    lat: toNullableNumber(el.lat.value),
    lon: toNullableNumber(el.lon.value),
    flightDate: el.flightDate.value || null,
    notes: document.getElementById("notes").value.trim(),
    flightLog: document.getElementById("flightLog").value.trim(),
    hadIncident: Boolean(document.getElementById("hadIncident").checked),
    incidentDetails: document.getElementById("incidentDetails").value.trim()
  };
}

function exportJSON() {
  const data = {
    generatedAt: new Date().toISOString(),
    checklistModel: state.checklist,
    flights: state.flights
  };
  downloadFile(`droneops-check-${Date.now()}.json`, JSON.stringify(data, null, 2), "application/json");
}

function exportCSV() {
  if (!state.flights.length) {
    alert("Sem voos para exportar.");
    return;
  }

  const header = [
    "mission_id",
    "saved_at",
    "operator",
    "pilot_responsible",
    "client_name",
    "drone",
    "location",
    "mission_type",
    "status",
    "had_incident",
    "incident_details",
    "flight_log",
    "reason",
    "wind",
    "gust",
    "kp",
    "checklist_done",
    "checklist_total"
  ];
  const rows = state.flights.map((f) => [
    f.id,
    f.savedAt,
    f.operator,
    f.pilotResponsible,
    f.clientName,
    f.drone,
    f.location,
    f.missionType,
    f.status,
    f.hadIncident ? "yes" : "no",
    f.incidentDetails,
    f.flightLog,
    f.reason,
    f.uavData?.wind ?? f.weather?.wind ?? "",
    f.uavData?.gust ?? f.weather?.gust ?? "",
    f.uavData?.kp ?? "",
    f.checklistDone,
    f.checklistTotal
  ]);

  const csv = [header, ...rows]
    .map((cols) => cols.map(csvEscape).join(","))
    .join("\n");

  downloadFile(`droneops-check-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
}

function saveState() {
  const payload = {
    checklist: state.checklist,
    flights: state.flights.slice(0, 200)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function getFilteredFlights() {
  const query = (el.historySearch?.value || "").trim().toLowerCase();
  const status = el.filterStatus?.value || "";
  const incident = el.filterIncident?.value || "";

  return state.flights.filter((f) => {
    const textBlob = [
      f.id,
      f.operator,
      f.pilotResponsible,
      f.drone,
      f.clientName,
      f.location
    ].join(" ").toLowerCase();

    const byQuery = !query || textBlob.includes(query);
    const byStatus = !status || (f.finalStatus || f.status) === status;
    const byIncident = incident === ""
      ? true
      : incident === "com"
        ? Boolean(f.hadIncident)
        : !Boolean(f.hadIncident);

    return byQuery && byStatus && byIncident;
  });
}

function clearHistoryFilters() {
  if (el.historySearch) el.historySearch.value = "";
  if (el.filterStatus) el.filterStatus.value = "";
  if (el.filterIncident) el.filterIncident.value = "";
  renderHistory();
}

async function loadChecklistModel() {
  try {
    const res = await fetch("./checklist.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Checklist externo não carregado");
    const json = await res.json();
    if (!Array.isArray(json.phases)) throw new Error("Formato inválido");
    return flattenChecklistPhases(json.phases);
  } catch {
    return flattenChecklistPhases(defaultChecklistPhases);
  }
}

function flattenChecklistPhases(phases) {
  let idx = 1;
  const items = [];
  phases.forEach((phase) => {
    const phaseName = phase?.name || "Geral";
    const phaseItems = Array.isArray(phase?.items) ? phase.items : [];
    phaseItems.forEach((label) => {
      items.push({
        id: idx++,
        phase: phaseName,
        label: String(label),
        done: false
      });
    });
  });
  return items;
}

function syncMissionChecklistFromForm() {
  const fields = {
    drone: hasValue(document.getElementById("droneModel").value),
    piloto: hasValue(document.getElementById("pilotResponsible").value) || hasValue(document.getElementById("operatorName").value),
    cliente: hasValue(document.getElementById("clientName").value),
    local: hasValue(document.getElementById("locationName").value),
    observacoes: hasValue(document.getElementById("notes").value)
  };

  let changed = false;
  state.checklist.forEach((item) => {
    if (normalizeText(item.phase) !== "registro de missao") return;
    const key = normalizeText(item.label);
    const shouldBeDone = Boolean(fields[key]);
    if (item.done !== shouldBeDone) {
      item.done = shouldBeDone;
      changed = true;
    }
  });

  if (changed) renderChecklist();
}

function buildMissionId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.floor(Math.random() * 900 + 100);
  return `MIS-${stamp}-${rand}`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickFirst(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      const n = Number(obj[key]);
      return Number.isFinite(n) ? n : obj[key];
    }
  }
  return null;
}

function preferValue(primary, fallback) {
  return Number.isFinite(Number(primary)) ? Number(primary) : Number(fallback);
}

function safeNum(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? n : String(value);
}

function toNullableNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hasValue(v) {
  return String(v || "").trim().length > 0;
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
