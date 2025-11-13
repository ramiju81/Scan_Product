// static/js/carga.js
// Carga de productos desde CSV a Supabase (tabla "productos")

const csvFileInput = document.getElementById("csvFile");
const btnLoadCsv   = document.getElementById("btnLoadCsv");
const csvStatus    = document.getElementById("csvStatus");

btnLoadCsv.addEventListener("click", async () => {
  const file = csvFileInput.files && csvFileInput.files[0];
  if (!file) {
    setStatus("Por favor selecciona un archivo CSV primero.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    await cargarProductosDesdeCsv(text);
  };
  reader.onerror = () => {
    setStatus("Error leyendo el archivo CSV.", "error");
  };
  reader.readAsText(file, "utf-8");
});

function setStatus(msg, type) {
  if (!csvStatus) return;
  csvStatus.textContent = msg;
  csvStatus.className = "status-info " + (type === "ok" ? "ok" : type === "error" ? "error" : "info");
}

async function cargarProductosDesdeCsv(text) {
  const lineas = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lineas.length <= 1) {
    setStatus("El CSV no tiene datos suficientes.", "error");
    return;
  }

  const headers = lineas[0].split(",").map(h => h.trim().toLowerCase());

  const idxCode     = headers.indexOf("code");
  const idxName     = headers.indexOf("name");
  const idxCompany  = headers.indexOf("company");
  const idxLocation = headers.indexOf("location");
  const idxArea     = headers.indexOf("area");
  const idxLot      = headers.indexOf("lot");
  const idxMade     = headers.indexOf("made_date");
  const idxExpiry   = headers.indexOf("expiry_date");

  if ([idxCode, idxName, idxCompany, idxLocation, idxArea, idxLot, idxMade, idxExpiry].some(i => i === -1)) {
    setStatus(
      "Encabezados inválidos. Deben ser: code,name,company,location,area,lot,made_date,expiry_date",
      "error"
    );
    return;
  }

  const productos = [];
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (!linea) continue;
    const cols = linea.split(",");
    if (cols.length < headers.length) continue;

    const code = (cols[idxCode] || "").trim();
    if (!code) continue;

    productos.push({
      code,
      name:       (cols[idxName]     || "").trim(),
      company:    (cols[idxCompany]  || "").trim(),
      location:   (cols[idxLocation] || "").trim(),
      area:       (cols[idxArea]     || "").trim(),
      lot:        (cols[idxLot]      || "").trim(),
      made_date:  (cols[idxMade]     || "").trim(),
      expiry_date:(cols[idxExpiry]   || "").trim(),
    });
  }

  if (productos.length === 0) {
    setStatus("No se encontraron productos válidos en el CSV.", "error");
    return;
  }

  setStatus("Subiendo productos a la nube...", "info");

  const { error } = await window.supabaseClient
    .from("productos")
    .upsert(productos, { onConflict: "code" });

  if (error) {
    console.error(error);
    setStatus("Error al guardar en Supabase: " + error.message, "error");
    return;
  }

  setStatus(`Se cargaron/actualizaron ${productos.length} productos en la nube.`, "ok");
}
