const STORAGE_KEY = "droneops_check_v1";
const CART_STORAGE_KEY = "droneops_cart_v1";
const EBOOK_CTA_STORAGE_KEY = "droneops_ebook_cta_clicks_v1";
const COMPLIANCE_WARNING_DAYS = 30;
const COMPLIANCE_CRITICAL_DAYS = 7;

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
    items: ["SISANT", "SARPAS", "ANATEL", "RETA"]
  },
  {
    name: "Operacional",
    items: ["Risco de solo", "Pessoas não anuentes", "Plano de emergência", "RTH definido"]
  },
  {
    name: "Registro de missão",
    items: ["Drone", "Piloto", "Cliente", "Local", "Observações"]
  }
];

const state = {
  checklist: [],
  weather: null,
  uavData: null,
  flights: [],
  auditLogs: [],
  activeTab: "checklist",
  storeItems: [],
  supabase: {
    client: null,
    enabled: false,
    user: null
  },
  compliance: {
    sisant: "",
    sarpas: "",
    anatel: "",
    reta: ""
  },
  cart: {
    items: [],
    obs: ""
  },
  metrics: {
    ebookCtaClicks: {
      total: 0,
      bySource: {
        card: 0,
        floating: 0
      }
    }
  }
};

const el = {
  checklist: document.getElementById("checklist"),
  goNoGo: document.getElementById("goNoGo"),
  statusReason: document.getElementById("statusReason"),
  weatherBox: document.getElementById("weatherBox"),
  uavData: document.getElementById("uavData"),
  historyBody: document.getElementById("historyBody"),
  auditBody: document.getElementById("auditBody"),
  missionForm: document.getElementById("missionForm"),
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
  filterIncident: document.getElementById("filterIncident"),
  missionUse: document.getElementById("missionUse"),
  droneWeightG: document.getElementById("droneWeightG"),
  requiresSarpas: document.getElementById("requiresSarpas"),
  complianceRuleBox: document.getElementById("complianceRuleBox"),
  compSisantDate: document.getElementById("compSisantDate"),
  compSarpasDate: document.getElementById("compSarpasDate"),
  compAnatelDate: document.getElementById("compAnatelDate"),
  compRetaDate: document.getElementById("compRetaDate"),
  complianceAlerts: document.getElementById("complianceAlerts"),
  storeCategoryFilter: document.getElementById("storeCategoryFilter"),
  storeSearch: document.getElementById("storeSearch"),
  storeSort: document.getElementById("storeSort"),
  storeCatalog: document.getElementById("storeCatalog"),
  cartItems: document.getElementById("cartItems"),
  cartTotal: document.getElementById("cartTotal"),
  cartObs: document.getElementById("cartObs"),
  cartBadge: document.getElementById("cartBadge"),
  ebookCtaCountTotal: document.getElementById("ebookCtaCountTotal"),
  ebookCtaCountCard: document.getElementById("ebookCtaCountCard"),
  ebookCtaCountFloating: document.getElementById("ebookCtaCountFloating"),
  cloudIndicator: document.getElementById("cloudIndicator"),
  authStatus: document.getElementById("authStatus"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword")
};

async function init() {
  const saved = loadState();
  const model = await loadChecklistModel();
  state.checklist = saved?.checklist?.length ? saved.checklist : model;
  state.flights = saved?.flights || [];
  state.auditLogs = saved?.auditLogs || [];
  state.compliance = {
    sisant: saved?.compliance?.sisant || "",
    sarpas: saved?.compliance?.sarpas || "",
    anatel: saved?.compliance?.anatel || "",
    reta: saved?.compliance?.reta || ""
  };

  loadCartState();
  loadEbookCtaState();
  state.storeItems = Array.isArray(window.STORE_ITEMS) ? window.STORE_ITEMS : [];
  initSupabase();

  if (el.flightDate) el.flightDate.value = new Date().toISOString().slice(0, 16);
  if (el.cartObs) el.cartObs.value = state.cart.obs || "";
  hydrateComplianceInputs();

  renderChecklist();
  renderHistory();
  renderAuditTrail();
  renderWeather();
  renderUav();
  renderComplianceAlerts();
  renderStoreCategoryOptions();
  renderStore();
  renderCart();
  renderEbookCtaCount();
  refreshAuthStatus();
  syncMissionChecklistFromForm();
  evaluateFlightStatus();
  bindEvents();
  switchTab("checklist");
  registerServiceWorker();
}

function bindEvents() {
  bindIfExists("addItemBtn", "click", addChecklistItem);
  bindIfExists("recheckBtn", "click", evaluateFlightStatus);
  bindIfExists("weatherBtn", "click", fetchWeather);
  bindIfExists("syncUavBtn", "click", syncUavPayload);
  bindIfExists("openUavBtn", "click", openUavForecast);
  bindIfExists("saveFlightBtn", "click", saveFlight);
  bindIfExists("newFlightBtn", "click", resetCurrentFlight);
  bindIfExists("exportJsonBtn", "click", exportJSON);
  bindIfExists("exportCsvBtn", "click", exportCSV);
  bindIfExists("exportAuditBtn", "click", exportAuditJSON);
  bindIfExists("signupBtn", "click", signupWithEmail);
  bindIfExists("loginBtn", "click", loginWithEmail);
  bindIfExists("logoutBtn", "click", logoutSession);
  bindIfExists("cloudPushBtn", "click", pushFlightsToCloud);
  bindIfExists("cloudPullBtn", "click", pullFlightsFromCloud);
  bindIfExists("clearFiltersBtn", "click", clearHistoryFilters);
  bindIfExists("clearAuditBtn", "click", clearAuditTrail);
  bindIfExists("clearCartBtn", "click", clearCart);
  bindIfExists("copyOrderBtn", "click", copyOrderToClipboard);
  bindIfExists("checkoutWhatsappBtn", "click", checkoutWhatsapp);
  document.querySelectorAll("[data-ebook-cta]").forEach((node) => {
    node.addEventListener("click", () => {
      incrementEbookCtaClicks(node.dataset.ebookCta || "ebook-cta");
    });
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  [el.maxWind, el.maxGust, el.maxKp].forEach((node) => {
    if (node) node.addEventListener("input", evaluateFlightStatus);
  });

  [el.missionUse, el.droneWeightG, el.requiresSarpas].forEach((node) => {
    if (!node) return;
    node.addEventListener("input", evaluateFlightStatus);
    node.addEventListener("change", evaluateFlightStatus);
  });

  [el.compSisantDate, el.compSarpasDate, el.compAnatelDate, el.compRetaDate].forEach((node) => {
    if (!node) return;
    node.addEventListener("input", () => {
      syncComplianceFromInputs();
      saveState();
      addAuditLog("Compliance atualizado", `${getFieldLabel(node.id)}: ${node.value || "(vazio)"}`, currentActor());
      renderComplianceAlerts();
      evaluateFlightStatus();
    });
  });

  [el.historySearch, el.filterStatus, el.filterIncident].forEach((node) => {
    if (!node) return;
    node.addEventListener("input", renderHistory);
    node.addEventListener("change", renderHistory);
  });

  [el.storeCategoryFilter, el.storeSearch, el.storeSort].forEach((node) => {
    if (!node) return;
    node.addEventListener("input", renderStore);
    node.addEventListener("change", renderStore);
  });

  if (el.storeCatalog) {
    el.storeCatalog.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-add-cart]");
      if (!btn) return;
      addToCart(btn.dataset.addCart);
    });
  }

  if (el.cartItems) {
    el.cartItems.addEventListener("click", (ev) => {
      const plus = ev.target.closest("button[data-cart-plus]");
      if (plus) return changeCartQty(plus.dataset.cartPlus, 1);

      const minus = ev.target.closest("button[data-cart-minus]");
      if (minus) return changeCartQty(minus.dataset.cartMinus, -1);

      const remove = ev.target.closest("button[data-cart-remove]");
      if (remove) return removeFromCart(remove.dataset.cartRemove);
    });
  }

  if (el.cartObs) {
    el.cartObs.addEventListener("input", () => {
      state.cart.obs = el.cartObs.value;
      saveCartState();
    });
  }

  if (el.missionForm) {
    el.missionForm.addEventListener("input", () => {
      syncMissionChecklistFromForm();
      saveState();
      evaluateFlightStatus();
    });
    el.missionForm.addEventListener("change", (ev) => {
      const target = ev.target;
      if (!target?.id) return;
      const name = getFieldLabel(target.id);
      const value = target.type === "checkbox" ? (target.checked ? "sim" : "nao") : String(target.value || "").trim() || "(vazio)";
      addAuditLog("Campo alterado", `${name}: ${value}`, currentActor());
    });
  }
}

function bindIfExists(id, eventName, handler) {
  const node = document.getElementById(id);
  if (node) node.addEventListener(eventName, handler);
}

function switchTab(tabName) {
  state.activeTab = tabName;
  const screenByTab = {
    checklist: "screen-checklist",
    historico: "screen-historico",
    loja: "storeView"
  };
  const activeScreenId = screenByTab[tabName] || "screen-checklist";

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("is-active", active);
  });

  document.querySelectorAll(".tab-screen").forEach((screen) => {
    const active = screen.id === activeScreenId;
    screen.classList.toggle("is-active", active);
  });
}

function renderChecklist() {
  if (!el.checklist) return;
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
        addAuditLog("Checklist atualizado", `${item.phase} > ${item.label}: ${checkbox.checked ? "marcado" : "desmarcado"}`, currentActor());
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
  if (!el.newItemInput) return;
  const label = el.newItemInput.value.trim();
  if (!label) return;

  state.checklist.push({ id: Date.now(), phase: "Personalizado", label, done: false });
  el.newItemInput.value = "";
  renderChecklist();
  saveState();
  addAuditLog("Checklist personalizado", `Item adicionado: ${label}`, currentActor());
  evaluateFlightStatus();
}

async function fetchWeather() {
  const lat = Number(el.lat?.value);
  const lon = Number(el.lon?.value);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    if (el.weatherBox) el.weatherBox.innerHTML = "<p>Informe latitude e longitude para consultar o clima.</p>";
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
    if (el.weatherBox) el.weatherBox.innerHTML = `<p>Erro ao buscar clima: ${err.message}</p>`;
  }
}

function renderWeather() {
  if (!el.weatherBox) return;
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
  const url = el.uavUrl?.value.trim();
  if (!url) return;

  const lat = el.lat?.value.trim();
  const lon = el.lon?.value.trim();
  const hasCoords = lat && lon;

  const finalUrl = hasCoords
    ? `${url}${url.includes("?") ? "&" : "?"}lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
    : url;

  window.open(finalUrl, "_blank", "noopener,noreferrer");
}

function syncUavPayload() {
  const raw = el.uavPayload?.value.trim();
  if (!raw) {
    if (el.uavData) el.uavData.innerHTML = "<p>Cole um JSON para sincronizar.</p>";
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
    if (el.uavData) el.uavData.innerHTML = `<p>Payload inválido: ${err.message}</p>`;
  }
}

function renderUav() {
  if (!el.uavData) return;
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
  syncComplianceFromInputs();
  const ruleEval = evaluateOperationalRules();
  const total = state.checklist.length;
  const done = state.checklist.filter((i) => i.done).length;

  const maxWind = Number(el.maxWind?.value);
  const maxGust = Number(el.maxGust?.value);
  const maxKp = Number(el.maxKp?.value);

  const weatherWind = preferValue(state.uavData?.wind, state.weather?.wind);
  const weatherGust = preferValue(state.uavData?.gust, state.weather?.gust);
  const kp = state.uavData?.kp;

  const reasons = [...ruleEval.blockers];
  const complianceStatuses = getComplianceStatuses();
  const expiredDocs = complianceStatuses.filter((item) => item.level === "expired");

  if (done < total) reasons.push(`Checklist incompleto (${done}/${total})`);
  if (Number.isFinite(weatherWind) && weatherWind > maxWind) reasons.push(`Vento acima do limite (${weatherWind} > ${maxWind})`);
  if (Number.isFinite(weatherGust) && weatherGust > maxGust) reasons.push(`Rajada acima do limite (${weatherGust} > ${maxGust})`);
  if (Number.isFinite(kp) && kp > maxKp) reasons.push(`Kp acima do limite (${kp} > ${maxKp})`);
  if (expiredDocs.length) reasons.push(`Documento(s) vencido(s): ${expiredDocs.map((d) => d.name).join(", ")}`);

  const hasWeather = Number.isFinite(weatherWind) || Number.isFinite(weatherGust);
  renderComplianceAlerts();
  renderOperationalRuleBox(ruleEval);

  if (reasons.length) {
    paintStatus("NO-GO", "status-no", reasons.join(" | "));
    return;
  }

  if (!hasWeather) {
    paintStatus("PENDENTE", "status-warn", "Sem dado de vento/rajada para decisão completa.");
    return;
  }

  paintStatus("GO", "status-ok", "Checklist completo, clima dentro do limite e compliance operacional atendido.");
}

function paintStatus(label, css, reason) {
  if (!el.goNoGo || !el.statusReason) return;
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
  const finalStatus = el.goNoGo?.textContent || "PENDENTE";

  const record = {
    id: missionId,
    ...payload,
    pilotResponsible: payload.pilotResponsible || payload.operator,
    finalStatus,
    status: finalStatus,
    reason: el.statusReason?.textContent || "",
    checklistDone: state.checklist.filter((i) => i.done).length,
    checklistTotal: state.checklist.length,
    complianceSnapshot: getComplianceStatuses(),
    weather: state.weather,
    uavData: state.uavData,
    savedAt: new Date().toISOString()
  };

  state.flights.unshift(record);
  saveState();
  addAuditLog("Missão salva", `${record.id} | ${record.drone} | status ${record.finalStatus}`, currentActor());
  renderHistory();
}

function resetCurrentFlight() {
  if (el.missionForm) el.missionForm.reset();
  if (el.flightDate) el.flightDate.value = new Date().toISOString().slice(0, 16);

  state.weather = null;
  state.uavData = null;
  state.checklist = state.checklist.map((item) => ({ ...item, done: false }));

  syncMissionChecklistFromForm();
  renderChecklist();
  renderWeather();
  renderUav();
  renderComplianceAlerts();
  evaluateFlightStatus();
  saveState();
  addAuditLog("Novo voo", "Formulário resetado para nova missão.", currentActor());
}

function renderHistory() {
  if (!el.historyBody) return;
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

function getFilteredFlights() {
  const query = (el.historySearch?.value || "").trim().toLowerCase();
  const status = el.filterStatus?.value || "";
  const incident = el.filterIncident?.value || "";

  return state.flights.filter((f) => {
    const textBlob = [f.id, f.operator, f.pilotResponsible, f.drone, f.clientName, f.location].join(" ").toLowerCase();

    const byQuery = !query || textBlob.includes(query);
    const byStatus = !status || (f.finalStatus || f.status) === status;
    const byIncident = incident === "" ? true : incident === "com" ? Boolean(f.hadIncident) : !Boolean(f.hadIncident);

    return byQuery && byStatus && byIncident;
  });
}

function clearHistoryFilters() {
  if (el.historySearch) el.historySearch.value = "";
  if (el.filterStatus) el.filterStatus.value = "";
  if (el.filterIncident) el.filterIncident.value = "";
  renderHistory();
}

function readMission() {
  return {
    operator: document.getElementById("operatorName")?.value.trim() || "",
    pilotResponsible: document.getElementById("pilotResponsible")?.value.trim() || "",
    drone: document.getElementById("droneModel")?.value.trim() || "",
    clientName: document.getElementById("clientName")?.value.trim() || "",
    missionType: document.getElementById("missionType")?.value.trim() || "",
    missionUse: document.getElementById("missionUse")?.value || "",
    droneWeightG: toNullableNumber(document.getElementById("droneWeightG")?.value),
    requiresSarpas: document.getElementById("requiresSarpas")?.value || "nao",
    location: document.getElementById("locationName")?.value.trim() || "",
    lat: toNullableNumber(el.lat?.value),
    lon: toNullableNumber(el.lon?.value),
    flightDate: el.flightDate?.value || null,
    notes: document.getElementById("notes")?.value.trim() || "",
    flightLog: document.getElementById("flightLog")?.value.trim() || "",
    hadIncident: Boolean(document.getElementById("hadIncident")?.checked),
    incidentDetails: document.getElementById("incidentDetails")?.value.trim() || ""
  };
}

function initSupabase() {
  const cfg = window.SUPABASE_CONFIG || {};
  const hasLib = Boolean(window.supabase && typeof window.supabase.createClient === "function");
  const hasConfig = Boolean(cfg.url && cfg.anonKey);
  if (!hasLib || !hasConfig) {
    state.supabase.enabled = false;
    state.supabase.client = null;
    state.supabase.user = null;
    return;
  }

  try {
    state.supabase.client = window.supabase.createClient(cfg.url, cfg.anonKey);
    state.supabase.enabled = true;
    state.supabase.client.auth.getSession().then(({ data }) => {
      state.supabase.user = data?.session?.user || null;
      refreshAuthStatus();
    });
  } catch {
    state.supabase.enabled = false;
    state.supabase.client = null;
    state.supabase.user = null;
  }
}

function refreshAuthStatus() {
  const connected = Boolean(state.supabase.enabled && state.supabase.user);
  if (el.cloudIndicator) {
    el.cloudIndicator.textContent = connected ? "Cloud: conectado" : "Cloud: local";
  }
  if (!el.authStatus) return;
  if (!state.supabase.enabled) {
    el.authStatus.textContent = "Modo local ativo. Configure SUPABASE_CONFIG para login e nuvem.";
    return;
  }
  const userEmail = state.supabase.user?.email || "";
  if (userEmail) {
    el.authStatus.textContent = `Conectado: ${userEmail}`;
  } else {
    el.authStatus.textContent = "Supabase ativo. Faça login para sincronizar na nuvem.";
  }
}

async function signupWithEmail() {
  if (!ensureSupabase()) return;
  const email = (el.authEmail?.value || "").trim();
  const password = (el.authPassword?.value || "").trim();
  if (!email || !password) return alert("Informe e-mail e senha para criar conta.");

  const { data, error } = await state.supabase.client.auth.signUp({ email, password });
  if (error) return alert(`Erro ao criar conta: ${error.message}`);

  state.supabase.user = data?.user || null;
  refreshAuthStatus();
  addAuditLog("Auth", "Conta criada no Supabase.", email || "sistema");
  alert("Conta criada. Verifique seu e-mail se a confirmação estiver habilitada.");
}

async function loginWithEmail() {
  if (!ensureSupabase()) return;
  const email = (el.authEmail?.value || "").trim();
  const password = (el.authPassword?.value || "").trim();
  if (!email || !password) return alert("Informe e-mail e senha para entrar.");

  const { data, error } = await state.supabase.client.auth.signInWithPassword({ email, password });
  if (error) return alert(`Erro no login: ${error.message}`);

  state.supabase.user = data?.user || null;
  refreshAuthStatus();
  addAuditLog("Auth", "Login realizado.", email || "sistema");
}

async function logoutSession() {
  if (!ensureSupabase()) return;
  const actor = state.supabase.user?.email || "sistema";
  const { error } = await state.supabase.client.auth.signOut();
  if (error) return alert(`Erro ao sair: ${error.message}`);
  state.supabase.user = null;
  refreshAuthStatus();
  addAuditLog("Auth", "Logout realizado.", actor);
}

async function pushFlightsToCloud() {
  const user = await getSessionUser();
  if (!user) return;
  if (!state.flights.length) return alert("Sem voos locais para enviar.");

  const uid = user.id;
  const rows = state.flights.map((flight) => ({
    user_id: uid,
    mission_id: flight.id || buildMissionId(),
    payload: flight
  }));

  const { error } = await state.supabase.client.from("flights").upsert(rows, { onConflict: "user_id,mission_id" });
  if (error) return alert(`Falha ao enviar para nuvem: ${error.message}`);

  addAuditLog("Nuvem", `Push de ${rows.length} missão(ões) para Supabase.`, currentActor());
  alert("Voos enviados para a nuvem com sucesso.");
}

async function pullFlightsFromCloud() {
  const user = await getSessionUser();
  if (!user) return;
  const uid = user.id;

  const { data, error } = await state.supabase.client
    .from("flights")
    .select("mission_id,payload,updated_at")
    .eq("user_id", uid)
    .order("updated_at", { ascending: false });

  if (error) return alert(`Falha ao baixar da nuvem: ${error.message}`);

  const remoteFlights = (data || [])
    .map((row) => {
      const payload = row.payload || {};
      if (!payload.id && row.mission_id) payload.id = row.mission_id;
      if (!payload.savedAt && row.updated_at) payload.savedAt = row.updated_at;
      return payload;
    })
    .filter(Boolean);

  state.flights = remoteFlights;
  saveState();
  renderHistory();
  addAuditLog("Nuvem", `Pull de ${remoteFlights.length} missão(ões) do Supabase.`, currentActor());
  alert("Voos sincronizados da nuvem.");
}

function mergeFlights(localFlights, remoteFlights) {
  const map = new Map();
  [...remoteFlights, ...localFlights].forEach((flight) => {
    if (!flight?.id) return;
    const prev = map.get(flight.id);
    if (!prev) {
      map.set(flight.id, flight);
      return;
    }
    const prevTime = new Date(prev.savedAt || 0).getTime();
    const nextTime = new Date(flight.savedAt || 0).getTime();
    if (nextTime >= prevTime) map.set(flight.id, flight);
  });

  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.savedAt || 0).getTime();
    const tb = new Date(b.savedAt || 0).getTime();
    return tb - ta;
  });
}

function ensureSupabase() {
  if (state.supabase.enabled && state.supabase.client) return true;
  alert("Supabase não configurado. Preencha data/supabase-config.js.");
  return false;
}

function ensureAuth() {
  if (!ensureSupabase()) return false;
  if (state.supabase.user) return true;
  alert("Faça login para usar sincronização em nuvem.");
  return false;
}

async function getSessionUser() {
  if (!ensureSupabase()) return null;
  const { data, error } = await state.supabase.client.auth.getSession();
  if (error) {
    alert(`Erro ao validar sessão: ${error.message}`);
    return null;
  }
  state.supabase.user = data?.session?.user || null;
  refreshAuthStatus();
  if (!state.supabase.user) {
    alert("Faça login para usar sincronização em nuvem.");
    return null;
  }
  return state.supabase.user;
}

function exportJSON() {
  const data = {
    generatedAt: new Date().toISOString(),
    checklistModel: state.checklist,
    compliance: state.compliance,
    flights: state.flights,
    auditLogs: state.auditLogs,
    cart: state.cart
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
    "drone_weight_g",
    "location",
    "mission_type",
    "mission_use",
    "requires_sarpas",
    "status",
    "had_incident",
    "incident_details",
    "flight_log",
    "reason",
    "wind",
    "gust",
    "kp",
    "checklist_done",
    "checklist_total",
    "compliance_resume"
  ];

  const rows = state.flights.map((f) => [
    f.id,
    f.savedAt,
    f.operator,
    f.pilotResponsible,
    f.clientName,
    f.drone,
    f.droneWeightG ?? "",
    f.location,
    f.missionType,
    f.missionUse,
    f.requiresSarpas,
    f.status,
    f.hadIncident ? "yes" : "no",
    f.incidentDetails,
    f.flightLog,
    f.reason,
    f.uavData?.wind ?? f.weather?.wind ?? "",
    f.uavData?.gust ?? f.weather?.gust ?? "",
    f.uavData?.kp ?? "",
    f.checklistDone,
    f.checklistTotal,
    (f.complianceSnapshot || [])
      .map((c) => `${c.name}:${formatComplianceLevel(c.level)}`)
      .join(" | ")
  ]);

  const csv = [header, ...rows].map((cols) => cols.map(csvEscape).join(",")).join("\n");
  downloadFile(`droneops-check-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
}

function renderStoreCategoryOptions() {
  if (!el.storeCategoryFilter) return;
  const categories = Array.from(new Set(state.storeItems.map((item) => item.categoria))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  el.storeCategoryFilter.innerHTML = `<option value="">Todas as categorias</option>`;
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    el.storeCategoryFilter.appendChild(opt);
  });
}

function getFilteredStoreItems() {
  const query = normalizeText(el.storeSearch?.value || "");
  const category = el.storeCategoryFilter?.value || "";
  const sort = el.storeSort?.value || "name_asc";

  const filtered = state.storeItems.filter((item) => {
    const byCategory = !category || item.categoria === category;
    const byQuery = !query || normalizeText(item.nome).includes(query);
    return byCategory && byQuery;
  });

  filtered.sort((a, b) => {
    const aPrice = Number(a.preco);
    const bPrice = Number(b.preco);
    const aHasPrice = Number.isFinite(aPrice);
    const bHasPrice = Number.isFinite(bPrice);

    if (sort === "price_asc") {
      if (!aHasPrice && !bHasPrice) return a.nome.localeCompare(b.nome, "pt-BR");
      if (!aHasPrice) return 1;
      if (!bHasPrice) return -1;
      return aPrice - bPrice;
    }

    if (sort === "price_desc") {
      if (!aHasPrice && !bHasPrice) return a.nome.localeCompare(b.nome, "pt-BR");
      if (!aHasPrice) return 1;
      if (!bHasPrice) return -1;
      return bPrice - aPrice;
    }

    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  return filtered;
}

function renderStore() {
  if (!el.storeCatalog) return;
  const items = getFilteredStoreItems();

  if (!items.length) {
    el.storeCatalog.innerHTML = `<p class="mini">Nenhum item encontrado para os filtros aplicados.</p>`;
    return;
  }

  el.storeCatalog.innerHTML = items
    .map((item) => {
      return `
        <article class="store-card">
          <h3>${escapeHtml(item.nome)}</h3>
          <p class="store-meta">${escapeHtml(item.categoria)}</p>
          <p class="mini">${escapeHtml(item.descricao || "Sem descrição")}</p>
          <p class="store-price">${formatItemPrice(item)}</p>
          <button class="btn btn-secondary" data-add-cart="${escapeHtml(item.id)}" type="button">Adicionar ao carrinho</button>
        </article>
      `;
    })
    .join("");
}

function addToCart(itemId) {
  const existing = state.cart.items.find((it) => it.id === itemId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.items.push({ id: itemId, qty: 1 });
  }
  saveCartState();
  const item = state.storeItems.find((it) => it.id === itemId);
  addAuditLog("Carrinho", `Adicionado: ${item?.nome || itemId}`, currentActor());
  renderCart();
}

function changeCartQty(itemId, delta) {
  const row = state.cart.items.find((it) => it.id === itemId);
  if (!row) return;

  row.qty += delta;
  if (row.qty <= 0) {
    state.cart.items = state.cart.items.filter((it) => it.id !== itemId);
  }

  saveCartState();
  const item = state.storeItems.find((it) => it.id === itemId);
  addAuditLog("Carrinho", `Quantidade alterada: ${item?.nome || itemId} (${row.qty > 0 ? row.qty : 0})`, currentActor());
  renderCart();
}

function removeFromCart(itemId) {
  state.cart.items = state.cart.items.filter((it) => it.id !== itemId);
  saveCartState();
  const item = state.storeItems.find((it) => it.id === itemId);
  addAuditLog("Carrinho", `Removido: ${item?.nome || itemId}`, currentActor());
  renderCart();
}

function clearCart() {
  state.cart.items = [];
  if (el.cartObs) el.cartObs.value = "";
  state.cart.obs = "";
  saveCartState();
  addAuditLog("Carrinho", "Carrinho limpo.", currentActor());
  renderCart();
}

function renderCart() {
  if (!el.cartItems || !el.cartTotal || !el.cartBadge) return;

  const rows = state.cart.items
    .map((cartItem) => {
      const product = state.storeItems.find((it) => it.id === cartItem.id);
      if (!product) return null;

      const linePrice = product.sobConsulta || !Number.isFinite(Number(product.preco))
        ? "Sob consulta"
        : money(Number(product.preco) * cartItem.qty);

      return `
        <div class="cart-row">
          <p class="cart-item-name">${escapeHtml(product.nome)}</p>
          <p class="mini">${escapeHtml(product.categoria)} | ${formatItemPrice(product)}</p>
          <div class="cart-row-actions">
            <button class="qty-btn" data-cart-minus="${escapeHtml(product.id)}" type="button">-</button>
            <span>${cartItem.qty}</span>
            <button class="qty-btn" data-cart-plus="${escapeHtml(product.id)}" type="button">+</button>
            <span class="mini">${linePrice}</span>
            <button class="remove-btn" data-cart-remove="${escapeHtml(product.id)}" type="button">Remover</button>
          </div>
        </div>
      `;
    })
    .filter(Boolean);

  if (!rows.length) {
    el.cartItems.innerHTML = `<p class="mini">Carrinho vazio.</p>`;
  } else {
    el.cartItems.innerHTML = rows.join("");
  }

  const total = getCartTotalNumber();
  el.cartTotal.textContent = money(total);
  el.cartBadge.textContent = String(getCartQtyCount());
}

function getCartQtyCount() {
  return state.cart.items.reduce((acc, item) => acc + item.qty, 0);
}

function getCartTotalNumber() {
  return state.cart.items.reduce((acc, cartItem) => {
    const product = state.storeItems.find((it) => it.id === cartItem.id);
    if (!product) return acc;
    const value = Number(product.preco);
    return Number.isFinite(value) ? acc + value * cartItem.qty : acc;
  }, 0);
}

function checkoutWhatsapp() {
  const msg = buildOrderMessage();
  if (!msg) return;

  const url = `https://wa.me/5551980289009?text=${encodeURIComponent(msg)}`;
  addAuditLog("Checkout", "Pedido enviado para WhatsApp.", currentActor());
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyOrderToClipboard() {
  const msg = buildOrderMessage();
  if (!msg) return;

  try {
    await navigator.clipboard.writeText(msg);
    addAuditLog("Checkout", "Pedido copiado para área de transferência.", currentActor());
    alert("Pedido copiado para a área de transferência.");
  } catch {
    alert("Não foi possível copiar automaticamente. Tente novamente.");
  }
}

function buildOrderMessage() {
  if (!state.cart.items.length) {
    alert("Adicione itens ao carrinho antes de finalizar.");
    return "";
  }

  const lines = state.cart.items
    .map((cartItem) => {
      const product = state.storeItems.find((it) => it.id === cartItem.id);
      if (!product) return null;

      const unit = formatItemPrice(product);
      const line = product.sobConsulta || !Number.isFinite(Number(product.preco))
        ? "Sob consulta"
        : money(Number(product.preco) * cartItem.qty);

      return `- ${product.nome} | Qtd: ${cartItem.qty} | Unit: ${unit} | Linha: ${line}`;
    })
    .filter(Boolean);

  const total = money(getCartTotalNumber());
  const obs = (el.cartObs?.value || "").trim();

  return [
    "Pedido Loja - DroneOps Check",
    `Data: ${new Date().toLocaleString("pt-BR")}`,
    "",
    "Itens:",
    ...lines,
    "",
    `Total numerico: ${total}`,
    `Observacoes: ${obs || "Sem observacoes"}`
  ].join("\n");
}

function formatItemPrice(item) {
  const value = Number(item.preco);
  if (item.sobConsulta || !Number.isFinite(value)) return "Sob consulta";
  return money(value);
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function syncMissionChecklistFromForm() {
  const fields = {
    drone: hasValue(document.getElementById("droneModel")?.value),
    piloto: hasValue(document.getElementById("pilotResponsible")?.value) || hasValue(document.getElementById("operatorName")?.value),
    cliente: hasValue(document.getElementById("clientName")?.value),
    local: hasValue(document.getElementById("locationName")?.value),
    observacoes: hasValue(document.getElementById("notes")?.value)
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

function saveState() {
  const payload = {
    checklist: state.checklist,
    flights: state.flights.slice(0, 500),
    compliance: state.compliance,
    auditLogs: state.auditLogs.slice(0, 1000)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function addAuditLog(action, detail, actor = "sistema") {
  state.auditLogs.unshift({
    at: new Date().toISOString(),
    actor: actor || "sistema",
    action,
    detail
  });
  if (state.auditLogs.length > 1000) state.auditLogs = state.auditLogs.slice(0, 1000);
  saveState();
  renderAuditTrail();
}

function renderAuditTrail() {
  if (!el.auditBody) return;
  el.auditBody.innerHTML = "";

  if (!state.auditLogs.length) {
    el.auditBody.innerHTML = `<tr><td colspan="4">Sem eventos na trilha auditável.</td></tr>`;
    return;
  }

  state.auditLogs.slice(0, 200).forEach((log) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(log.at)}</td>
      <td>${escapeHtml(log.actor || "sistema")}</td>
      <td>${escapeHtml(log.action || "-")}</td>
      <td>${escapeHtml(log.detail || "-")}</td>
    `;
    el.auditBody.appendChild(tr);
  });
}

function exportAuditJSON() {
  const payload = {
    generatedAt: new Date().toISOString(),
    auditLogs: state.auditLogs
  };
  downloadFile(`droneops-audit-${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function clearAuditTrail() {
  state.auditLogs = [];
  saveState();
  renderAuditTrail();
}

function currentActor() {
  const operator = document.getElementById("operatorName")?.value.trim();
  const pilot = document.getElementById("pilotResponsible")?.value.trim();
  return operator || pilot || "sistema";
}

function getFieldLabel(id) {
  const map = {
    operatorName: "Operador",
    pilotResponsible: "Piloto responsável",
    droneModel: "Drone",
    clientName: "Cliente",
    missionType: "Tipo de missão",
    missionUse: "Uso da missão",
    droneWeightG: "Peso do drone",
    requiresSarpas: "Missão exige SARPAS",
    locationName: "Local",
    lat: "Latitude",
    lon: "Longitude",
    flightDate: "Data e hora",
    notes: "Observações",
    flightLog: "Log operacional",
    hadIncident: "Incidente/desvio",
    incidentDetails: "Descrição do incidente",
    compSisantDate: "SISANT validade",
    compSarpasDate: "SARPAS validade",
    compAnatelDate: "ANATEL validade",
    compRetaDate: "RETA validade"
  };
  return map[id] || id;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isSecure = window.location.protocol === "https:" || isLocalhost;
  if (!isSecure) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Silent fail: app continues funcionando sem modo offline.
    });
  });
}

function hydrateComplianceInputs() {
  if (el.compSisantDate) el.compSisantDate.value = state.compliance.sisant || "";
  if (el.compSarpasDate) el.compSarpasDate.value = state.compliance.sarpas || "";
  if (el.compAnatelDate) el.compAnatelDate.value = state.compliance.anatel || "";
  if (el.compRetaDate) el.compRetaDate.value = state.compliance.reta || "";
}

function syncComplianceFromInputs() {
  state.compliance.sisant = el.compSisantDate?.value || "";
  state.compliance.sarpas = el.compSarpasDate?.value || "";
  state.compliance.anatel = el.compAnatelDate?.value || "";
  state.compliance.reta = el.compRetaDate?.value || "";
}

function getComplianceStatuses() {
  const docs = [
    { key: "sisant", name: "SISANT" },
    { key: "sarpas", name: "SARPAS" },
    { key: "anatel", name: "ANATEL" },
    { key: "reta", name: "RETA" }
  ];

  return docs.map((doc) => {
    const value = state.compliance[doc.key] || "";
    if (!value) {
      return { ...doc, level: "missing", text: "Sem data informada" };
    }

    const days = daysUntilDate(value);
    if (days < 0) {
      return { ...doc, level: "expired", text: `Vencido há ${Math.abs(days)} dia(s)` };
    }
    if (days <= COMPLIANCE_CRITICAL_DAYS) {
      return { ...doc, level: "critical", text: `Vence em ${days} dia(s)` };
    }
    if (days <= COMPLIANCE_WARNING_DAYS) {
      return { ...doc, level: "warning", text: `Vence em ${days} dia(s)` };
    }
    return { ...doc, level: "ok", text: `Válido por mais ${days} dia(s)` };
  });
}

function renderComplianceAlerts() {
  if (!el.complianceAlerts) return;
  const statuses = getComplianceStatuses();

  el.complianceAlerts.innerHTML = statuses
    .map((doc) => {
      return `
        <div class="compliance-row">
          <span>${escapeHtml(doc.name)} - ${escapeHtml(doc.text)}</span>
          <span class="comp-badge comp-${escapeHtml(doc.level)}">${formatComplianceLevel(doc.level)}</span>
        </div>
      `;
    })
    .join("");
}

function evaluateOperationalRules() {
  const blockers = [];
  const warnings = [];
  const statuses = getComplianceStatuses();
  const statusMap = Object.fromEntries(statuses.map((s) => [s.key, s]));

  const missionUse = el.missionUse?.value || "";
  const droneWeight = Number(el.droneWeightG?.value);
  const requiresSarpas = (el.requiresSarpas?.value || "nao") === "sim";

  if (!missionUse) warnings.push("Selecione o uso da missão (recreativo ou não recreativo).");
  if (!Number.isFinite(droneWeight)) warnings.push("Informe o peso do drone para validações automáticas.");

  if (Number.isFinite(droneWeight) && droneWeight > 250) {
    enforceComplianceDoc(statusMap.sisant, "SISANT obrigatório para drone acima de 250g.", blockers, warnings);
  }

  if (missionUse === "nao_recreativo") {
    enforceComplianceDoc(statusMap.anatel, "ANATEL obrigatório para operação não recreativa.", blockers, warnings);
  }

  if (missionUse === "nao_recreativo" && Number.isFinite(droneWeight) && droneWeight > 250) {
    enforceComplianceDoc(statusMap.reta, "RETA obrigatório para operação não recreativa acima de 250g.", blockers, warnings);
  }

  if (requiresSarpas) {
    enforceComplianceDoc(statusMap.sarpas, "SARPAS obrigatório para este tipo de missão.", blockers, warnings);
  }

  return { blockers, warnings };
}

function enforceComplianceDoc(statusDoc, ruleText, blockers, warnings) {
  if (!statusDoc) return;
  if (statusDoc.level === "missing") {
    blockers.push(`${ruleText} (sem data de validade).`);
    return;
  }
  if (statusDoc.level === "expired") {
    blockers.push(`${ruleText} (${statusDoc.name} vencido).`);
    return;
  }
  if (statusDoc.level === "critical" || statusDoc.level === "warning") {
    warnings.push(`${statusDoc.name}: ${statusDoc.text}.`);
  }
}

function renderOperationalRuleBox(ruleEval) {
  if (!el.complianceRuleBox) return;
  if (!ruleEval) return;

  const blockerHtml = ruleEval.blockers.length
    ? `<p><strong>Bloqueios:</strong></p><ul class=\"rule-list\">${ruleEval.blockers.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
    : `<p><strong>Bloqueios:</strong> nenhum.</p>`;

  const warningHtml = ruleEval.warnings.length
    ? `<p><strong>Avisos:</strong></p><ul class=\"rule-list\">${ruleEval.warnings.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
    : `<p><strong>Avisos:</strong> nenhum.</p>`;

  el.complianceRuleBox.innerHTML = `${blockerHtml}${warningHtml}`;
}

function formatComplianceLevel(level) {
  if (level === "ok") return "OK";
  if (level === "warning") return "Atenção";
  if (level === "critical") return "Crítico";
  if (level === "expired") return "Vencido";
  return "Pendente";
}

function daysUntilDate(yyyyMmDd) {
  const [y, m, d] = String(yyyyMmDd).split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((target - todayStart) / (24 * 60 * 60 * 1000));
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

function saveCartState() {
  const payload = {
    items: state.cart.items,
    obs: state.cart.obs
  };
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
}

function loadCartState() {
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state.cart.items = Array.isArray(parsed?.items) ? parsed.items : [];
    state.cart.obs = parsed?.obs || "";
  } catch {
    state.cart.items = [];
    state.cart.obs = "";
  }
}

function loadEbookCtaState() {
  const raw = localStorage.getItem(EBOOK_CTA_STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const total = Number(parsed.total);
      const bySource = parsed.bySource && typeof parsed.bySource === "object" ? parsed.bySource : {};
      state.metrics.ebookCtaClicks.total = Number.isFinite(total) && total >= 0 ? Math.floor(total) : 0;
      state.metrics.ebookCtaClicks.bySource.card = normalizeCounter(bySource.card);
      state.metrics.ebookCtaClicks.bySource.floating = normalizeCounter(bySource.floating);
      const recomputed = state.metrics.ebookCtaClicks.bySource.card + state.metrics.ebookCtaClicks.bySource.floating;
      state.metrics.ebookCtaClicks.total = Math.max(state.metrics.ebookCtaClicks.total, recomputed);
      return;
    }
  } catch {
    // backward compatibility: old format was a single numeric value as string
  }

  const legacyValue = Number(raw);
  if (Number.isFinite(legacyValue) && legacyValue >= 0) {
    state.metrics.ebookCtaClicks.total = Math.floor(legacyValue);
    state.metrics.ebookCtaClicks.bySource.card = Math.floor(legacyValue);
    state.metrics.ebookCtaClicks.bySource.floating = 0;
  }
}

function saveEbookCtaState() {
  localStorage.setItem(EBOOK_CTA_STORAGE_KEY, JSON.stringify(state.metrics.ebookCtaClicks));
}

function renderEbookCtaCount() {
  if (el.ebookCtaCountTotal) {
    el.ebookCtaCountTotal.textContent = String(state.metrics.ebookCtaClicks.total);
  }
  if (el.ebookCtaCountCard) {
    el.ebookCtaCountCard.textContent = String(state.metrics.ebookCtaClicks.bySource.card);
  }
  if (el.ebookCtaCountFloating) {
    el.ebookCtaCountFloating.textContent = String(state.metrics.ebookCtaClicks.bySource.floating);
  }
}

function incrementEbookCtaClicks(source) {
  const sourceKey = source === "floating" ? "floating" : "card";
  state.metrics.ebookCtaClicks.total += 1;
  state.metrics.ebookCtaClicks.bySource[sourceKey] += 1;
  saveEbookCtaState();
  renderEbookCtaCount();
  addAuditLog("E-book CTA", `Clique em comprar (${sourceKey})`, currentActor());
}

function normalizeCounter(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
}

function buildMissionId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.floor(Math.random() * 900 + 100);
  return `MIS-${stamp}-${rand}`;
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
