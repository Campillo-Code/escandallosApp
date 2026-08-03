import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Pencil, Trash2, X, AlertTriangle } from "lucide-react";
import DateInput from "../components/DateInput";

interface Lote {
  id: number;
  ingrediente_id: number;
  ingrediente_nombre: string | null;
  proveedor_id: number;
  proveedor_nombre: string | null;
  numero_lote: string;
  fecha_recepcion: string;
  fecha_caducidad: string | null;
  cantidad_recibida: number;
  unidad: string;
  albaran_id: number | null;
  notas: string | null;
}

interface Ingrediente { id: number; nombre: string; unidad_base: string; }
interface Proveedor { id: number; nombre: string; }
interface Albaran { id: number; proveedor_nombre: string; numero_albaran: string; fecha_recepcion: string; }

const emptyForm = {
  ingrediente_id: 0,
  proveedor_id: 0,
  numero_lote: "",
  fecha_recepcion: new Date().toISOString().split("T")[0],
  fecha_caducidad: "",
  cantidad_recibida: 0,
  unidad: "kg",
  albaran_id: null as number | null,
  notas: "",
};

export default function Lotes() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [lotesProximos, setLotesProximos] = useState<Lote[]>([]);

  const loadLotes = async () => {
    try {
      setError(null);
      const result = await invoke<Lote[]>("get_lotes", { fecha_desde: fechaDesde || null, fecha_hasta: fechaHasta || null });
      setLotes(result);
    } catch (e) { setError(String(e)); console.error(e); }
  };
  const loadProximos = async () => {
    try {
      const result = await invoke<Lote[]>("get_lotes_proximos_caducar", { dias: 7 });
      setLotesProximos(result);
    } catch (e) { console.error(e); }
  };
  const loadIngredientes = async () => { try { setIngredientes(await invoke("get_ingredientes")); } catch (e) { console.error(e); } };
  const loadProveedores = async () => { try { setProveedores(await invoke("get_proveedores")); } catch (e) { console.error(e); } };
  const loadAlbaranes = async () => { try { setAlbaranes(await invoke("get_albaranes")); } catch (e) { console.error(e); } };

  useEffect(() => { Promise.all([loadLotes(), loadProximos(), loadIngredientes(), loadProveedores(), loadAlbaranes()]).finally(() => setLoading(false)); }, []);
  useEffect(() => { loadLotes(); }, [fechaDesde, fechaHasta]);

  const handleChange = (field: string, value: string | number | null) => setForm(prev => ({ ...prev, [field]: value }));

  const openAdd = async () => {
    setEditingId(null);
    try {
      const numeroLote = await invoke<string>("generar_numero_lote");
      setForm({ ...emptyForm, numero_lote: numeroLote });
    } catch (e) {
      setForm(emptyForm);
    }
    setShowForm(true);
  };
  const openEdit = (l: Lote) => {
    setEditingId(l.id); setShowForm(true);
    setForm({
      ingrediente_id: l.ingrediente_id, proveedor_id: l.proveedor_id, numero_lote: l.numero_lote,
      fecha_recepcion: l.fecha_recepcion, fecha_caducidad: l.fecha_caducidad ?? "",
      cantidad_recibida: l.cantidad_recibida, unidad: l.unidad, albaran_id: l.albaran_id, notas: l.notas ?? "",
    });
  };

  const handleSave = async () => {
    try {
      const input = { ...form, fecha_caducidad: form.fecha_caducidad || null, notas: form.notas || null, albaran_id: form.albaran_id || null };
      if (editingId) { await invoke("update_lote", { id: editingId, input }); }
      else { await invoke("create_lote", { input }); }
      setShowForm(false); loadLotes(); loadProximos();
    } catch (e) { alert("Error: " + e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este lote?")) return;
    try { await invoke("delete_lote", { id }); loadLotes(); loadProximos(); } catch (e) { alert("Error: " + e); }
  };

  const getCaducidadClass = (fecha: string | null) => {
    if (!fecha) return "";
    const diff = (new Date(fecha).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (diff < 0) return "text-red-700 bg-red-50";
    if (diff <= 3) return "text-orange-600 bg-orange-50";
    if (diff <= 7) return "text-yellow-600 bg-yellow-50";
    return "";
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Lotes de Ingredientes</h2>
        {!showForm && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <Plus size={18} /> Nuevo Lote
          </button>
        )}
      </div>

      {/* Alertas caducidad */}
      {lotesProximos.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-orange-500" />
            <span className="font-semibold text-orange-700">Lotes próximos a caducar ({lotesProximos.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lotesProximos.map(l => (
              <span key={l.id} className={`text-xs px-2 py-1 rounded-full font-medium ${getCaducidadClass(l.fecha_caducidad)}`}>
                {l.ingrediente_nombre} — L{l.numero_lote} — {l.fecha_caducidad}
              </span>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{editingId ? "Editar" : "Nuevo"} Lote</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ingrediente *</label>
              <select value={form.ingrediente_id} onChange={e => handleChange("ingrediente_id", parseInt(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value={0}>Seleccionar...</option>
                {ingredientes.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
              <select value={form.proveedor_id} onChange={e => handleChange("proveedor_id", parseInt(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value={0}>Seleccionar...</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº Lote *</label>
              <input value={form.numero_lote} readOnly className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Albarán de compra</label>
              <select value={form.albaran_id ?? ""} onChange={e => handleChange("albaran_id", e.target.value ? parseInt(e.target.value) : null)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Ninguno</option>
                {albaranes.map(a => <option key={a.id} value={a.id}>#{a.id} - {a.proveedor_nombre} ({a.fecha_recepcion})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha recepción *</label>
              <DateInput value={form.fecha_recepcion} onChange={(v) => handleChange("fecha_recepcion", v)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha caducidad</label>
              <DateInput value={form.fecha_caducidad} onChange={(v) => handleChange("fecha_caducidad", v)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad recibida *</label>
              <input type="number" step="0.01" value={form.cantidad_recibida} onChange={e => handleChange("cantidad_recibida", parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad *</label>
              <select value={form.unidad} onChange={e => handleChange("unidad", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="kg">kg</option><option value="g">g</option><option value="l">l</option><option value="ml">ml</option><option value="ud">ud</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <input value={form.notas} onChange={e => handleChange("notas", e.target.value)} placeholder="Observaciones..." className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={!form.ingrediente_id || !form.proveedor_id || !form.numero_lote} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Guardar</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <DateInput value={fechaDesde} onChange={setFechaDesde} label="Desde" />
        <DateInput value={fechaHasta} onChange={setFechaHasta} label="Hasta" />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="p-6 text-center text-gray-500">Cargando...</div> :
          error ? <div className="p-6 text-center text-red-500">Error: {error}</div> :
          lotes.length === 0 ? <div className="p-6 text-center text-gray-500">No hay lotes registrados</div> : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ingrediente</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Proveedor</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nº Lote</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Recepción</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Caducidad</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cantidad</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lotes.map(l => (
                  <tr key={l.id} className={`hover:bg-gray-50 ${getCaducidadClass(l.fecha_caducidad)}`}>
                    <td className="px-4 py-3">
                      {(() => {
                        if (!l.fecha_caducidad) return <span className="text-xs text-gray-400">—</span>;
                        const diff = (new Date(l.fecha_caducidad).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                        if (diff < 0) return <span className="text-xs font-bold text-red-600">CADUCADO</span>;
                        if (diff <= 3) return <span className="text-xs font-bold text-orange-500">CRÍTICO</span>;
                        if (diff <= 7) return <span className="text-xs font-medium text-yellow-600">PRÓXIMO</span>;
                        return <span className="text-xs text-green-600">OK</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{l.ingrediente_nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{l.proveedor_nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{l.numero_lote}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{l.fecha_recepcion}</td>
                    <td className="px-4 py-3 text-sm font-medium">{l.fecha_caducidad || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{l.cantidad_recibida} {l.unidad}</td>
                    <td className="px-4 py-3 text-sm text-right space-x-2">
                      <button onClick={() => openEdit(l)} className="text-blue-600 hover:text-blue-800"><Pencil size={15} /></button>
                      <button onClick={() => handleDelete(l.id)} className="text-red-600 hover:text-red-800"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
