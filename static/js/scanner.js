// static/js/scanner.js
// Scanner + cámara + notificaciones + popup de producto
// Usando Supabase como BD compartida.

let codeReader = null;
let cameraOn   = false;

// =====================
// Constantes alertas
// =====================
const NOTIFY_INTERVAL_MINUTES = 10;
const NOTIFY_INTERVAL_MS = NOTIFY_INTERVAL_MINUTES * 60 * 1000;
const lastNotified = new Map();

// =====================
// Utilidades fecha
// =====================
function parseDateISO(d) {
  if (!d) return new Date("2100-01-01T00:00:00");
  return new Date(d + "T00:00:00");
}

function daysToExpiry(expiryStr) {
  if (!expiryStr) return NaN;
  const hoy = new Date();
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const exp = parseDateISO(expiryStr);
  const diffMs = exp.getTime() - hoyMid.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function alertLevel(daysLeft) {
  if (Number.isNaN(daysLeft)) return "ok";
  if (daysLeft <= 0) return "vencido";
  if (daysLeft === 1) return "1-dia";
  if (daysLeft === 2) return "2-dias";
  if (daysLeft === 3) return "3-dias";
  return "ok";
}

// =====================
// Toasts discretos
// =====================
function getToastContainer() {
  let c = document.getElementById("toast-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "toast-container";
    document.body.appendChild(c);
  }
  return c;
}

function showToast(message) {
  const c = getToastContainer();
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add("hide");
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// =====================
// DOM
// =====================
const codeInput    = document.getElementById("code-input");
const btnSearch    = document.getElementById("btn-search");
const btnToggleCam = document.getElementById("btn-toggle-camera");
const videoWrapper = document.getElementById("video-wrapper");
const videoElem    = document.getElementById("preview");

// =====================
// Supabase helper
// =====================
function getSupabase() {
  const client = window.supabaseClient;
  if (!client) {
    console.error("SupabaseClient no está inicializado.");
    showToast("Error de configuración con Supabase.");
  }
  return client;
}

// =====================
// Buscar producto en Supabase
// =====================
async function buscarProductoPorCodigo(code) {
  if (!code) return;
  const supabase = getSupabase();
  if (!supabase) return;

  let resp;
  try {
    resp = await supabase
      .from("productos")
      .select("*")
      .eq("code", code)
      .maybeSingle();
  } catch (err) {
    console.error("Error de red al llamar a Supabase:", err);
    showToast("Error al conectarse con la base de datos.");
    return;
  }

  const { data, error } = resp;

  if (error) {
    console.error("Error Supabase:", error);
    showToast("Error consultando la base de datos.");
    return;
  }

  if (!data) {
    mostrarPopupProductoNoEncontrado(code);
    return;
  }

  const dte = daysToExpiry(data.expiry_date);
  const lvl = alertLevel(dte);

  const producto = {
    ...data,
    days_to_expiry: dte,
    alert_level: lvl,
  };

  mostrarNotificacionProducto(producto);
  mostrarModalProducto(producto);
}

// =====================
// Popup: producto NO encontrado
// =====================
function mostrarPopupProductoNoEncontrado(code) {
  let overlay = document.getElementById("product-not-found-overlay");
  if (overlay) overlay.remove();

  overlay = document.createElement("div");
  overlay.id = "product-not-found-overlay";
  overlay.className = "modal-overlay";

  overlay.innerHTML = `
    <div class="modal" style="max-width: 420px;">
      <div class="modal-header">
        <div class="modal-icon">⚠️</div>
        <div class="modal-title-wrap">
          <h3>Producto no encontrado</h3>
          <p>Código: ${code}</p>
        </div>
        <button class="modal-close" id="nf-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <p class="status-text">
          Este código aún no está creado en la base de datos.
        </p>
        <p class="hint-text">
          ¿Deseas crear el producto ahora?
        </p>
        <div class="modal-actions" style="margin-top: 12px; display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn-secondary" id="nf-cancel-btn">Cancelar</button>
          <button class="btn-primary" id="nf-create-btn">Crear producto</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.classList.remove("show");

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#nf-close-btn").addEventListener("click", close);
  overlay.querySelector("#nf-cancel-btn").addEventListener("click", close);
  overlay.querySelector("#nf-create-btn").addEventListener("click", () => {
    close();
    overlay.remove();
    mostrarModalCrearProducto(code);
  });

  overlay.classList.add("show");
}

// =====================
// Modal: ficha de producto
// =====================
function crearModalProductoSiNoExiste() {
  let overlay = document.getElementById("product-modal-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "product-modal-overlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-icon">📦</div>
        <div class="modal-title-wrap">
          <h3 id="modal-product-name"></h3>
          <p id="modal-product-code"></p>
        </div>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <span id="modal-expiry-chip" class="chip chip-ok"></span>

        <div class="modal-grid">
          <div>
            <span class="label">Empresa / Entidad</span>
            <span id="modal-company" class="value"></span>
          </div>
          <div>
            <span class="label">Ubicación</span>
            <span id="modal-location" class="value"></span>
          </div>
          <div>
            <span class="label">Área</span>
            <span id="modal-area" class="value"></span>
          </div>
          <div>
            <span class="label">Lote</span>
            <span id="modal-lot" class="value"></span>
          </div>
          <div>
            <span class="label">Fecha elaboración</span>
            <span id="modal-made" class="value"></span>
          </div>
          <div>
            <span class="label">Fecha vencimiento</span>
            <span id="modal-expiry" class="value"></span>
          </div>
          <div>
            <span class="label">Días para vencer</span>
            <span id="modal-days" class="value"></span>
          </div>
        </div>

        <div class="modal-extra">
          <p id="modal-status-text" class="status-text"></p>
          <p class="hint-text">
            Verifica físicamente el producto en bodega antes de usarlo, según los protocolos de la institución.
          </p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.classList.remove("show");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#modal-close-btn").addEventListener("click", close);

  return overlay;
}

function mostrarModalProducto(data) {
  const overlay = crearModalProductoSiNoExiste();

  const nameEl    = overlay.querySelector("#modal-product-name");
  const codeEl    = overlay.querySelector("#modal-product-code");
  const companyEl = overlay.querySelector("#modal-company");
  const locEl     = overlay.querySelector("#modal-location");
  const areaEl    = overlay.querySelector("#modal-area");
  const lotEl     = overlay.querySelector("#modal-lot");
  const madeEl    = overlay.querySelector("#modal-made");
  const expEl     = overlay.querySelector("#modal-expiry");
  const daysEl    = overlay.querySelector("#modal-days");
  const chipEl    = overlay.querySelector("#modal-expiry-chip");
  const statusEl  = overlay.querySelector("#modal-status-text");

  nameEl.textContent    = data.name || "-";
  codeEl.textContent    = `Código: ${data.code || "-"}`;
  companyEl.textContent = data.company  || "-";
  locEl.textContent     = data.location || "-";
  areaEl.textContent    = data.area     || "-";
  lotEl.textContent     = data.lot      || "-";
  madeEl.textContent    = data.made_date   || "-";
  expEl.textContent     = data.expiry_date || "-";
  daysEl.textContent    = Number.isNaN(data.days_to_expiry)
    ? "-"
    : data.days_to_expiry;

  const lvl = data.alert_level;
  chipEl.className = "chip";
  let textoChip = "En buen estado";
  let textoStatus = "";

  if (lvl === "vencido") {
    chipEl.classList.add("chip-danger");
    textoChip   = "Producto vencido";
    textoStatus = "Este producto está vencido. Debe retirarse del stock.";
  } else if (lvl === "1-dia") {
    chipEl.classList.add("chip-warn");
    textoChip   = "Vence en 1 día";
    textoStatus = "Queda 1 día para el vencimiento.";
  } else if (lvl === "2-dias") {
    chipEl.classList.add("chip-warn");
    textoChip   = "Vence en 2 días";
    textoStatus = "Quedan 2 días para el vencimiento.";
  } else if (lvl === "3-dias") {
    chipEl.classList.add("chip-warn");
    textoChip   = "Vence en 3 días";
    textoStatus = "Quedan 3 días para el vencimiento.";
  } else {
    chipEl.classList.add("chip-ok");
    textoChip   = "En buen estado";
    textoStatus = "El producto está dentro de su vida útil.";
  }

  chipEl.textContent = textoChip;
  statusEl.textContent = textoStatus;

  overlay.classList.add("show");
}

// =====================
// Modal: crear producto
// =====================
function crearModalCrearProductoSiNoExiste() {
  let overlay = document.getElementById("create-product-modal-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "create-product-modal-overlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-icon">✨</div>
        <div class="modal-title-wrap">
          <h3>Crear producto</h3>
          <p>Completa la información y se guardará en la base de datos.</p>
        </div>
        <button class="modal-close" id="cp-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="create-product-form" class="modal-grid">
          <div>
            <span class="label">Código (escaneado)</span>
            <input id="cp-code" class="scan-input" type="text" readonly />
          </div>
          <div>
            <span class="label">Nombre del producto</span>
            <input id="cp-name" class="scan-input" type="text" required />
          </div>
          <div>
            <span class="label">Empresa / Entidad</span>
            <input id="cp-company" class="scan-input" type="text" />
          </div>
          <div>
            <span class="label">Ubicación</span>
            <input id="cp-location" class="scan-input" type="text" />
          </div>
          <div>
            <span class="label">Área</span>
            <input id="cp-area" class="scan-input" type="text" />
          </div>
          <div>
            <span class="label">Lote</span>
            <input id="cp-lot" class="scan-input" type="text" />
          </div>
          <div>
            <span class="label">Fecha elaboración</span>
            <input id="cp-made" class="scan-input" type="date" />
          </div>
          <div>
            <span class="label">Fecha vencimiento</span>
            <input id="cp-expiry" class="scan-input" type="date" />
          </div>
        </form>

        <div class="modal-extra" style="margin-top:10px;">
          <p class="hint-text">
            Al guardar, el producto quedará disponible para futuros escaneos
            y se incluirá en las alertas automáticas.
          </p>
          <div class="modal-actions" style="margin-top: 10px; display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn-secondary" id="cp-cancel-btn" type="button">Cancelar</button>
            <button class="btn-primary" id="cp-save-btn" type="button">Guardar producto</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.classList.remove("show");

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#cp-close-btn").addEventListener("click", close);
  overlay.querySelector("#cp-cancel-btn").addEventListener("click", close);

  // Guardar
  overlay.querySelector("#cp-save-btn").addEventListener("click", async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    const code    = overlay.querySelector("#cp-code").value.trim();
    const name    = overlay.querySelector("#cp-name").value.trim();
    const company = overlay.querySelector("#cp-company").value.trim();
    const loc     = overlay.querySelector("#cp-location").value.trim();
    const area    = overlay.querySelector("#cp-area").value.trim();
    const lot     = overlay.querySelector("#cp-lot").value.trim();
    const made    = overlay.querySelector("#cp-made").value;
    const expiry  = overlay.querySelector("#cp-expiry").value;

    if (!code || !name) {
      showToast("Código y nombre son obligatorios.");
      return;
    }

    const nuevoProducto = {
      code,
      name,
      company,
      location: loc,
      area,
      lot,
      made_date: made || null,
      expiry_date: expiry || null,
    };

    let resp;
    try {
      resp = await supabase
        .from("productos")
        .upsert(nuevoProducto, { onConflict: "code" });
    } catch (err) {
      console.error("Error de red guardando producto:", err);
      showToast("No se pudo guardar el producto (error de red).");
      return;
    }

    const { error } = resp;
    if (error) {
      console.error("Error Supabase al guardar producto:", error);
      showToast("No se pudo guardar el producto en la base de datos.");
      return;
    }

    // Limpia el formulario
    overlay.querySelector("#create-product-form").reset();
    overlay.classList.remove("show");

    showToast("Producto guardado en la base de datos.");

    // Si tiene fechas, calculamos días y mostramos ficha de una vez
    const dte = daysToExpiry(nuevoProducto.expiry_date);
    const lvl = alertLevel(dte);
    const prodConEstado = {
      ...nuevoProducto,
      days_to_expiry: dte,
      alert_level: lvl,
    };
    mostrarModalProducto(prodConEstado);
  });

  return overlay;
}

function mostrarModalCrearProducto(code) {
  const overlay = crearModalCrearProductoSiNoExiste();
  overlay.querySelector("#cp-code").value = code || "";
  overlay.classList.add("show");
}

// =====================
// Notificaciones del sistema
// =====================
async function solicitarPermisoNotificaciones() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (e) {
      console.warn("Error pidiendo permiso de notificaciones:", e);
    }
  }
}

function construirTextoEstado(lvl) {
  if (lvl === "vencido") return "VENCIDO";
  if (lvl === "1-dia")  return "Vence en 1 día";
  if (lvl === "2-dias") return "Vence en 2 días";
  if (lvl === "3-dias") return "Vence en 3 días";
  return "En buen estado";
}

function mostrarNotificacionProducto(data) {
  const lvl = data.alert_level;
  const estado = construirTextoEstado(lvl);

  const body =
    `${data.name} (${estado})\n` +
    `Empresa: ${data.company || "-"}\n` +
    `Ubicación: ${data.location || "-"} · Área: ${data.area || "-"}\n` +
    `Código: ${data.code} · Lote: ${data.lot || "-"}\n` +
    `Elab: ${data.made_date || "-"} · Vence: ${data.expiry_date || "-"}\n` +
    `Días para vencer: ${Number.isNaN(data.days_to_expiry) ? "-" : data.days_to_expiry}`;

  if (!("Notification" in window) || Notification.permission !== "granted") {
    console.log("[Alerta producto]", body);
    showToast(`${data.name}: ${estado}`);
    return;
  }

  let titulo =
    lvl === "vencido"
      ? "Producto vencido"
      : lvl === "ok"
      ? "Producto consultado"
      : "Producto próximo a vencer";

  const notif = new Notification(titulo, {
    body,
    icon: "https://cdn-icons-png.flaticon.com/512/463/463612.png",
  });

  notif.onclick = () => {
    window.focus();
    mostrarModalProducto(data);
  };
}

// =====================
// Eventos input / búsqueda manual
// =====================
btnSearch.addEventListener("click", () => {
  const code = codeInput.value.trim();
  buscarProductoPorCodigo(code);
});

codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const code = codeInput.value.trim();
    buscarProductoPorCodigo(code);
  }
});

// =====================
// Cámara: escaneo automático
// =====================
async function iniciarCamara() {
  if (!codeReader) {
    codeReader = new ZXingBrowser.BrowserMultiFormatReader();
  }

  cameraOn = true;
  videoWrapper.hidden = false;
  btnToggleCam.textContent = "Detener cámara";

  try {
    await codeReader.decodeFromVideoDevice(
      undefined, // cámara por defecto
      videoElem,
      (result, err) => {
        if (result) {
          const text = result.getText();
          console.log("Código leído por cámara:", text);
          codeInput.value = text;

          // 🔹 Cierra la cámara al leer el código
          detenerCamara();

          // 🔹 Busca el producto automáticamente
          buscarProductoPorCodigo(text);
        }
      }
    );
  } catch (err) {
    console.error("Error usando cámara:", err);
    showToast("No fue posible acceder a la cámara.");
    detenerCamara();
  }
}

function detenerCamara() {
  if (codeReader) {
    codeReader.reset();
  }
  cameraOn = false;
  videoWrapper.hidden = true;
  btnToggleCam.textContent = "Usar cámara";
}

btnToggleCam.addEventListener("click", () => {
  if (!cameraOn) {
    iniciarCamara();
  } else {
    detenerCamara();
  }
});

// =====================
// Alertas automáticas cada 10 minutos
// =====================
async function obtenerProductosEnAlerta() {
  const supabase = getSupabase();
  if (!supabase) return [];

  let resp;
  try {
    resp = await supabase.from("productos").select("*");
  } catch (err) {
    console.error("Error de red obteniendo productos:", err);
    return [];
  }

  const { data, error } = resp;
  if (error) {
    console.error("Error Supabase al obtener productos:", error);
    return [];
  }

  return data
    .map(p => {
      const dte = daysToExpiry(p.expiry_date);
      const lvl = alertLevel(dte);
      return { ...p, days_to_expiry: dte, alert_level: lvl };
    })
    .filter(p => p.alert_level !== "ok")
    .sort((a, b) => a.days_to_expiry - b.days_to_expiry);
}

async function mostrarAlertasPeriodicas() {
  const lista = await obtenerProductosEnAlerta();
  if (!lista.length) return;

  const ahora = Date.now();
  lista.forEach(p => {
    const last = lastNotified.get(p.code) || 0;
    if (ahora - last < NOTIFY_INTERVAL_MS) return;
    lastNotified.set(p.code, ahora);
    mostrarNotificacionProducto(p);
  });
}

// =====================
// Inicialización
// =====================
solicitarPermisoNotificaciones();
setInterval(mostrarAlertasPeriodicas, NOTIFY_INTERVAL_MS);
