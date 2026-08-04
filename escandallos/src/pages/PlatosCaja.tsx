import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

interface CajaCategoria {
  id: number;
  nombre: string;
  precio: number;
  plus: number;
  orden: number;
  activa: boolean;
}

interface PlatoCaja {
  id: number;
  categoria_id: number;
  nombre: string;
  activo: boolean;
}

export default function PlatosCaja() {
  const [categorias, setCategorias] = useState<CajaCategoria[]>([]);
  const [platos, setPlatos] = useState<PlatoCaja[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ categoria_id: 0, nombre: "", activo: true });
  const [error, setError] = useState("");

  const loadCategorias = async () => {
    try {
      const data = await invoke<CajaCategoria[]>("get_caja_categorias");
      setCategorias(data.filter(c => c.activa));
    } catch (e) { setError(String(e)); }
  };

  const loadPlatos = async () => {
    try {
      const data = await invoke<PlatoCaja[]>("get_platos_caja", { categoriaId: selectedCat });
      setPlatos(data);
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => { loadCategorias(); }, []);

  useEffect(() => {
    loadPlatos();
  }, [selectedCat]);

  useEffect(() => { if (loading) setLoading(false); }, [categorias]);

  const handleNew = () => {
    setEditingId(null);
    setForm({ categoria_id: selectedCat || (categorias[0]?.id ?? 0), nombre: "", activo: true });
    setShowForm(true);
  };

  const handleEdit = (plato: PlatoCaja) => {
    setEditingId(plato.id);
    setForm({ categoria_id: plato.categoria_id, nombre: plato.nombre, activo: plato.activo });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.categoria_id) { setError("Nombre y categoría requeridos"); return; }
    try {
      if (editingId) {
        await invoke("update_plato_caja", { id: editingId, input: form });
      } else {
        await invoke("create_plato_caja", { input: form });
      }
      setShowForm(false);
      loadPlatos();
    } catch (e) { setError(String(e)); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este plato?")) return;
    try {
      await invoke("delete_plato_caja", { id });
      loadPlatos();
    } catch (e) { setError(String(e)); }
  };

  const handleToggle = async (plato: PlatoCaja) => {
    try {
      await invoke("update_plato_caja", {
        id: plato.id,
        input: { categoria_id: plato.categoria_id, nombre: plato.nombre, activo: !plato.activo }
      });
      loadPlatos();
    } catch (e) { setError(String(e)); }
  };

  const getCatName = (id: number) => categorias.find(c => c.id === id)?.nombre ?? "—";

  if (loading) return <div className="p-6 text-center text-gray-500">Cargando...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Platos Caja</h1>
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={18} /> Nuevo plato
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError("")}><X size={16} /></button>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-4">
        Gestiona los platos disponibles para cada categoría de la Caja.
      </p>

      {/* Category tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button onClick={() => setSelectedCat(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            selectedCat === null ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          Todos ({platos.length})
        </button>
        {categorias.map(cat => {
          const count = platos.filter(p => p.categoria_id === cat.id).length;
          return (
            <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCat === cat.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {cat.nombre} ({count})
            </button>
          );
        })}
      </div>

      {/* Platos table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Plato</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Categoría</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Activo</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {platos.map(plato => (
              <tr key={plato.id} className={`hover:bg-gray-50 ${!plato.activo ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{plato.nombre}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {getCatName(plato.categoria_id)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleToggle(plato)} className={`w-10 h-5 rounded-full transition-colors ${plato.activo ? "bg-blue-600" : "bg-gray-300"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${plato.activo ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(plato)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(plato.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {platos.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                {selectedCat ? "No hay platos en esta categoría" : "No hay platos. Añade uno con el botón de arriba."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editingId ? "Editar plato" : "Nuevo plato"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value={0}>Seleccionar categoría...</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del plato *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  placeholder="Ej: Tortilla de patatas"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700">Activo</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={!form.nombre.trim() || !form.categoria_id}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 font-medium">
                <Save size={16} /> {editingId ? "Guardar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
