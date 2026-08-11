import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";
import SearchBar from "../components/SearchBar";

interface CajaCategoria {
  id: number;
  nombre: string;
  precio: number;
  plus: number;
  orden: number;
  activa: boolean;
}

const emptyForm = { nombre: "", precio: 0, plus: 0, orden: 0, activa: true };

export default function PreciosCaja() {
  const [categorias, setCategorias] = useState<CajaCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const load = async () => {
    try {
      const data = await invoke<CajaCategoria[]>("get_caja_categorias");
      setCategorias(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleNew = () => {
    setEditingId(null);
    const maxOrden = categorias.reduce((max, c) => Math.max(max, c.orden), 0);
    setForm({ nombre: "", precio: 0, plus: 0, orden: maxOrden + 1, activa: true });
    setShowForm(true);
  };

  const handleEdit = (cat: CajaCategoria) => {
    setEditingId(cat.id);
    setForm({ nombre: cat.nombre, precio: cat.precio, plus: cat.plus, orden: cat.orden, activa: cat.activa });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError("Nombre requerido"); return; }
    try {
      if (editingId) {
        await invoke("update_categoria_caja", { id: editingId, input: form });
      } else {
        await invoke("create_categoria_caja", { input: form });
      }
      setShowForm(false);
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      await invoke("delete_categoria_caja", { id });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleToggle = async (cat: CajaCategoria) => {
    try {
      await invoke("update_categoria_caja", {
        id: cat.id,
        input: { nombre: cat.nombre, precio: cat.precio, plus: cat.plus, orden: cat.orden, activa: !cat.activa }
      });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Cargando...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Precios Caja</h1>
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={18} /> Nueva categoría
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError("")}><X size={16} /></button>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-4">
        Configura el precio base y el importe del plus para cada categoría. El plus se aplica cuando un plato tiene elaboración extra.
      </p>

      <>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 pb-2">
            <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Buscar categoría..." />
          </div>
          <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Categoría</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Precio base (€)</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Plus (€)</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Activa</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {categorias.filter((cat) => cat.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map((cat) => (
              <tr key={cat.id} className={`hover:bg-gray-50 ${!cat.activa ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{cat.nombre}</td>
                <td className="px-4 py-3 text-right font-mono">{cat.precio.toFixed(2)} €</td>
                <td className="px-4 py-3 text-right font-mono">{cat.plus > 0 ? `+${cat.plus.toFixed(2)} €` : "—"}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleToggle(cat)} className={`w-10 h-5 rounded-full transition-colors ${cat.activa ? "bg-blue-600" : "bg-gray-300"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${cat.activa ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(cat)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {categorias.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No hay categorías</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editingId ? "Editar categoría" : "Nueva categoría"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Primero, Bebida..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio base (€) *</label>
                  <input type="number" step="0.10" min="0" value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plus (€)</label>
                  <input type="number" step="0.10" min="0" value={form.plus}
                    onChange={(e) => setForm({ ...form, plus: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <input type="number" min="0" value={form.orden}
                    onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-medium text-gray-700">Activa</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Save size={16} /> {editingId ? "Guardar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
