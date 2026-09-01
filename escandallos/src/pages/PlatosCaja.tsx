import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";
import SearchBar from "../components/SearchBar";
import SearchableSelect from "../components/SearchableSelect";

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
  receta_id: number | null;
  nombre: string;
  plus: number;
  activo: boolean;
}

interface RecetaBasic {
  id: number;
  nombre: string;
  categoria: string | null;
}

export default function PlatosCaja() {
  const [categorias, setCategorias] = useState<CajaCategoria[]>([]);
  const [platos, setPlatos] = useState<PlatoCaja[]>([]);
  const [recetas, setRecetas] = useState<RecetaBasic[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ categoria_id: 0, receta_id: null as number | null, nombre: "", plus: 0, activo: true });
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const loadCategorias = async () => {
    try {
      const data = await invoke<CajaCategoria[]>("get_caja_categorias");
      setCategorias(data.filter(c => c.activa));
    } catch (e) { setError(String(e)); }
  };

  const loadRecetas = async () => {
    try {
      const data = await invoke<RecetaBasic[]>("get_recetas_basic");
      setRecetas(data);
    } catch (e) { setError(String(e)); }
  };

  const loadPlatos = async () => {
    try {
      const data = await invoke<PlatoCaja[]>("get_platos_caja", { categoriaId: selectedCat });
      setPlatos(data);
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => { loadCategorias(); loadRecetas(); }, []);

  useEffect(() => { loadPlatos(); }, [selectedCat]);

  useEffect(() => { if (loading && categorias.length > 0) setLoading(false); }, [categorias]);

  const handleNew = () => {
    setEditingId(null);
    setForm({ categoria_id: selectedCat || (categorias[0]?.id ?? 0), receta_id: null, nombre: "", plus: 0, activo: true });
    setShowForm(true);
  };

  const handleEdit = (plato: PlatoCaja) => {
    setEditingId(plato.id);
    setForm({ categoria_id: plato.categoria_id, receta_id: plato.receta_id, nombre: plato.nombre, plus: plato.plus || 0, activo: plato.activo });
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
        input: { categoria_id: plato.categoria_id, receta_id: plato.receta_id, nombre: plato.nombre, activo: !plato.activo }
      });
      loadPlatos();
    } catch (e) { setError(String(e)); }
  };

  const getCatName = (id: number) => categorias.find(c => c.id === id)?.nombre ?? "—";

  // Group recetas by category
  const recetasByCategoria = recetas.reduce((acc, r) => {
    const cat = r.categoria || "Otros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {} as Record<string, RecetaBasic[]>);

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
        Selecciona recetas de Escandallos y asígnalas a una categoría de la Caja.
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
      <>
        <div className="p-4 pb-2 space-y-3">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Buscar plato..." />
          <div className="flex gap-2">
            <button onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              Todos ({platos.length})
            </button>
            <button onClick={() => setStatusFilter("active")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === "active" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              Activos ({platos.filter(p => p.activo).length})
            </button>
            <button onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === "inactive" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              Desactivados ({platos.filter(p => !p.activo).length})
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Plato</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Categoría Caja</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Plus (€)</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Activo</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {platos.filter(p => {
              if (selectedCat && p.categoria_id !== selectedCat) return false;
              if (statusFilter === "active" && !p.activo) return false;
              if (statusFilter === "inactive" && p.activo) return false;
              return !searchTerm || p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
            }).map(plato => (
              <tr key={plato.id} className={`hover:bg-gray-50 ${!plato.activo ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{plato.nombre}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {getCatName(plato.categoria_id)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {plato.plus > 0 ? `+${plato.plus.toFixed(2)}€` : "—"}
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
            {platos.filter(p => {
              if (selectedCat && p.categoria_id !== selectedCat) return false;
              if (statusFilter === "active" && !p.activo) return false;
              if (statusFilter === "inactive" && p.activo) return false;
              return !searchTerm || p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
            }).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                {searchTerm ? "No se encontraron platos" : selectedCat ? "No hay platos en esta categoría" : "No hay platos. Añade uno con el botón de arriba."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      </>

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría Caja *</label>
                <SearchableSelect
                  options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
                  value={form.categoria_id}
                  onChange={(val) => setForm({ ...form, categoria_id: val })}
                  placeholder="Seleccionar categoría..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receta (Escandallos) *</label>
                <SearchableSelect
                  options={Object.entries(recetasByCategoria).flatMap(([cat, items]) =>
                    items.map(r => ({ value: r.id, label: `[${cat}] ${r.nombre}` }))
                  )}
                  value={form.receta_id ?? 0}
                  onChange={(val) => {
                    const id = val || null;
                    const receta = recetas.find(r => r.id === id);
                    setForm({ ...form, receta_id: id, nombre: receta?.nombre ?? form.nombre });
                  }}
                  placeholder="Seleccionar receta..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre (editable) *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  placeholder="Nombre del plato"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <p className="text-xs text-gray-400 mt-1">Se rellena automáticamente al seleccionar la receta</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plus (€ extra)</label>
                <input type="number" step="0.01" min="0" value={form.plus}
                  onChange={(e) => setForm({ ...form, plus: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <p className="text-xs text-gray-400 mt-1">Sobrecoste si se elige este plato en el menú</p>
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
