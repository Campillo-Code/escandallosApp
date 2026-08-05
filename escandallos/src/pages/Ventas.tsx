import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, Download, ChevronDown, ChevronRight } from "lucide-react";
import DateInput from "../components/DateInput";

interface Venta { id: number; fecha: string; plato_nombre: string; cantidad: number; precio_unitario: number; total_venta: number; }
interface VentaCSVRow { fecha: string; plato_nombre: string; cantidad: number; precio_unitario: number; total_venta: number; }

interface TicketItem {
  categoria: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

interface CajaTicket {
  id: number;
  fecha: string;
  hora: string;
  total: number;
  items: string;
  notas: string | null;
  metodo_pago: string | null;
}

function getLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Ventas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tab, setTab] = useState<"historial" | "tickets" | "importar">("historial");

  // Tickets state
  const [tickets, setTickets] = useState<CajaTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);

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

  const loadTickets = async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      console.log("Loading tickets with dates:", fechaDesde || null, fechaHasta || null);
      const data = await invoke<CajaTicket[]>("get_caja_tickets_con_ventas", {
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
      });
      console.log("Tickets loaded:", data.length, data);
      setTickets(data);
    } catch (e) {
      console.error("Error loading tickets:", e);
      setTicketsError(String(e));
    }
    finally { setTicketsLoading(false); }
  };

  useEffect(() => {
    if (tab === "historial") { setLoading(true); loadVentas(); }
    if (tab === "tickets") { loadTickets(); }
  }, [fechaDesde, fechaHasta, tab]);

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

  const exportCSV = () => {
    const rows = tab === "tickets"
      ? tickets.flatMap(t => {
          const items: TicketItem[] = JSON.parse(t.items);
          return items.map(item => ({
            Fecha: t.fecha,
            Hora: t.hora,
            Categoria: item.categoria,
            Plato: item.descripcion,
            Cantidad: item.cantidad,
            "Precio Unitario": item.precio_unitario.toFixed(2),
            Subtotal: item.subtotal.toFixed(2),
            "Método Pago": t.metodo_pago || "efectivo",
          }));
        })
      : ventas.map(v => ({
          Fecha: v.fecha,
          Plato: v.plato_nombre,
          Cantidad: v.cantidad,
          "Precio Unitario": v.precio_unitario.toFixed(2),
          Total: v.total_venta.toFixed(2),
        }));
    if (rows.length === 0) { alert("No hay datos para exportar"); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(";"), ...rows.map(r => headers.map(h => String((r as Record<string, unknown>)[h])).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas_${getLocalDateStr(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalVentas = ventas.reduce((s, v) => s + v.total_venta, 0);
  const totalUnidades = ventas.reduce((s, v) => s + v.cantidad, 0);
  const totalTickets = tickets.reduce((s, t) => s + t.total, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Ventas</h2>
        <div className="flex gap-2">
          <button onClick={() => setTab("historial")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "historial" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border"}`}>Líneas</button>
          <button onClick={() => setTab("tickets")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "tickets" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border"}`}>Tickets</button>
          <button onClick={() => setTab("importar")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "importar" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border"}`}>Importar CSV</button>
        </div>
      </div>

      {/* Filters + Export (shared) */}
      {tab !== "importar" && (
        <div className="flex items-center gap-4 mb-4">
          <DateInput value={fechaDesde} onChange={setFechaDesde} label="Desde" />
          <DateInput value={fechaHasta} onChange={setFechaHasta} label="Hasta" />
          {(fechaDesde || fechaHasta) && (
            <button onClick={() => { setFechaDesde(""); setFechaHasta(""); }} className="text-sm text-blue-600 hover:underline mt-4">Limpiar filtros</button>
          )}
          <div className="ml-auto flex items-center gap-3">
            {tab === "historial" && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Total: <span className="font-bold text-gray-800">{totalVentas.toFixed(2)}€</span></p>
                <p className="text-xs text-gray-400">{totalUnidades} unidades · {ventas.length} registros</p>
              </div>
            )}
            {tab === "tickets" && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Total: <span className="font-bold text-gray-800">{totalTickets.toFixed(2)}€</span></p>
                <p className="text-xs text-gray-400">{tickets.length} tickets</p>
              </div>
            )}
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
              <Download size={14} /> Exportar CSV
            </button>
          </div>
        </div>
      )}

      {/* Tab: Líneas de venta */}
      {tab === "historial" && (
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
      )}

      {/* Tab: Tickets */}
      {tab === "tickets" && (
        <div className="bg-white rounded-lg shadow">
          {ticketsLoading ? <div className="p-6 text-center text-gray-500">Cargando...</div> :
            ticketsError ? <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm m-4">{ticketsError}</div> :
            tickets.length === 0 ? <div className="p-6 text-center text-gray-500">No hay tickets en este periodo</div> : (
              <div className="divide-y divide-gray-200">
                {tickets.map(ticket => {
                  const items: TicketItem[] = JSON.parse(ticket.items);
                  const isExpanded = expandedTicket === ticket.id;
                  return (
                    <div key={ticket.id}>
                      <div
                        onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        {isExpanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                        <span className="text-sm text-gray-500 w-20 shrink-0">{ticket.hora}</span>
                        <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">
                          {items.length} artículo{items.length !== 1 ? "s" : ""}
                          <span className="text-gray-400 ml-2 text-xs">
                            {items.map(i => i.descripcion).join(", ").substring(0, 60)}{items.map(i => i.descripcion).join(", ").length > 60 ? "..." : ""}
                          </span>
                        </span>
                        {ticket.metodo_pago && ticket.metodo_pago !== "efectivo" && (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${
                            ticket.metodo_pago === "tarjeta" ? "bg-purple-100 text-purple-700" :
                            ticket.metodo_pago === "qr" ? "bg-cyan-100 text-cyan-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {ticket.metodo_pago === "tarjeta" ? "💳" : ticket.metodo_pago === "qr" ? "📱" : ticket.metodo_pago}
                          </span>
                        )}
                        <span className="font-bold text-gray-800 w-20 text-right shrink-0">{ticket.total.toFixed(2)} €</span>
                      </div>
                      {isExpanded && (
                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 overflow-x-auto">
                          <table className="w-full ml-7" style={{ maxWidth: "calc(100% - 28px)" }}>
                            <thead>
                              <tr className="text-xs text-gray-500">
                                <th className="text-left pb-1 font-medium">Categoría</th>
                                <th className="text-left pb-1 font-medium">Descripción</th>
                                <th className="text-center pb-1 font-medium">Uds</th>
                                <th className="text-right pb-1 font-medium">Precio</th>
                                <th className="text-right pb-1 font-medium">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="text-sm">
                              {items.map((item, i) => (
                                <tr key={i} className="border-t border-gray-200">
                                  <td className="py-1.5">
                                    <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{item.categoria}</span>
                                  </td>
                                  <td className="py-1.5 text-gray-800">{item.descripcion}</td>
                                  <td className="py-1.5 text-center text-gray-600">{item.cantidad}</td>
                                  <td className="py-1.5 text-right text-gray-600 font-mono">{item.precio_unitario.toFixed(2)} €</td>
                                  <td className="py-1.5 text-right font-mono font-medium">{item.subtotal.toFixed(2)} €</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {ticket.notas && (
                            <p className="ml-7 mt-2 text-xs text-gray-400 italic">📝 {ticket.notas}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* Tab: Importar CSV */}
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
    </div>
  );
}
