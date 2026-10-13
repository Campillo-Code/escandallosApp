import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, Package } from "lucide-react";
import SearchBar from "../components/SearchBar";

const envaseSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  unidad_base: z.string().min(1, "La unidad es obligatoria"),
  categoria: z.string().optional(),
  precio: z.string().optional(),
});

type EnvaseFormData = z.infer<typeof envaseSchema>;

interface Envase {
  id: number;
  nombre: string;
  unidad_base: string;
  categoria: string | null;
  precio: number | null;
  proveedor_nombre: string | null;
  tipo: string | null;
}

const UNIDADES = ["ud", "kg", "g", "l", "ml"];

export default function Envases() {
  const [envases, setEnvases] = useState<Envase[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EnvaseFormData>({ resolver: zodResolver(envaseSchema) });

  const loadEnvases = async () => {
    try {
      const data = await invoke<Envase[]>("get_ingredientes", { tipo: "envase" });
      setEnvases(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadEnvases(); }, []);

  const onSubmit = async (data: EnvaseFormData) => {
    try {
      const input = {
        nombre: data.nombre,
        unidad_base: data.unidad_base,
        categoria: data.categoria || null,
        alergenos: null,
        precio: data.precio ? parseFloat(data.precio) : null,
        tipo: "envase",
      };
      if (editingId) await invoke("update_ingrediente", { id: editingId, input });
      else await invoke("create_ingrediente", { input });
      setShowForm(false); setEditingId(null); reset(); loadEnvases();
    } catch (e) { alert("Error: " + e); }
  };

  const handleEdit = (e: Envase) => {
    setEditingId(e.id);
    reset({
      nombre: e.nombre,
      unidad_base: e.unidad_base,
      categoria: e.categoria ?? "",
      precio: e.precio != null ? String(e.precio) : "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este envase?")) return;
    try { await invoke("delete_ingrediente", { id }); loadEnvases(); } catch (e) { alert("Error: " + e); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package size={28} /> Envases
        </h2>
        {!showForm && (
          <button onClick={() => { setEditingId(null); reset({ unidad_base: "ud" }); setShowForm(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={18} /> Nuevo Envase
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{editingId ? "Editar" : "Nuevo"} Envase</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); reset(); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input {...register("nombre")} placeholder="Ej: Vaso plástico 250ml" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
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
              <input {...register("categoria")} placeholder="Ej: Desechables" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
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
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Buscar envase..." />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Cargando...</div>
        ) : envases.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No hay envases registrados</div>
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
              {envases.filter(e => !searchTerm || e.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{e.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{e.categoria ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{e.unidad_base}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{e.precio != null ? `${e.precio.toFixed(4)} €` : "-"}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button onClick={() => handleEdit(e)} className="text-blue-600 hover:text-blue-800 mr-3"><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
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
