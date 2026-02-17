const STORAGE_KEY = "droneops_check_v1";
const CART_STORAGE_KEY = "droneops_cart_v1";

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
  activeTab: "checklist",
  storeItems: [],
  cart: {
    items: [],
    obs: ""
  }
};

const el = {
  checklist: document.getElementById("checklist"),
  goNoGo: document.getElementById("goNoGo"),
  statusReason: document.getElementById("statusReason"),
  weatherBox: document.getElementById("weatherBox"),
  uavData: document.getElementById("uavData"),
  historyBody: document.getElementById("historyBody"),
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
  storeCategoryFilter: document.getElementById("storeCategoryFilter"),
  storeSearch: document.getElementById("storeSearch"),
  storeSort: document.getElementById("storeSort"),
  storeCatalog: document.getElementById("storeCatalog"),
  cartItems: document.getElementById("cartItems"),
  cartTotal: document.getElementById("cartTotal"),
  cartObs: document.getElementById("cartObs"),
  cartBadge: document.getElementById("cartBadge")
};

async function init() {
  const saved = loadState();
  const model = await loadChecklistModel();
  state.checklist = saved?.checklist?.length ? saved.checklist : model;
  state.flights = saved?.flights || [];

  loadCartState();
  state.storeItems = Array.isArray(window.STORE_ITEMS) ? window.STORE_ITEMS : [];

  if (el.flightDate) el.flightDate.value = new Date().toISOString().slice(0, 16);
  if (el.cartObs) el.cartObs.value = state.cart.obs || "";

  renderChecklist();
  renderHistory();
  renderWeather();
  renderUav();
  renderStoreCategoryOptions();
  renderStoreCatalog();
  renderCart();
  syncMissionChecklistFromForm();
  evaluateFlightStatus();
  bindEvents();
  switchTab("checklist");
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
  bindIfExists("clearFiltersBtn", "click", clearHistoryFilters);
  bindIfExists("clearCartBtn", "click", clearCart);
  bindIfExists("copyOrderBtn", "click", copyOrderToClipboard);
  bindIfExists("checkoutWhatsappBtn", "click", checkoutWhatsapp);

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  [el.maxWind, el.maxGust, el.maxKp].forEach((node) => {
    if (node) node.addEventListener("input", evaluateFlightStatus);
  });

  [el.historySearch, el.filterStatus, el.filterIncident].forEach((node) => {
    if (!node) return;
    node.addEventListener("input", renderHistory);
    node.addEventListener("change", renderHistory);
  });

  [el.storeCategoryFilter, el.storeSearch, el.storeSort].forEach((node) => {
    if (!node) return;
    node.addEventListener("input", renderStoreCatalog);
    node.addEventListener("change", renderStoreCatalog);
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
  }
}

function bindIfExists(id, eventName, handler) {
  const node = document.getElementById(id);
  if (node) node.addEventListener(eventName, handler);
}

function switchTab(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("is-active", active);
  });

  document.querySelectorAll(".tab-screen").forEach((screen) => {
    const active = screen.id === `screen-${tabName}`;
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
  const total = state.checklist.length;
  const done = state.checklist.filter((i) => i.done).length;

  const maxWind = Number(el.maxWind?.value);
  const maxGust = Number(el.maxGust?.value);
  const maxKp = Number(el.maxKp?.value);

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
    weather: state.weather,
    uavData: state.uavData,
    savedAt: new Date().toISOString()
  };

  state.flights.unshift(record);
  saveState();
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
  evaluateFlightStatus();
  saveState();
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

function exportJSON() {
  const data = {
    generatedAt: new Date().toISOString(),
    checklistModel: state.checklist,
    flights: state.flights,
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

function renderStoreCatalog() {
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
  renderCart();
}

function removeFromCart(itemId) {
  state.cart.items = state.cart.items.filter((it) => it.id !== itemId);
  saveCartState();
  renderCart();
}

function clearCart() {
  state.cart.items = [];
  if (el.cartObs) el.cartObs.value = "";
  state.cart.obs = "";
  saveCartState();
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
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyOrderToClipboard() {
  const msg = buildOrderMessage();
  if (!msg) return;

  try {
    await navigator.clipboard.writeText(msg);
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
    flights: state.flights.slice(0, 500)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
