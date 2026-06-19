import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, ArrowRightLeft } from "lucide-react";

const ingredienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  unidad_base: z.string().min(1, "La unidad es obligatoria"),
  categoria: z.string().optional(),
  alergenos: z.string().optional(),
});

type IngredienteFormData = z.infer<typeof ingredienteSchema>;

interface Ingrediente {
  id: number;
  nombre: string;
  unidad_base: string;
  categoria: string | null;
  alergenos: string | null;
}

const UNIDADES = ["kg", "g", "l", "ml", "ud"];

const conversionRates: Record<string, Record<string, number>> = {
  kg: { g: 1000 },
  g: { kg: 0.001 },
  l: { ml: 1000 },
  ml: { l: 0.001 },
};

export default function Ingredientes() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConverter, setShowConverter] = useState(false);
  const [convValue, setConvValue] = useState("");
  const [convFrom, setConvFrom] = useState("kg");
  const [convTo, setConvTo] = useState("g");
  const [convResult, setConvResult] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IngredienteFormData>({
    resolver: zodResolver(ingredienteSchema),
  });

  const loadIngredientes = async () => {
    try {
      const data = await invoke<Ingrediente[]>("get_ingredientes");
      setIngredientes(data);
    } catch (e) {
      console.error("Error loading ingredientes:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIngredientes();
  }, []);

  const onSubmit = async (data: IngredienteFormData) => {
    try {
      if (editingId) {
        await invoke("update_ingrediente", { id: editingId, input: data });
      } else {
        await invoke("create_ingrediente", { input: data });
      }
      setShowForm(false);
      setEditingId(null);
      reset();
      loadIngredientes();
    } catch (e) {
      console.error("Error saving ingrediente:", e);
    }
  };

  const handleEdit = (ing: Ingrediente) => {
    setEditingId(ing.id);
    reset({
      nombre: ing.nombre,
      unidad_base: ing.unidad_base,
      categoria: ing.categoria ?? "",
      alergenos: ing.alergenos ?? "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este ingrediente?")) return;
    try {
      await invoke("delete_ingrediente", { id });
      loadIngredientes();
    } catch (e) {
      console.error("Error deleting ingrediente:", e);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    reset();
  };

  const convert = () => {
    const val = parseFloat(convValue);
    if (isNaN(val)) {
      setConvResult(null);
      return;
    }
    if (convFrom === convTo) {
      setConvResult(val.toFixed(4));
      return;
    }
    const rate = conversionRates[convFrom]?.[convTo];
    if (rate) {
      setConvResult((val * rate).toFixed(4));
    } else {
      setConvResult("No convertible");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Ingredientes</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowConverter(!showConverter)}
            className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowRightLeft size={18} />
            Conversor
          </button>
          {!showForm && (
            <button
              onClick={() => {
                setEditingId(null);
                reset();
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Nuevo Ingrediente
            </button>
          )}
        </div>
      </div>

      {showConverter && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Conversor de Unidades</h3>
            <button onClick={() => setShowConverter(false)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
              <input
                type="number"
                value={convValue}
                onChange={(e) => setConvValue(e.target.value)}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">De</label>
              <select
                value={convFrom}
                onChange={(e) => setConvFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <ArrowRightLeft size={20} className="text-gray-400 mb-2" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">A</label>
              <select
                value={convTo}
                onChange={(e) => setConvTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <button
              onClick={convert}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Convertir
            </button>
            {convResult !== null && (
              <div className="text-lg font-semibold text-blue-600">
                = {convResult} {convTo}
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingId ? "Editar Ingrediente" : "Nuevo Ingrediente"}
            </h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                {...register("nombre")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad base *</label>
              <select
                {...register("unidad_base")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              {errors.unidad_base && <p className="text-red-500 text-sm mt-1">{errors.unidad_base.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <input
                {...register("categoria")}
                placeholder="Ej: Carnes, Pescados, Verduras..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alérgenos (JSON)</label>
              <input
                {...register("alergenos")}
                placeholder='["gluten","lactosa"]'
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Cargando...</div>
        ) : ingredientes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No hay ingredientes registrados</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unidad</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Categoría</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Alérgenos</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ingredientes.map((ing) => (
                <tr key={ing.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{ing.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ing.unidad_base}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ing.categoria ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ing.alergenos ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button
                      onClick={() => handleEdit(ing)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(ing.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
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
