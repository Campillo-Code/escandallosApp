import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2 } from "lucide-react";
import DateInput from "../components/DateInput";

interface Venta { id: number; fecha: string; plato_nombre: string; cantidad: number; precio_unitario: number; total_venta: number; }
interface VentaCSVRow { fecha: string; plato_nombre: string; cantidad: number; precio_unitario: number; total_venta: number; }

export default function Ventas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tab, setTab] = useState<"historial" | "importar">("historial");

  // Import state
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<VentaCSVRow[]>([]);
  const [colMapping, setColMapping] = useState({ fecha: 0, plato: 1, cantidad: 2, precio: 3, total: 4 });
  const [delimiter, setDelimiter] = useState(";");
  const [importing, setImporting] = useState(false);

  const loadVentas = async () => {
    try {
      const data = await invoke<Venta[]>("get_ventas", { fechaDesde: fechaDesde || null, fechaHasta: fechaHasta || null });
      setVentas(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadVentas(); }, [fechaDesde, fechaHasta]);

  const parseCSV = () => {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) return;
    const rows: VentaCSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 5) continue;
      rows.push({
        fecha: cols[colMapping.fecha],
        plato_nombre: cols[colMapping.plato],
        cantidad: parseInt(cols[colMapping.cantidad]) || 1,
        precio_unitario: parseFloat(cols[colMapping.precio].replace(",", ".")) || 0,
        total_venta: parseFloat(cols[colMapping.total].replace(",", ".")) || 0,
      });
    }
    setCsvPreview(rows);
  };

  const handleImport = async () => {
    if (csvPreview.length === 0) return;
    setImporting(true);
    try {
      const count = await invoke<number>("import_ventas", { rows: csvPreview });
      alert(`Importadas ${count} ventas correctamente`);
      setCsvText(""); setCsvPreview([]); setTab("historial"); loadVentas();
    } catch (e) { alert("Error: " + e); }
    finally { setImporting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta venta?")) return;
    try { await invoke("delete_venta", { id }); loadVentas(); } catch (e) { alert("Error: " + e); }
  };

  const totalVentas = ventas.reduce((s, v) => s + v.total_venta, 0);
  const totalUnidades = ventas.reduce((s, v) => s + v.cantidad, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Ventas</h2>
        <div className="flex gap-2">
          <button onClick={() => { if (tab !== "historial") setTab("historial"); setLoading(true); setTimeout(() => loadVentas(), 50); }} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "historial" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border"}`}>Historial</button>
          <button onClick={() => setTab("importar")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "importar" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border"}`}>Importar CSV</button>
        </div>
      </div>

      {tab === "importar" && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Importar ventas desde TPV</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delimitador</label>
              <select value={delimiter} onChange={e => setDelimiter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value=";">Punto y coma (;)</option>
                <option value=",">Coma (,)</option>
                <option value="\t">Tab</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Columna Fecha</label>
              <input type="number" min="0" value={colMapping.fecha} onChange={e => setColMapping({ ...colMapping, fecha: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Columna Plato</label>
              <input type="number" min="0" value={colMapping.plato} onChange={e => setColMapping({ ...colMapping, plato: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Columna Cantidad</label>
              <input type="number" min="0" value={colMapping.cantidad} onChange={e => setColMapping({ ...colMapping, cantidad: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Columna Precio</label>
              <input type="number" min="0" value={colMapping.precio} onChange={e => setColMapping({ ...colMapping, precio: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Columna Total</label>
              <input type="number" min="0" value={colMapping.total} onChange={e => setColMapping({ ...colMapping, total: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pega el contenido del CSV aquí</label>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={8} placeholder={`Fecha;Plato;Cantidad;Precio;Total\n01/07/2026;Lomo al whisky;5;12.50;62.50`} className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm" />
          </div>
          <div className="flex gap-3">
            <button onClick={parseCSV} disabled={!csvText.trim()} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">Previsualizar</button>
            {csvPreview.length > 0 && (
              <button onClick={handleImport} disabled={importing} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {importing ? "Importando..." : `Importar ${csvPreview.length} registros`}
              </button>
            )}
          </div>
          {csvPreview.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Preview ({csvPreview.length} registros)</h4>
              <div className="max-h-60 overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-left">Plato</th><th className="px-3 py-2 text-right">Cant.</th><th className="px-3 py-2 text-right">Precio</th><th className="px-3 py-2 text-right">Total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {csvPreview.slice(0, 50).map((r, i) => (
                      <tr key={i}><td className="px-3 py-1">{r.fecha}</td><td className="px-3 py-1">{r.plato_nombre}</td><td className="px-3 py-1 text-right">{r.cantidad}</td><td className="px-3 py-1 text-right">{r.precio_unitario.toFixed(2)}€</td><td className="px-3 py-1 text-right">{r.total_venta.toFixed(2)}€</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvPreview.length > 50 && <p className="text-xs text-gray-500 mt-1">Mostrando 50 de {csvPreview.length} registros</p>}
            </div>
          )}
        </div>
      )}

      {tab === "historial" && (
        <>
          <div className="flex items-center gap-4 mb-4">
            <DateInput value={fechaDesde} onChange={setFechaDesde} label="Desde" />
            <DateInput value={fechaHasta} onChange={setFechaHasta} label="Hasta" />
            {(fechaDesde || fechaHasta) && (
              <button onClick={() => { setFechaDesde(""); setFechaHasta(""); }} className="text-sm text-blue-600 hover:underline mt-4">Limpiar filtros</button>
            )}
            <div className="ml-auto text-right">
              <p className="text-sm text-gray-500">Total: <span className="font-bold text-gray-800">{totalVentas.toFixed(2)}€</span></p>
              <p className="text-xs text-gray-400">{totalUnidades} unidades · {ventas.length} registros</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? <div className="p-6 text-center text-gray-500">Cargando...</div> :
              ventas.length === 0 ? <div className="p-6 text-center text-gray-500">No hay ventas registradas</div> : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Plato</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cantidad</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Precio ud.</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ventas.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{v.fecha}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{v.plato_nombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{v.cantidad}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{v.precio_unitario.toFixed(2)}€</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 text-right">{v.total_venta.toFixed(2)}€</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <button onClick={() => handleDelete(v.id)} className="text-red-600 hover:text-red-800"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}
    </div>
  );
}
