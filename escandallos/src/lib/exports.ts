import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

interface RecetaData {
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  porciones: number;
  tiempo_preparacion: number | null;
  precio_venta: number | null;
  margen_porcentaje: number | null;
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
  if (receta.tiempo_preparacion) {
    doc.text(`Tiempo: ${receta.tiempo_preparacion} min`, 80, y);
  }
  if (receta.categoria) {
    doc.text(`Categoría: ${receta.categoria}`, 140, y);
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
  const path = await save({
    defaultPath: fileName,
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
    const pdfBytes = doc.output("arraybuffer");
    await writeFile(path, new Uint8Array(pdfBytes));
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
  const path = await save({
    defaultPath: fileName,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (path) {
    const pdfBytes = doc.output("arraybuffer");
    await writeFile(path, new Uint8Array(pdfBytes));
  }
}
