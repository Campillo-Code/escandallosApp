import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { getAlergenoLabel } from "./alergenos";

interface RecetaData {
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  porciones: number;
  tiempo_preparacion: number | null;
  precio_venta: number | null;
  margen_porcentaje: number | null;
  peso_por_racion?: number | null;
  ingredientes: {
    ingrediente_nombre: string;
    cantidad: number;
    unidad: string;
    precio_unitario: number | null;
    merma_porcentaje: number;
    coste: number;
  }[];
  alergenos: string[];
  coste_total: number;
  coste_porcion: number;
  food_cost_pct: number | null;
  margen_real_pct: number | null;
  guarniciones?: {
    nombre: string;
    coste_total: number;
    ingredientes: {
      ingrediente_nombre: string;
      cantidad: number;
      unidad: string;
      precio_por_unidad_receta: number | null;
      coste: number;
    }[];
  }[];
}

export async function exportRecetaPDF(receta: RecetaData) {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text(receta.nombre, 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  let y = 30;
  if (receta.descripcion) {
    doc.text(receta.descripcion, 14, y);
    y += 8;
  }

  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(`Porciones: ${receta.porciones}`, 14, y);
  let x2 = 80;
  if (receta.tiempo_preparacion) {
    doc.text(`Tiempo: ${receta.tiempo_preparacion} min`, x2, y);
    x2 += 50;
  }
  if (receta.peso_por_racion) {
    doc.text(`Peso/ración: ${receta.peso_por_racion} g`, x2, y);
    x2 += 50;
  }
  if (receta.categoria) {
    doc.text(`Categoría: ${receta.categoria}`, x2, y);
  }
  y += 10;

  if (receta.alergenos.length > 0) {
    doc.setFontSize(11);
    doc.text(`Alérgenos: ${receta.alergenos.join(", ")}`, 14, y);
    y += 10;
  }

  doc.setFontSize(14);
  doc.text("Ingredientes", 14, y);
  y += 4;

  const ingData = receta.ingredientes.map((ing) => [
    ing.ingrediente_nombre,
    `${ing.cantidad} ${ing.unidad}`,
    ing.precio_unitario != null ? `${ing.precio_unitario.toFixed(4)} €` : "-",
    `${ing.merma_porcentaje}%`,
    `${ing.coste.toFixed(2)} €`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Ingrediente", "Cantidad", "Precio/ud", "Merma", "Coste"]],
    body: ingData,
    theme: "striped",
    styles: { fontSize: 9 },
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 10;

  doc.setFontSize(14);
  doc.text("Costes", 14, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`Coste total: ${receta.coste_total.toFixed(2)} €`, 14, y);
  doc.text(`Coste por porción: ${receta.coste_porcion.toFixed(2)} €`, 120, y);
  y += 8;

  if (receta.food_cost_pct != null) {
    doc.text(`Food Cost: ${receta.food_cost_pct.toFixed(1)}%`, 14, y);
  }
  if (receta.margen_real_pct != null) {
    doc.text(`Margen real: ${receta.margen_real_pct.toFixed(1)}%`, 120, y);
    y += 8;
  }
  if (receta.precio_venta != null) {
    doc.text(`Precio venta: ${receta.precio_venta.toFixed(2)} €/porción`, 14, y);
  }

  if (receta.guarniciones && receta.guarniciones.length > 0) {
    y += 14;
    doc.setFontSize(14);
    doc.text("Guarniciones", 14, y);
    y += 6;

    let totalGuarniciones = 0;
    for (const g of receta.guarniciones) {
      totalGuarniciones += g.coste_total;

      doc.setFontSize(11);
      doc.text(`+ ${g.nombre}`, 14, y);
      doc.text(`Coste: ${g.coste_total.toFixed(2)} €`, 160, y);
      y += 6;

      const guarnData = g.ingredientes.map((ing) => [
        ing.ingrediente_nombre,
        `${ing.cantidad} ${ing.unidad}`,
        ing.precio_por_unidad_receta != null ? `${ing.precio_por_unidad_receta.toFixed(4)} €` : "-",
        `${ing.coste.toFixed(2)} €`,
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Ingrediente", "Cantidad", "Precio/ud", "Coste"]],
        body: guarnData,
        theme: "striped",
        styles: { fontSize: 8 },
        margin: { left: 20 },
      });

      // @ts-ignore
      y = doc.lastAutoTable.finalY + 6;
    }

    doc.setFontSize(11);
    doc.text(`Total guarniciones: ${totalGuarniciones.toFixed(2)} €`, 14, y);
    y += 6;
    doc.setFontSize(12);
    doc.text(`Coste total (receta + guarniciones): ${(receta.coste_total + totalGuarniciones).toFixed(2)} €`, 14, y);
  }

  const fileName = `${receta.nombre.replace(/\s+/g, "_")}.pdf`;
  const home = await homeDir();
  const path = await save({
    defaultPath: `${home}/${fileName}`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (path) {
    const pdfBytes = doc.output("arraybuffer");
    await writeFile(path, new Uint8Array(pdfBytes));
  }
}

export async function exportIngredientesExcel(ingredientes: {
  nombre: string;
  unidad_base: string;
  categoria: string | null;
  precio: number | null;
  proveedor_nombre: string | null;
}[]) {
  const data = ingredientes.map((i) => ({
    Nombre: i.nombre,
    Unidad: i.unidad_base,
    Categoría: i.categoria ?? "",
    Precio: i.precio != null ? i.precio : "",
    Proveedor: i.proveedor_nombre ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ingredientes");

  const xlsxBytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const path = await save({
    defaultPath: "ingredientes.xlsx",
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (path) {
    await writeFile(path, new Uint8Array(xlsxBytes));
  }
}

export async function exportRecetasExcel(recetas: {
  nombre: string;
  categoria: string | null;
  porciones: number;
  precio_venta: number | null;
  coste_total: number;
  food_cost_pct: number | null;
}[]) {
  const data = recetas.map((r) => ({
    Nombre: r.nombre,
    Categoría: r.categoria ?? "",
    Porciones: r.porciones,
    "Precio venta": r.precio_venta != null ? r.precio_venta : "",
    "Coste total": r.coste_total.toFixed(2),
    "Food Cost %": r.food_cost_pct != null ? `${r.food_cost_pct.toFixed(1)}%` : "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Recetas");

  const xlsxBytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const path = await save({
    defaultPath: "recetas.xlsx",
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (path) {
    await writeFile(path, new Uint8Array(xlsxBytes));
  }
}

export async function exportInventarioExcel(items: {
  ingrediente_nombre: string | null;
  stock_actual: number;
  stock_minimo: number;
  unidad: string;
  ubicacion: string | null;
}[]) {
  const data = items.map((i) => ({
    Ingrediente: i.ingrediente_nombre ?? "",
    "Stock Actual": i.stock_actual,
    "Stock Mínimo": i.stock_minimo,
    Unidad: i.unidad,
    Ubicación: i.ubicacion ?? "",
    Estado: i.stock_actual <= i.stock_minimo ? "BAJO" : "OK",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");

  const xlsxBytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const path = await save({
    defaultPath: "inventario.xlsx",
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (path) {
    await writeFile(path, new Uint8Array(xlsxBytes));
  }
}

export async function exportInventarioPDF(items: {
  ingrediente_nombre: string | null;
  stock_actual: number;
  stock_minimo: number;
  unidad: string;
  ubicacion: string | null;
}[]) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Inventario", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES")}`, 14, 28);
  doc.setTextColor(0);

  const tableData = items.map((i) => [
    i.ingrediente_nombre ?? "",
    `${i.stock_actual % 1 === 0 ? i.stock_actual.toFixed(0) : i.stock_actual.toFixed(3)} ${i.unidad}`,
    `${i.stock_minimo % 1 === 0 ? i.stock_minimo.toFixed(0) : i.stock_minimo.toFixed(3)} ${i.unidad}`,
    i.ubicacion ?? "-",
    i.stock_actual <= i.stock_minimo ? "BAJO" : "OK",
  ]);

  autoTable(doc, {
    startY: 34,
    head: [["Ingrediente", "Stock Actual", "Stock Mínimo", "Ubicación", "Estado"]],
    body: tableData,
    theme: "striped",
    styles: { fontSize: 9 },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.cell.raw === "BAJO") {
        data.cell.styles.textColor = [220, 38, 38];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const path = await save({
    defaultPath: "inventario.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (path) {
    const blob = doc.output("blob");
    const buffer = await blob.arrayBuffer();
    await writeFile(path, new Uint8Array(buffer));
  }
}

export async function exportAlbaranPDF(albaran: {
  numero_albaran: string | null;
  proveedor_nombre: string | null;
  fecha_recepcion: string;
  total: number | null;
  notas: string | null;
  procesado: boolean;
}, detalles: {
  ingrediente_nombre: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  subtotal: number | null;
}[]) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(`Albarán ${albaran.numero_albaran ?? "#"}`, 14, 20);

  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`Proveedor: ${albaran.proveedor_nombre ?? "-"}`, 14, 30);
  doc.text(`Fecha: ${albaran.fecha_recepcion}`, 14, 38);
  doc.text(`Estado: ${albaran.procesado ? "Procesado" : "Pendiente"}`, 14, 46);

  if (albaran.notas) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Notas: ${albaran.notas}`, 14, 54);
  }

  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.text("Detalle", 14, 66);

  const tableData = detalles.map((d) => [
    d.ingrediente_nombre ?? "",
    `${d.cantidad} ${d.unidad}`,
    `${d.precio_unitario.toFixed(4)} €`,
    `${(d.subtotal ?? 0).toFixed(2)} €`,
  ]);

  autoTable(doc, {
    startY: 70,
    head: [["Ingrediente", "Cantidad", "Precio Unit.", "Subtotal"]],
    body: tableData,
    theme: "striped",
    styles: { fontSize: 9 },
  });

  // @ts-ignore
  const y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text(`Total: ${albaran.total?.toFixed(2) ?? "-"} €`, 14, y);

  const fileName = `albaran_${albaran.numero_albaran ?? albaran.fecha_recepcion}.pdf`;
  const home = await homeDir();
  const path = await save({
    defaultPath: `${home}/${fileName}`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (path) {
    const blob = doc.output("blob");
    const buffer = await blob.arrayBuffer();
    await writeFile(path, new Uint8Array(buffer));
  }
}

// ========================================
// INGREDIENTES EXCEL
// ========================================
// FICHA TECNICA PDF (sin costes)
// ========================================

interface FichaTecnicaData {
  receta_nombre: string;
  codigo_interno: string | null;
  fecha: string | null;
  descripcion: string | null;
  ingredientes: { ingrediente_nombre: string; cantidad: number; unidad: string; }[];
  alergenos: string[];
  pasos_preparacion: string | null;
  conservacion: string | null;
  vida_util: string | null;
  fotos: string | null;
}

export async function exportFichaTecnicaPDF(ficha: FichaTecnicaData) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const ml = 14;
  const cw = pageW - 28;

  // Colors matching the app (Tailwind indigo palette)
  const indigo900: [number, number, number] = [49, 46, 129];
  const indigo200: [number, number, number] = [199, 210, 254];
  const indigo100: [number, number, number] = [224, 231, 255];
  const indigo50: [number, number, number] = [238, 242, 255];
  const gray100: [number, number, number] = [243, 244, 246];

  const sectionHeader = (title: string, yPos: number) => {
    if (yPos > 260) { doc.addPage(); yPos = 20; }
    doc.setFillColor(...indigo200);
    doc.rect(ml, yPos, cw, 8, "F");
    doc.setFontSize(8);
    doc.setTextColor(...indigo900);
    doc.setFont("helvetica", "bold");
    doc.text(title, ml + 4, yPos + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    return yPos + 10;
  };

  let y = 10;

  // ═══ HEADER (indigo-900) ═══
  doc.setFillColor(...indigo900);
  doc.rect(ml, y, cw, 12, "F");
  doc.setFontSize(15);
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA TÉCNICA DE RECETA", pageW / 2, y + 8, { align: "center" });
  y += 12;

  // ═══ CÓDIGO INTERNO (indigo-100) ═══
  doc.setFillColor(...indigo100);
  doc.rect(ml, y, cw, 8, "F");
  doc.setFontSize(9);
  doc.setTextColor(...indigo900);
  doc.setFont("helvetica", "bold");
  doc.text(`CÓDIGO INTERNO: ${ficha.codigo_interno || "—"}`, ml + 4, y + 5.5);
  y += 8;

  // ═══ NOMBRE DEL PLATO (indigo-50) ═══
  doc.setFillColor(...indigo50);
  doc.rect(ml, y, cw, 9, "F");
  doc.setFontSize(11);
  doc.setTextColor(...indigo900);
  doc.text(`NOMBRE DEL PLATO: ${ficha.receta_nombre}`, ml + 4, y + 6.5);
  y += 9;

  // ═══ ROW: FECHA ═══
  const rowH = 10;

  doc.setFillColor(...indigo200);
  doc.rect(ml, y, cw, rowH, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...indigo900);
  doc.text("FECHA", ml + 2, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(ficha.fecha || "—", ml + 20, y + 5);

  y += rowH + 2;

  // ═══ INGREDIENTES (3/5) + IMAGEN (2/5) ═══
  const ingW = (cw * 3) / 5;
  const imgW = (cw * 2) / 5;
  const imgStartY = y;

  // Ingredientes header (indigo-200)
  doc.setFillColor(...indigo200);
  doc.rect(ml, y, ingW, 8, "F");
  doc.setFontSize(8);
  doc.setTextColor(...indigo900);
  doc.setFont("helvetica", "bold");
  doc.text("INGREDIENTES", ml + 4, y + 5.5);
  y += 8;

  // Ingredientes table
  const ingData = ficha.ingredientes
    .filter(ing => ing.ingrediente_nombre && ing.ingrediente_nombre.trim() !== "")
    .map((ing) => [
      ing.ingrediente_nombre,
      `${ing.cantidad} ${ing.unidad}`,
    ]);

  if (ingData.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Ingrediente", "Cantidad"]],
      body: ingData,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 1: { halign: "right" as const } },
      margin: { left: ml, right: pageW - ml - ingW },
      tableWidth: ingW,
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("Sin ingredientes", ml + 4, y + 6);
    y += 10;
  }

  // Image (right column, extending below ingredients for more height)
  const imgBoxH = Math.max(y - imgStartY, 60);
  if (ficha.fotos && ficha.fotos.startsWith("data:image")) {
    try {
      const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = ficha.fotos!;
      });
      const imgRatio = imgEl.width / imgEl.height;
      const boxRatio = imgW / imgBoxH;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgRatio > boxRatio) {
        drawW = imgW;
        drawH = imgW / imgRatio;
        drawX = ml + ingW;
        drawY = imgStartY + (imgBoxH - drawH) / 2;
      } else {
        drawH = imgBoxH;
        drawW = imgBoxH * imgRatio;
        drawX = ml + ingW + (imgW - drawW) / 2;
        drawY = imgStartY;
      }
      doc.addImage(ficha.fotos, "JPEG", drawX, drawY, drawW, drawH);
    } catch {
      doc.setFillColor(...gray100);
      doc.rect(ml + ingW, imgStartY, imgW, imgBoxH, "F");
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.setFont("helvetica", "normal");
      doc.text("IMAGEN RECETA", ml + ingW + imgW / 2, imgStartY + imgBoxH / 2, { align: "center" });
    }
  } else {
    doc.setFillColor(...gray100);
    doc.rect(ml + ingW, imgStartY, imgW, imgBoxH, "F");
    doc.setDrawColor(200);
    doc.rect(ml + ingW, imgStartY, imgW, imgBoxH, "S");
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.setFont("helvetica", "normal");
    doc.text("IMAGEN RECETA", ml + ingW + imgW / 2, imgStartY + imgBoxH / 2, { align: "center" });
  }

  y = imgStartY + imgBoxH + 4;

  // ═══ ALÉRGENOS ═══
  if (ficha.alergenos.length > 0) {
    y = sectionHeader("ALÉRGENOS", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(ficha.alergenos.join(", "), ml + 4, y + 4);
    y += 10;
  }

  // ═══ DESCRIPCIÓN ═══
  y = sectionHeader("DESCRIPCIÓN", y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  if (ficha.descripcion) {
    const lineas = ficha.descripcion.split("\n");
    for (const linea of lineas) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(linea, ml + 4, y + 4);
      y += 5;
    }
  } else {
    doc.setTextColor(150);
    doc.text("—", ml + 4, y + 4);
  }
  y += 5;

  // ═══ INFORMACIÓN DE SEGURIDAD Y CALIDAD ═══
  if (ficha.pasos_preparacion) {
    y = sectionHeader("INFORMACIÓN DE SEGURIDAD Y CALIDAD", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    const lineas = ficha.pasos_preparacion.split("\n");
    for (const linea of lineas) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(linea, ml + 4, y + 4);
      y += 5;
    }
    y += 5;
  }

  // ═══ CONSERVACIÓN ═══
  if (ficha.conservacion) {
    y = sectionHeader("CONSERVACIÓN", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(ficha.conservacion, ml + 4, y + 4);
    y += 10;
  }

  // ═══ VIDA ÚTIL ═══
  if (ficha.vida_util) {
    y = sectionHeader("VIDA ÚTIL", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(ficha.vida_util, ml + 4, y + 4);
    y += 10;
  }

  const fileName = `ficha_tecnica_${ficha.receta_nombre.replace(/\s+/g, "_")}.pdf`;
  const home = await homeDir();
  const path = await save({
    defaultPath: `${home}/${fileName}`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (path) {
    const blob = doc.output("blob");
    const buffer = await blob.arrayBuffer();
    await writeFile(path, new Uint8Array(buffer));
  }
}

// ========================================
// ETIQUETA DE PRODUCCIÓN (62x100mm Brother QL)
// ========================================

export interface EtiquetaData {
  receta_nombre: string;
  lote_producto: string;
  fecha_elaboracion: string;
  fecha_caducidad: string | null;
  ingredientes: string[];
  alergenos: string[];
  conservacion: string | null;
  responsable: string | null;
}

const ALLERGEN_MAP: Record<string, string> = {
  gluten: "Gluten",
  crustaceos: "Crustáceos",
  huevos: "Huevos",
  pescado: "Pescado",
  cacahuetes: "Cacahuetes",
  soja: "Soja",
  lactosa: "Lácteos",
  lacteos: "Lácteos",
  frutos_secos: "Frutos secos",
  apio: "Apio",
  mostaza: "Mostaza",
  sesamo: "Sésamo",
  sulphites: "Sulfitos",
  sulfitos: "Sulfitos",
  altramuz: "Altramuz",
  moluscos: "Moluscos",
};

export async function exportEtiquetaPDF(data: EtiquetaData) {
  const labelW = 100;
  const labelH = 62;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [labelW, labelH] });

  const ml = 3;
  const mr = 3;
  const cw = labelW - ml - mr;
  let y = 4;

  // Header
  doc.setFillColor(40, 50, 100);
  doc.rect(0, 0, labelW, 8, "F");
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255);
  doc.text("ELABORADO EN VIVIENDA PARTICULAR", labelW / 2, 5.5, { align: "center" });
  y = 14;

  // Product name
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  const nombreLines = doc.splitTextToSize(data.receta_nombre, cw);
  doc.text(nombreLines, ml, y);
  y += nombreLines.length * 4 + 2;

  // Divider
  doc.setDrawColor(180);
  doc.line(ml, y, labelW - mr, y);
  y += 3;

  // Lot + dates
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60);
  doc.text(`Lote: ${data.lote_producto}`, ml, y);
  y += 3;
  doc.setFont("helvetica", "normal");
  doc.text(`Elab: ${data.fecha_elaboracion}`, ml, y);
  if (data.fecha_caducidad) {
    doc.text(`Cad: ${data.fecha_caducidad}`, ml + cw / 2, y);
  }
  y += 4;

  // Divider
  doc.line(ml, y, labelW - mr, y);
  y += 3;

  // Ingredients
  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60);
  doc.text("INGREDIENTES:", ml, y);
  y += 2.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  const ingText = data.ingredientes.join(", ");
  const ingLines = doc.splitTextToSize(ingText, cw);
  const maxIngLines = 3;
  doc.text(ingLines.slice(0, maxIngLines), ml, y);
  y += Math.min(ingLines.length, maxIngLines) * 2.5 + 1;

  // Allergens
  if (data.alergenos.length > 0) {
    doc.setFillColor(255, 240, 240);
    doc.roundedRect(ml, y - 1, cw, data.alergenos.length > 3 ? 8 : 5.5, 1, 1, "F");
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 0, 0);
    const alergLabels = data.alergenos.map(a => ALLERGEN_MAP[a.toLowerCase()] || a);
    doc.text("ALÉRGENOS:", ml + 1, y + 1.5);
    doc.setFont("helvetica", "normal");
    const alergText = alergLabels.join(", ");
    const alergLines = doc.splitTextToSize(alergText, cw - 2);
    doc.text(alergLines.slice(0, 2), ml + 1, y + 4);
    y += alergLines.length > 2 ? 9 : 6.5;
  }

  // Conservation
  if (data.conservacion) {
    const bottomY = labelH - 4;
    doc.setFontSize(5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    doc.text(`Conservar: ${data.conservacion}`, ml, bottomY);
  }

  const fileName = `etiqueta_${data.lote_producto}.pdf`;
  const home = await homeDir();
  const path = await save({
    defaultPath: `${home}/${fileName}`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (path) {
    const blob = doc.output("blob");
    const buffer = await blob.arrayBuffer();
    await writeFile(path, new Uint8Array(buffer));
  }
}

export async function printEtiquetaPDF(data: EtiquetaData) {
  const labelW = 100;
  const labelH = 62;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [labelW, labelH] });

  const ml = 3;
  const mr = 3;
  const cw = labelW - ml - mr;
  let y = 4;

  doc.setFillColor(40, 50, 100);
  doc.rect(0, 0, labelW, 8, "F");
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255);
  doc.text("ELABORADO EN VIVIENDA PARTICULAR", labelW / 2, 5.5, { align: "center" });
  y = 14;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  const nombreLines = doc.splitTextToSize(data.receta_nombre, cw);
  doc.text(nombreLines, ml, y);
  y += nombreLines.length * 4 + 2;

  doc.setDrawColor(180);
  doc.line(ml, y, labelW - mr, y);
  y += 3;

  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60);
  doc.text(`Lote: ${data.lote_producto}`, ml, y);
  y += 3;
  doc.setFont("helvetica", "normal");
  doc.text(`Elab: ${data.fecha_elaboracion}`, ml, y);
  if (data.fecha_caducidad) {
    doc.text(`Cad: ${data.fecha_caducidad}`, ml + cw / 2, y);
  }
  y += 4;

  doc.line(ml, y, labelW - mr, y);
  y += 3;

  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60);
  doc.text("INGREDIENTES:", ml, y);
  y += 2.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  const ingText = data.ingredientes.join(", ");
  const ingLines = doc.splitTextToSize(ingText, cw);
  const maxIngLines = 3;
  doc.text(ingLines.slice(0, maxIngLines), ml, y);
  y += Math.min(ingLines.length, maxIngLines) * 2.5 + 1;

  if (data.alergenos.length > 0) {
    doc.setFillColor(255, 240, 240);
    doc.roundedRect(ml, y - 1, cw, data.alergenos.length > 3 ? 8 : 5.5, 1, 1, "F");
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 0, 0);
    const alergLabels = data.alergenos.map(a => ALLERGEN_MAP[a.toLowerCase()] || a);
    doc.text("ALÉRGENOS:", ml + 1, y + 1.5);
    doc.setFont("helvetica", "normal");
    const alergText = alergLabels.join(", ");
    const alergLines = doc.splitTextToSize(alergText, cw - 2);
    doc.text(alergLines.slice(0, 2), ml + 1, y + 4);
    y += alergLines.length > 2 ? 9 : 6.5;
  }

  if (data.conservacion) {
    const bottomY = labelH - 4;
    doc.setFontSize(5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    doc.text(`Conservar: ${data.conservacion}`, ml, bottomY);
  }

  const home = await homeDir();
  const tmpPath = `${home}/etiqueta_${data.lote_producto}_tmp.pdf`;
  const blob = doc.output("blob");
  const buffer = await blob.arrayBuffer();
  await writeFile(tmpPath, new Uint8Array(buffer));
  const printerName = localStorage.getItem("selected_printer") || null;
  await invoke<string>("print_pdf_file", { path: tmpPath, printerName });
}

// ========================================
// FICHA DE RECETA PDF
// ========================================

interface FichaRecetaData {
  receta_nombre: string;
  catalogado_en: string | null;
  fecha: string | null;
  porciones: number;
  precio_venta: number | null;
  tiempo_preparacion: number | null;
  ingredientes: { ingrediente_nombre: string; cantidad: number; unidad: string; merma_porcentaje: number; }[];
  coste_ingredientes: { ingrediente_nombre: string; cantidad: number; unidad: string; precio_por_unidad_receta: number | null; coste: number; merma_porcentaje: number; }[];
  alergenos: string[];
  elaboracion: string | null;
  conservacion: string | null;
  regeneracion: string | null;
  vida_util: string | null;
  coste_total: number;
  coste_porcion: number;
  food_cost_pct: number | null;
  margen_real_pct: number | null;
  margen_porcentaje: number | null;
  peso_por_racion?: number | null;
  notas_adicionales: string | null;
  fotos: string | null;
}

export async function exportFichaRecetaPDF(ficha: FichaRecetaData) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const ml = 14;
  const cw = pageW - 28;

  const indigo900: [number, number, number] = [49, 46, 129];
  const indigo200: [number, number, number] = [199, 210, 254];
  const indigo100: [number, number, number] = [224, 231, 255];
  const indigo50: [number, number, number] = [238, 242, 255];
  const gray100: [number, number, number] = [243, 244, 246];

  const sectionHeader = (title: string, yPos: number) => {
    if (yPos > 260) { doc.addPage(); yPos = 20; }
    doc.setFillColor(...indigo200);
    doc.rect(ml, yPos, cw, 8, "F");
    doc.setFontSize(8);
    doc.setTextColor(...indigo900);
    doc.setFont("helvetica", "bold");
    doc.text(title, ml + 4, yPos + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    return yPos + 10;
  };

  let y = 10;

  // HEADER
  doc.setFillColor(...indigo900);
  doc.rect(ml, y, cw, 12, "F");
  doc.setFontSize(15);
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA DE RECETA", pageW / 2, y + 8, { align: "center" });
  y += 12;

  // CÓDIGO INTERNO
  doc.setFillColor(...indigo100);
  doc.rect(ml, y, cw, 8, "F");
  doc.setFontSize(9);
  doc.setTextColor(...indigo900);
  doc.setFont("helvetica", "bold");
  doc.text(`CÓDIGO INTERNO: ${ficha.catalogado_en || "—"}`, ml + 4, y + 5.5);
  y += 8;

  // NOMBRE DEL PLATO
  doc.setFillColor(...indigo50);
  doc.rect(ml, y, cw, 9, "F");
  doc.setFontSize(11);
  doc.setTextColor(...indigo900);
  doc.text(`NOMBRE DEL PLATO: ${ficha.receta_nombre}`, ml + 4, y + 6.5);
  y += 9;

  // ROW: CATALOGADO EN | Nº PORCIONES | PRECIO/PORCIÓN | TIEMPO ELABORACIÓN | PESO/RACIÓN
  const rowH = 10;
  const colW = cw / 5;
  doc.setFillColor(...indigo200);
  doc.rect(ml, y, cw, rowH, "F");

  const drawCell = (label: string, value: string, x: number) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...indigo900);
    doc.text(label, x + 2, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(value, x + 2, y + 8.5);
  };

  drawCell("CATALOGADO EN", ficha.catalogado_en || "—", ml);
  drawCell("Nº PORCIONES", String(ficha.porciones), ml + colW);
  drawCell("PRECIO/PORCIÓN", ficha.precio_venta != null ? `${ficha.precio_venta.toFixed(2)} €` : "—", ml + colW * 2);
  drawCell("TIEMPO ELABOR.", ficha.tiempo_preparacion != null ? `${ficha.tiempo_preparacion} min` : "—", ml + colW * 3);
  drawCell("PESO/RACIÓN", ficha.peso_por_racion != null ? `${ficha.peso_por_racion} g` : "—", ml + colW * 4);

  y += rowH + 2;

  // FECHA
  doc.setFillColor(...indigo200);
  doc.rect(ml, y, cw, 8, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...indigo900);
  doc.text("FECHA", ml + 2, y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(ficha.fecha || "—", ml + 20, y + 5.5);
  y += 10;

  // INGREDIENTES (3/5) + IMAGEN (2/5)
  const ingW = (cw * 3) / 5;
  const imgW = (cw * 2) / 5;
  const imgStartY = y;

  doc.setFillColor(...indigo200);
  doc.rect(ml, y, ingW, 8, "F");
  doc.setFontSize(8);
  doc.setTextColor(...indigo900);
  doc.setFont("helvetica", "bold");
  doc.text("INGREDIENTES Y CANTIDADES", ml + 4, y + 5.5);
  y += 8;

  const ingData = ficha.coste_ingredientes.map((ing) => [
    ing.ingrediente_nombre,
    ing.unidad,
    `${ing.cantidad}`,
    ing.precio_por_unidad_receta != null ? `${ing.precio_por_unidad_receta.toFixed(4)} €` : "-",
    `${ing.merma_porcentaje}%`,
    `${ing.coste.toFixed(2)} €`,
  ]);

  if (ingData.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Ingrediente", "Unidad", "Cantidad", "Precio/ud", "Merma", "Coste"]],
      body: ingData,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 3: { halign: "right" as const }, 4: { halign: "right" as const }, 5: { halign: "right" as const } },
      margin: { left: ml, right: pageW - ml - ingW },
      tableWidth: ingW,
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("Sin ingredientes", ml + 4, y + 6);
    y += 10;
  }

  // Image
  const imgBoxH = Math.max(y - imgStartY, 60);
  if (ficha.fotos && ficha.fotos.startsWith("data:image")) {
    try {
      const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = ficha.fotos!;
      });
      const imgRatio = imgEl.width / imgEl.height;
      const boxRatio = imgW / imgBoxH;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgRatio > boxRatio) {
        drawW = imgW;
        drawH = imgW / imgRatio;
        drawX = ml + ingW;
        drawY = imgStartY + (imgBoxH - drawH) / 2;
      } else {
        drawH = imgBoxH;
        drawW = imgBoxH * imgRatio;
        drawX = ml + ingW + (imgW - drawW) / 2;
        drawY = imgStartY;
      }
      doc.addImage(ficha.fotos, "JPEG", drawX, drawY, drawW, drawH);
    } catch {
      doc.setFillColor(...gray100);
      doc.rect(ml + ingW, imgStartY, imgW, imgBoxH, "F");
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.setFont("helvetica", "normal");
      doc.text("IMAGEN RECETA", ml + ingW + imgW / 2, imgStartY + imgBoxH / 2, { align: "center" });
    }
  } else {
    doc.setFillColor(...gray100);
    doc.rect(ml + ingW, imgStartY, imgW, imgBoxH, "F");
    doc.setDrawColor(200);
    doc.rect(ml + ingW, imgStartY, imgW, imgBoxH, "S");
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.setFont("helvetica", "normal");
    doc.text("IMAGEN RECETA", ml + ingW + imgW / 2, imgStartY + imgBoxH / 2, { align: "center" });
  }

  y = imgStartY + imgBoxH + 4;

  // ALÉRGENOS
  if (ficha.alergenos.length > 0) {
    y = sectionHeader("ALÉRGENOS", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(ficha.alergenos.map(a => getAlergenoLabel ? getAlergenoLabel(a) : a).join(", "), ml + 4, y + 4);
    y += 10;
  }

  // ELABORACIÓN
  if (ficha.elaboracion) {
    y = sectionHeader("ELABORACIÓN", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    const lineas = ficha.elaboracion.split("\n");
    for (const linea of lineas) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(linea, ml + 4, y + 4);
      y += 5;
    }
    y += 5;
  }

  // CONSERVACIÓN | REGENERACIÓN | VIDA ÚTIL
  const hasConservacion = !!ficha.conservacion;
  const hasRegeneracion = !!ficha.regeneracion;
  const hasVidaUtil = !!ficha.vida_util;
  if (hasConservacion || hasRegeneracion || hasVidaUtil) {
    const infoY = y;
    const infoH = 14;
    const col3W = cw / 3;

    doc.setFillColor(...indigo200);
    doc.rect(ml, infoY, cw, infoH, "F");

    const drawInfoCell = (title: string, value: string, x: number) => {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...indigo900);
      doc.text(title, x + 2, infoY + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.text(value || "—", x + 2, infoY + 10);
    };

    drawInfoCell("CONSERVACIÓN", ficha.conservacion || "", ml);
    drawInfoCell("REGENERACIÓN", ficha.regeneracion || "", ml + col3W);
    drawInfoCell("VIDA ÚTIL", ficha.vida_util || "", ml + col3W * 2);

    y = infoY + infoH + 4;
  }

  // COSTES
  y = sectionHeader("COSTES", y);
  const costRowH = 10;
  const costColW = cw / 4;

  doc.setFillColor(...gray100);
  doc.rect(ml, y, cw, costRowH, "F");

  const drawCostCell = (label: string, value: string, x: number) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80);
    doc.text(label, x + 2, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(value, x + 2, y + 8.5);
  };

  drawCostCell("COSTE TOTAL", `${ficha.coste_total.toFixed(2)} €`, ml);
  drawCostCell("COSTE/PORCIÓN", `${ficha.coste_porcion.toFixed(2)} €`, ml + costColW);
  drawCostCell("FOOD COST", ficha.food_cost_pct != null ? `${ficha.food_cost_pct.toFixed(1)}%` : "—", ml + costColW * 2);
  drawCostCell("MARGEN REAL", ficha.margen_real_pct != null ? `${ficha.margen_real_pct.toFixed(1)}%` : "—", ml + costColW * 3);

  y += costRowH + 2;

  // PRECIO MÍNIMO SUGERIDO/PORCIÓN
  const margen = ficha.margen_porcentaje ?? 50;
  const precioMinimo = ficha.coste_porcion / (1 - margen / 100);
  y = sectionHeader(`PRECIO MÍNIMO SUGERIDO/PORCIÓN (margen ${margen}%)`, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.text(`Coste/porción: ${ficha.coste_porcion.toFixed(2)} €`, ml + 4, y + 4);
  y += 6;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(49, 46, 129);
  doc.text(`${precioMinimo.toFixed(2)} €`, ml + 4, y + 6);
  y += 12;

  // NOTAS ADICIONALES
  if (ficha.notas_adicionales) {
    y = sectionHeader("NOTAS ADICIONALES", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    const lineas = ficha.notas_adicionales.split("\n");
    for (const linea of lineas) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(linea, ml + 4, y + 4);
      y += 5;
    }
    y += 5;
  }

  const fileName = `ficha_receta_${ficha.receta_nombre.replace(/\s+/g, "_")}.pdf`;
  const home = await homeDir();
  const path = await save({
    defaultPath: `${home}/${fileName}`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (path) {
    const blob = doc.output("blob");
    const buffer = await blob.arrayBuffer();
    await writeFile(path, new Uint8Array(buffer));
  }
}
