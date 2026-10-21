export interface ItemCatalogo {
  id: number;
  nombre: string;
  unidad_base: string;
  tipo: "ingrediente" | "envase" | "bebida";
}

export interface LineaDocumento {
  descripcion: string;
  cantidad: number | null;
  unidad_linea: string | null;
  precio_unitario: number | null;
  subtotal: number | null;
  item_id: number | null;
  contenido: number | null;
  unidad_contenido: string | null;
  iva_pct: number | null;
  importe_con_iva: boolean;
}

export interface CabeceraDocumento {
  numero: string | null;
  fecha: string | null;
  proveedor_texto: string | null;
  total_base: number | null;
  total_con_iva: number | null;
}

export interface ResultadoDocumento {
  lineas: LineaDocumento[];
  cabecera: CabeceraDocumento;
  crudo: string;
}

const RUIDO_LINEA =
  /(\btotal\b|\biva\b|\bbase\b|impuesto|descuento|recargo|factura|albar|p[áa]gina|tel[ée]fono|tfno|nif|cif|cliente|direcci|email|e-mail|www|http|subtotal|transporte|remitido|pedido|firma|recib[íi]|conform|raz[óo]n social|formas? de pago|vencimiento|fecha|hora|observaciones|remitente|destinatario|domicilio|atenci[óo]n|referencia|cuota|registro|sanitario|conforme|whatsapp|avda|avenida)/i;

const MARCA_LOTE = /\blote\b/i;

// Cabecera de tabla de artículos: a partir de ahí empiezan las líneas de producto
const INICIO_TABLA =
  /ref\.?\s|descripci[oó]n|art[ií]culo|concepto|producto/i;

const UNIDADES = /\b(kgs?|kilo[s]?|grs?|gramo[s]?|lts?|litro[s]?|ml|uds?|unid(?:\.|ades)?|cajas?|botellas?|bolsas?|packs?)\b/i;

const NUMERO_RE = /\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,4})?|\d+(?:[.,]\d+)?/g;

// Tamaño de presentación en la descripción: "5 KG", "1L", "200GR", "0,5 l"
const CONTENIDO_RE = /(\d+(?:[.,]\d+)?)\s*(ml|kgs?|kilo[s]?|grs?|g|lts?|lt|l)\b/i;

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

export function scoreCoincidencia(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  // Contención: el texto de la línea suele llevar marcas/códigos extra
  if (nb.includes(na) && na.length >= 4) return 0.92;
  if (na.includes(nb) && nb.length >= 4) return 0.85;

  const ga = bigrams(na);
  const gb = bigrams(nb);
  let interseccion = 0;
  let totalA = 0;
  let totalB = 0;
  ga.forEach((c) => (totalA += c));
  gb.forEach((c) => (totalB += c));
  ga.forEach((c, k) => (interseccion += Math.min(c, gb.get(k) ?? 0)));
  if (totalA + totalB === 0) return 0;
  return (2 * interseccion) / (totalA + totalB);
}

export function mejorCoincidencia(
  texto: string,
  candidatos: { id: number; nombre: string }[],
  umbral = 0.5
): { id: number; score: number } | null {
  let mejor: { id: number; score: number } | null = null;
  for (const c of candidatos) {
    const score = scoreCoincidencia(texto, c.nombre);
    if (!mejor || score > mejor.score) mejor = { id: c.id, score };
  }
  if (!mejor || mejor.score < umbral) return null;
  return mejor;
}

export function convertirUnidad(cantidad: number, desde: string, hacia: string): number {
  const d = desde.toLowerCase();
  const h = hacia.toLowerCase();
  if (d === h) return cantidad;
  if ((d === "kg" && h === "g") || (d === "l" && h === "ml")) return cantidad * 1000;
  if ((d === "g" && h === "kg") || (d === "ml" && h === "l")) return cantidad / 1000;
  return cantidad;
}

export function normalizarUnidad(u: string): string | null {
  const s = u.toLowerCase().trim();
  if (/^kg|^kilo/.test(s)) return "kg";
  if (s === "ml") return "ml";
  if (/^g$|^gr|^gram/.test(s)) return "g";
  if (/^l$|^lt|^litro/.test(s)) return "l";
  if (/^u|^unid/.test(s)) return "ud";
  return null;
}

function familiaUnidad(u: string): "masa" | "vol" | "ud" | null {
  const n = normalizarUnidad(u) ?? u.toLowerCase().trim();
  if (n === "kg" || n === "g") return "masa";
  if (n === "l" || n === "ml") return "vol";
  if (n === "ud") return "ud";
  return null;
}

/**
 * Cantidad real que entra en la unidad del artículo:
 * uds × tamaño de presentación si es compatible ("2 latas de 5kg" → 10 kg),
 * o la cantidad convertida desde la unidad detectada en la línea.
 */
export function calcularCantidadReal(
  uds: number,
  contenido: number | null,
  unidadContenido: string | null,
  unidadLinea: string | null,
  unidadBase: string
): number | null {
  if (!isFinite(uds) || uds <= 0) return null;

  if (contenido != null && unidadContenido) {
    const famCont = familiaUnidad(unidadContenido);
    const famBase = familiaUnidad(unidadBase);
    if (famCont && famCont === famBase) {
      const porUd = convertirUnidad(contenido, unidadContenido, unidadBase);
      return Math.round(uds * porUd * 1000) / 1000;
    }
  }

  if (unidadLinea) {
    const famLin = familiaUnidad(unidadLinea);
    const famBase = familiaUnidad(unidadBase);
    if (famLin && famLin === famBase) {
      return Math.round(convertirUnidad(uds, unidadLinea, unidadBase) * 1000) / 1000;
    }
  }

  return Math.round(uds * 1000) / 1000;
}

export function parsearNumeroES(token: string): number {
  let t = token.trim();
  const tienePunto = t.includes(".");
  const tieneComa = t.includes(",");

  if (tienePunto && tieneComa) {
    // El último separador es el decimal
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) {
      t = t.replace(/\./g, "").replace(",", ".");
    } else {
      t = t.replace(/,/g, "");
    }
  } else if (tieneComa) {
    // En documentos españoles la coma es decimal
    t = t.replace(",", ".");
  } else if (tienePunto && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    // Miles: 1.234
    t = t.replace(/\./g, "");
  }

  const n = parseFloat(t);
  return isNaN(n) ? NaN : n;
}

function extraerNumeros(segmento: string): { valor: number; token: string; pos: number; fin: number }[] {
  const res: { valor: number; token: string; pos: number; fin: number }[] = [];
  const re = new RegExp(NUMERO_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(segmento))) {
    const valor = parsearNumeroES(m[0]);
    if (!isNaN(valor)) res.push({ valor, token: m[0], pos: m.index, fin: m.index + m[0].length });
  }
  return res;
}

function contarLetras(s: string): number {
  return s.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, "").length;
}

function consistente(cant: number, precio: number, importe: number): boolean {
  if (cant <= 0 || precio <= 0 || importe <= 0) return false;
  const esperado = cant * precio;
  const tolerancia = Math.max(0.05, importe * 0.02);
  return Math.abs(esperado - importe) <= tolerancia;
}

const IVA_VALIDO = new Set([0, 4, 10, 15, 21]);

function parsearFecha(texto: string): string | null {
  let m = texto.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = texto.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = texto.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b/);
  if (m) return `20${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function parsearCabecera(lineas: string[]): CabeceraDocumento {
  const cabecera: CabeceraDocumento = {
    numero: null,
    fecha: null,
    proveedor_texto: null,
    total_base: null,
    total_con_iva: null,
  };
  const max = Math.min(lineas.length, 30);

  // Totales del pie (se queda con la última aparición: es el resumen final)
  const maxTot = Math.min(lineas.length, 80);
  let cuotaIva: number | null = null;
  for (let i = 0; i < maxTot; i++) {
    const l = lineas[i];
    const mb = l.match(/\bbase(?:\s+imponible)?\b[^0-9]*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|[\d]+[.,]\d{1,2})/i);
    if (mb) {
      const v = parsearNumeroES(mb[1]);
      if (!isNaN(v) && v > 0) cabecera.total_base = v;
    }
    const mt = l.match(/\btotal\b(?!\s*kilos)[^0-9]*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|[\d]+[.,]\d{1,2})/i);
    if (mt) {
      const v = parsearNumeroES(mt[1]);
      if (!isNaN(v) && v > 0) cabecera.total_con_iva = v;
    }
    // Cuota IVA del pie (los OCR suelen partir TOTAL y su importe en dos líneas,
    // así que el total con IVA se deriva de Base + Cuota)
    const seg = /iva([^]*)/i.exec(l);
    if (seg) {
      const numsSeg = [...seg[1].matchAll(new RegExp(NUMERO_RE.source, "g"))];
      if (numsSeg.length > 0) {
        const last = numsSeg[numsSeg.length - 1];
        const tras = seg[1].slice(last.index! + last[0].length, last.index! + last[0].length + 4);
        if (!/^\s*%/.test(tras)) {
          const v = parsearNumeroES(last[0]);
          if (!isNaN(v) && v > 0) cuotaIva = v;
        }
      }
    }
  }
  if (cabecera.total_con_iva == null && cabecera.total_base != null) {
    cabecera.total_con_iva =
      Math.round((cabecera.total_base + (cuotaIva ?? 0)) * 100) / 100;
  }

  for (let i = 0; i < max; i++) {
    const l = lineas[i];
    if (!cabecera.numero) {
      const m =
        l.match(/albar[aá]n(?:\s*n[ºo°.]*)?\s*[:\-]?\s+(\S.{2,})/i) ||
        l.match(/\bn[ºo°.]\s*[:.]?\s+(\S.{2,})/i);
      if (m) cabecera.numero = m[1].replace(/\s*:\s*\S+$/, "").replace(/[\s,;:\-–—]+$/, "");
    }
    if (!cabecera.fecha) {
      const f = l.match(/fecha/i) ? parsearFecha(l) : null;
      if (f) cabecera.fecha = f;
    }
    if (!cabecera.proveedor_texto) {
      const m = l.match(/proveedor\s*[:\-]?\s+(.{3,})/i);
      if (m) cabecera.proveedor_texto = m[1].trim();
    }
  }
  if (!cabecera.fecha) {
    for (let i = 0; i < max; i++) {
      const f = parsearFecha(lineas[i]);
      if (f) {
        cabecera.fecha = f;
        break;
      }
    }
  }
  return cabecera;
}

function parsearLinea(linea: string, items: ItemCatalogo[]): LineaDocumento | null {
  if (RUIDO_LINEA.test(linea)) return null;

  // El detalle de lote viene en línea propia o al final de la línea de
  // producto: solo se analiza la parte anterior a la marca "LOTE"
  const corteLote = linea.search(MARCA_LOTE);
  const textoLinea = corteLote >= 0 ? linea.slice(0, corteLote) : linea;

  const nums = extraerNumeros(textoLinea);
  if (nums.length === 0) return null;

  const n = nums.length;
  let cantidad: number | null = null;
  let precio: number | null = null;
  let subtotal: number | null = null;
  let idxCant = -1;
  let idxPrecio = -1;
  let importeConIva = false;
  let ivaDetectado: number | null = null;

  // Las columnas de los albaranes están alineadas por la derecha:
  // [... caj uds precio iva importe] — la validación c×p≈importe elige
  // la columna correcta aunque la descripción lleve números (refs, C-16, 1KG...)
  const intento = (ic: number, ip: number, ii: number): boolean => {
    if (ic < 0 || ip < 0 || ii < 0 || ic === ip || ic === ii || ip === ii) return false;
    const c = nums[ic].valor;
    const p = nums[ip].valor;
    const imp = nums[ii].valor;
    if (consistente(c, p, imp)) {
      cantidad = c;
      precio = p;
      subtotal = imp;
      idxCant = ic;
      idxPrecio = ip;
      importeConIva = false;
      return true;
    }
    // Algunos albaranes incluyen el IVA en el importe de la línea
    const ivas = nums.filter(
      (x, k) => k !== ic && k !== ip && k !== ii && IVA_VALIDO.has(x.valor) && x.valor > 0
    );
    for (const iv of ivas) {
      const esperado = c * p * (1 + iv.valor / 100);
      if (Math.abs(esperado - imp) <= Math.max(0.05, imp * 0.02)) {
        cantidad = c;
        precio = p;
        subtotal = imp;
        idxCant = ic;
        idxPrecio = ip;
        importeConIva = true;
        ivaDetectado = iv.valor;
        return true;
      }
    }
    return false;
  };

  if (n === 1) {
    cantidad = nums[0].valor;
    idxCant = 0;
  } else if (n === 2) {
    cantidad = nums[0].valor;
    precio = nums[1].valor;
    subtotal = cantidad * precio;
    idxCant = 0;
    idxPrecio = 1;
  } else if (n === 3) {
    if (!intento(0, 1, 2)) {
      cantidad = nums[0].valor;
      precio = nums[1].valor;
      subtotal = nums[2].valor;
      idxCant = 0;
      idxPrecio = 1;
    }
  } else {
    const hayIva = IVA_VALIDO.has(nums[n - 2].valor);
    if (hayIva && n >= 5) {
      // [ref?] caj uds precio iva importe → cantidad = uds
      if (!intento(n - 4, n - 3, n - 1)) intento(n - 5, n - 3, n - 1);
    }
    if (cantidad === null && n >= 4) {
      // [ref?] caj uds precio importe (sin columna IVA)
      if (!intento(n - 3, n - 2, n - 1)) intento(n - 4, n - 2, n - 1);
    }
    if (cantidad === null) {
      // Búsqueda por pares: primer c×p ≈ importe
      buscar: for (let i = 0; i < n - 2; i++) {
        for (let j = i + 1; j < n - 1; j++) {
          if (intento(i, j, n - 1)) break buscar;
        }
      }
    }
    if (cantidad === null) {
      // Último recurso: alinear por la derecha
      const base = Math.max(0, n - 4);
      cantidad = nums[base].valor;
      precio = nums[Math.min(base + 1, n - 2)].valor;
      subtotal = nums[n - 1].valor;
      idxCant = base;
      idxPrecio = Math.min(base + 1, n - 2);
    }
  }

  // Tamaño de presentación detectado en la descripción ("5 KG", "1L", "200GR").
  // Se ignora si coincide con la columna de cantidad (ese "2,5 kg" es la
  // unidad del documento, no el tamaño del envase)
  let contenido: number | null = null;
  let unidad_contenido: string | null = null;
  const mc = textoLinea.match(CONTENIDO_RE);
  const esUnidadDeCantidad = mc != null && idxCant >= 0 && mc.index === nums[idxCant].pos;
  if (mc && !esUnidadDeCantidad) {
    const valor = parsearNumeroES(mc[1]);
    const ud = normalizarUnidad(mc[2]);
    if (!isNaN(valor) && valor > 0 && ud && ud !== "ud") {
      contenido = valor;
      unidad_contenido = ud;
    }
  }

  // Descripción: el texto antes del primer número de la línea; si no hay
  // (la línea empieza por referencia), se eliminan todos los números
  let descripcion = textoLinea.slice(0, nums[0].pos).trim();
  if (contarLetras(descripcion) < 3) {
    descripcion = textoLinea
      .replace(new RegExp(NUMERO_RE.source, "g"), " ")
      .replace(/\s+/g, " ")
      .replace(/[,.;:\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (contarLetras(descripcion) < 2) return null;

  // Unidad entre la cantidad y el precio
  let unidad_linea: string | null = null;
  if (idxCant >= 0 && idxPrecio >= 0 && idxPrecio === idxCant + 1) {
    const trozo = textoLinea.slice(nums[idxCant].fin, nums[idxPrecio].pos);
    const um = trozo.match(UNIDADES);
    if (um) unidad_linea = um[0].toLowerCase();
  }

  // Match contra el catálogo; las líneas de un solo número deben parecerse
  // a un artículo real para no tragarse cifras sueltas (códigos postales...)
  const paraMatch = descripcion.replace(/^[a-z]{0,4}[-\s]?\d{3,}\s+/i, "");
  const match = mejorCoincidencia(paraMatch || descripcion, items);
  if (n === 1 && (!match || match.score < 0.35)) return null;

  const colIva =
    n >= 4 && IVA_VALIDO.has(nums[n - 2].valor) && nums[n - 2].valor > 0
      ? nums[n - 2].valor
      : null;

  return {
    descripcion,
    cantidad,
    unidad_linea,
    precio_unitario: precio,
    subtotal,
    item_id: match && match.score >= 0.5 ? match.id : null,
    contenido,
    unidad_contenido,
    iva_pct: ivaDetectado ?? colIva,
    importe_con_iva: importeConIva,
  };
}

export function parsearDocumento(texto: string, items: ItemCatalogo[]): ResultadoDocumento {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const cabecera = parsearCabecera(lineas);

  // Si aparece la cabecera de tabla, solo se analizan sus filas; si el OCR
  // no la legió, se analiza el texto completo (los filtros de ruido actúan)
  let inicio = lineas.findIndex((l, i) => i > 0 && INICIO_TABLA.test(l));
  if (inicio < 0) inicio = 0;

  const lineasDoc: LineaDocumento[] = [];
  for (let i = inicio + 1; i < lineas.length; i++) {
    const parsed = parsearLinea(lineas[i], items);
    if (parsed) lineasDoc.push(parsed);
  }

  return { lineas: lineasDoc, cabecera, crudo: texto };
}
