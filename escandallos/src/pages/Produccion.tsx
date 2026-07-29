import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Trash2, X, Tag } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";
import DateInput from "../components/DateInput";
import { exportEtiquetaPDF, printEtiquetaPDF, EtiquetaData } from "../lib/exports";

registerLocale("es", es);

interface Receta { id: number; nombre: string; }
interface LoteIngrediente { id: number; ingrediente_nombre: string | null; numero_lote: string; unidad: string; cantidad_recibida: number; }

interface Produccion {
  id: number;
  receta_id: number;
  receta_nombre: string | null;
  fecha_elaboracion: string;
  cantidad_producida: number;
  lote_producto: string;
  fecha_caducidad: string | null;
  responsable: string | null;
  notas: string | null;
}

interface DetalleLine {
  id?: number;
  lote_ingrediente_id: number;
  cantidad_utilizada: number;
  lote_numero?: string;
  ingrediente_nombre?: string;
}

const emptyForm = {
  receta_id: 0,
  fecha_elaboracion: new Date().toISOString().slice(0, 16),
  cantidad_producida: 1,
  lote_producto: "",
  fecha_caducidad: "",
  responsable: "",
  notas: "",
};

export default function Produccion() {
  const [producciones, setProducciones] = useState<Produccion[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [lotes, setLotes] = useState<LoteIngrediente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detalles, setDetalles] = useState<DetalleLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split("T")[0]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detallesExpandido, setDetallesExpandido] = useState<DetalleLine[]>([]);

  const loadProduccion = async () => {
    try { setProducciones(await invoke("get_produccion", { fechaDesde, fechaHasta })); } catch (e) { console.error(e); }
  };
  const loadLotes = async () => {
    try { setLotes(await invoke("get_lotes", { fechaDesde: null, fechaHasta: null })); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    Promise.all([
      loadProduccion(),
      loadLotes(),
      invoke<Receta[]>("get_recetas").then(setRecetas).catch(console.error),
    ]).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadProduccion(); }, [fechaDesde, fechaHasta]);

  const generarLote = async () => {
    try {
      const lote = await invoke<string>("generar_lote_produccion");
      setForm(prev => ({ ...prev, lote_producto: lote }));
    } catch (e) { console.error(e); }
  };

  const openAdd = async () => {
    setForm(emptyForm);
    setDetalles([]);
    setShowForm(true);
    await generarLote();
  };

  const handleChange = (field: string, value: string | number) => setForm(prev => ({ ...prev, [field]: value }));

  const addDetalle = () => {
    setDetalles(prev => [...prev, { lote_ingrediente_id: 0, cantidad_utilizada: 0 }]);
  };
  const updateDetalle = (idx: number, field: string, value: string | number) => {
    setDetalles(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };
  const removeDetalle = (idx: number) => {
    setDetalles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    try {
      const input = {
        ...form,
        fecha_caducidad: form.fecha_caducidad || null,
        responsable: form.responsable || null,
        notas: form.notas || null,
      };
      await invoke("create_produccion", { input, detalles: detalles.filter(d => d.lote_ingrediente_id > 0) });
      setShowForm(false); loadProduccion();
    } catch (e) { alert("Error: " + e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este registro de producción?")) return;
    try { await invoke("delete_produccion", { id }); loadProduccion(); } catch (e) { alert("Error: " + e); }
  };

  const toggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    try {
      const det = await invoke<DetalleLine[]>("get_produccion_detalles", { produccionId: id });
      setDetallesExpandido(det);
      setExpandedId(id);
    } catch (e) { console.error(e); }
  };

  const handleEtiqueta = async (prodId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const data = await invoke<EtiquetaData>("get_etiqueta_data", { produccionId: prodId });
      await exportEtiquetaPDF(data);
    } catch (err) { alert("Error generando etiqueta: " + err); }
  };

  const handlePrintEtiqueta = async (prodId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const data = await invoke<EtiquetaData>("get_etiqueta_data", { produccionId: prodId });
      await printEtiquetaPDF(data);
    } catch (err) { alert("Error imprimiendo etiqueta: " + err); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Producción</h2>
        {!showForm && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <Plus size={18} /> Nuevo Registro
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Nueva Producción</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receta *</label>
              <select value={form.receta_id} onChange={e => handleChange("receta_id", parseInt(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value={0}>Seleccionar...</option>
                {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha elaboración *</label>
              <DatePicker
                selected={form.fecha_elaboracion ? new Date(form.fecha_elaboracion) : null}
                onChange={(date: Date | null) => {
                  if (date) {
                    const iso = date.toISOString().slice(0, 16);
                    handleChange("fecha_elaboracion", iso);
                  }
                }}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="dd/MM/yyyy HH:mm"
                locale="es"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholderText="dd/mm/aaaa HH:mm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad producida *</label>
              <input type="number" value={form.cantidad_producida} onChange={e => handleChange("cantidad_producida", parseInt(e.target.value) || 1)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lote producto</label>
              <div className="flex gap-2">
                <input value={form.lote_producto} onChange={e => handleChange("lote_producto", e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 font-mono" />
                <button onClick={generarLote} type="button" className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm hover:bg-gray-200">Auto</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha caducidad</label>
              <DateInput value={form.fecha_caducidad} onChange={(v) => handleChange("fecha_caducidad", v)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
              <input value={form.responsable} onChange={e => handleChange("responsable", e.target.value)} placeholder="Nombre" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>

          {/* Detalles: lotes de ingredientes usados */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Lotes de ingredientes utilizados</label>
              <button onClick={addDetalle} type="button" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={14} /> Añadir</button>
            </div>
            {detalles.length === 0 && <p className="text-xs text-gray-400">Sin lotes asignados</p>}
            {detalles.map((d, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <select value={d.lote_ingrediente_id} onChange={e => updateDetalle(idx, "lote_ingrediente_id", parseInt(e.target.value))} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value={0}>Seleccionar lote...</option>
                  {lotes.map(l => <option key={l.id} value={l.id}>{l.ingrediente_nombre} — L{l.numero_lote} ({l.cantidad_recibida} {l.unidad})</option>)}
                </select>
                <input type="number" step="0.01" value={d.cantidad_utilizada} onChange={e => updateDetalle(idx, "cantidad_utilizada", parseFloat(e.target.value) || 0)} className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Cantidad" />
                <button onClick={() => removeDetalle(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <input value={form.notas} onChange={e => handleChange("notas", e.target.value)} placeholder="Observaciones..." className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={!form.receta_id || !form.lote_producto} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Guardar</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <DateInput value={fechaDesde} onChange={setFechaDesde} label="Desde" />
        <DateInput value={fechaHasta} onChange={setFechaHasta} label="Hasta" />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="p-6 text-center text-gray-500">Cargando...</div> :
          producciones.length === 0 ? <div className="p-6 text-center text-gray-500">No hay registros de producción</div> : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 w-8"></th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Lote</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Receta</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cantidad</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Caducidad</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Responsable</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {producciones.map(p => (
                  <>
                    <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(p.id)}>
                      <td className="px-4 py-3 text-gray-400 text-sm">{expandedId === p.id ? "▼" : "▶"}</td>
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-800">{p.lote_producto}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{p.receta_nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.fecha_elaboracion}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{p.cantidad_producida} ud</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.fecha_caducidad || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.responsable || "—"}</td>
                      <td className="px-4 py-3 text-sm text-right" onClick={e => e.stopPropagation()}>
                        <button onClick={(e) => handleEtiqueta(p.id, e)} className="text-green-600 hover:text-green-800 mr-2" title="Guardar etiqueta"><Tag size={15} /></button>
                        <button onClick={(e) => handlePrintEtiqueta(p.id, e)} className="text-blue-600 hover:text-blue-800 mr-2" title="Imprimir etiqueta">🖨️</button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                    {expandedId === p.id && (
                      <tr key={`${p.id}-det`}>
                        <td colSpan={8} className="px-4 py-3 bg-gray-50">
                          <p className="text-xs font-medium text-gray-500 mb-2">Lotes utilizados:</p>
                          {detallesExpandido.length === 0 ? (
                            <p className="text-xs text-gray-400">Sin detalles</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {detallesExpandido.map(d => (
                                <span key={d.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                                  {d.ingrediente_nombre} — L{lotes.find(l => l.id === d.lote_ingrediente_id)?.numero_lote || "?"} — {d.cantidad_utilizada}
                                </span>
                              ))}
                            </div>
                          )}
                          {p.notas && <p className="text-xs text-gray-500 mt-2"><b>Notas:</b> {p.notas}</p>}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
