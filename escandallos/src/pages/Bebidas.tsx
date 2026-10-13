import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, CupSoda } from "lucide-react";
import SearchBar from "../components/SearchBar";

const bebidaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  unidad_base: z.string().min(1, "La unidad es obligatoria"),
  categoria: z.string().optional(),
  precio: z.string().optional(),
});

type BebidaFormData = z.infer<typeof bebidaSchema>;

interface Bebida {
  id: number;
  nombre: string;
  unidad_base: string;
  categoria: string | null;
  precio: number | null;
  proveedor_nombre: string | null;
  tipo: string | null;
}

const UNIDADES = ["l", "ml", "ud"];

export default function Bebidas() {
  const [bebidas, setBebidas] = useState<Bebida[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<BebidaFormData>({ resolver: zodResolver(bebidaSchema) });

  const loadBebidas = async () => {
    try {
      const data = await invoke<Bebida[]>("get_ingredientes", { tipo: "bebida" });
      setBebidas(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadBebidas(); }, []);

  const onSubmit = async (data: BebidaFormData) => {
    try {
      const input = {
        nombre: data.nombre,
        unidad_base: data.unidad_base,
        categoria: data.categoria || null,
        alergenos: null,
        precio: data.precio ? parseFloat(data.precio) : null,
        tipo: "bebida",
      };
      if (editingId) await invoke("update_ingrediente", { id: editingId, input });
      else await invoke("create_ingrediente", { input });
      setShowForm(false); setEditingId(null); reset(); loadBebidas();
    } catch (e) { alert("Error: " + e); }
  };

  const handleEdit = (b: Bebida) => {
    setEditingId(b.id);
    reset({
      nombre: b.nombre,
      unidad_base: b.unidad_base,
      categoria: b.categoria ?? "",
      precio: b.precio != null ? String(b.precio) : "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta bebida?")) return;
    try { await invoke("delete_ingrediente", { id }); loadBebidas(); } catch (e) { alert("Error: " + e); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CupSoda size={28} /> Bebidas
        </h2>
        {!showForm && (
          <button onClick={() => { setEditingId(null); reset({ unidad_base: "l" }); setShowForm(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={18} /> Nueva Bebida
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{editingId ? "Editar" : "Nueva"} Bebida</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); reset(); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input {...register("nombre")} placeholder="Ej: Coca-Cola lata" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad *</label>
              <select {...register("unidad_base")} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <input {...register("categoria")} placeholder="Ej: Refrescos, Cervezas, Vinos" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio por unidad (€)</label>
              <input type="number" step="0.001" min="0" {...register("precio")} placeholder="0.000" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); reset(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{isSubmitting ? "Guardando..." : editingId ? "Actualizar" : "Crear"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="p-4 pb-2">
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Buscar bebida..." />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Cargando...</div>
        ) : bebidas.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No hay bebidas registradas</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Categoría</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Unidad</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Precio/ud</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bebidas.filter(b => !searchTerm || b.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{b.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.categoria ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{b.unidad_base}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{b.precio != null ? `${b.precio.toFixed(4)} €` : "-"}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button onClick={() => handleEdit(b)} className="text-blue-600 hover:text-blue-800 mr-3"><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(b.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
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
