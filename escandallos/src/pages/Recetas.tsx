import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, ChevronLeft } from "lucide-react";
import { getAlergenoLabel, getAlergenoColor } from "../lib/alergenos";

const recetaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().optional(),
  categoria: z.string().optional(),
  porciones: z.string().min(1, "Mínimo 1 porción"),
  tiempo_preparacion: z.string().optional(),
  es_base: z.boolean(),
  precio_venta: z.string().optional(),
  margen_porcentaje: z.string().optional(),
});

type RecetaFormData = z.infer<typeof recetaSchema>;

interface Receta {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  porciones: number;
  tiempo_preparacion: number | null;
  es_base: boolean;
  precio_venta: number | null;
  margen_porcentaje: number | null;
}

interface RecetaIngrediente {
  id: number;
  receta_id: number;
  ingrediente_id: number | null;
  ingrediente_nombre: string | null;
  sub_receta_id: number | null;
  cantidad: number;
  unidad: string;
  merma_porcentaje: number;
  notas: string | null;
  orden: number;
}

interface CosteIngrediente {
  ingrediente_nombre: string;
  cantidad: number;
  unidad: string;
  merma_porcentaje: number;
  precio_unitario: number | null;
  precio_por_unidad_receta: number | null;
  coste: number;
}

interface CosteReceta {
  coste_total: number;
  coste_porcion: number;
  precio_venta: number | null;
  food_cost_pct: number | null;
  margen_porcentaje: number | null;
  margen_real_pct: number | null;
  precio_venta_sugerido: number;
  ingredientes: CosteIngrediente[];
}

interface Ingrediente {
  id: number;
  nombre: string;
  unidad_base: string;
}

const ingredienteRecetaSchema = z.object({
  ingrediente_id: z.string().min(1, "Selecciona un ingrediente"),
  cantidad: z.string().min(1, "Cantidad obligatoria"),
  unidad: z.string().min(1, "Unidad obligatoria"),
  merma_porcentaje: z.string(),
  notas: z.string().optional(),
});

type IngredienteRecetaFormData = z.infer<typeof ingredienteRecetaSchema>;

export default function Recetas() {
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReceta, setSelectedReceta] = useState<Receta | null>(null);
  const [recetaIngredientes, setRecetaIngredientes] = useState<RecetaIngrediente[]>([]);
  const [showIngredienteForm, setShowIngredienteForm] = useState(false);
  const [costeReceta, setCosteReceta] = useState<CosteReceta | null>(null);
  const [alergenosReceta, setAlergenosReceta] = useState<string[]>([]);
  const [alergenosMap, setAlergenosMap] = useState<Record<number, string[]>>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecetaFormData>({
    resolver: zodResolver(recetaSchema),
    defaultValues: { es_base: false, porciones: "1" },
  });

  const {
    register: registerIng,
    handleSubmit: handleSubmitIng,
    reset: resetIng,
    formState: { errors: errorsIng, isSubmitting: isSubmittingIng },
  } = useForm<IngredienteRecetaFormData>({
    resolver: zodResolver(ingredienteRecetaSchema),
    defaultValues: { merma_porcentaje: "0" },
  });

  const loadRecetas = async () => {
    try {
      const data = await invoke<Receta[]>("get_recetas");
      setRecetas(data);
    } catch (e) {
      console.error("Error loading recetas:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadIngredientes = async () => {
    try {
      const data = await invoke<Ingrediente[]>("get_ingredientes");
      setIngredientes(data);
    } catch (e) {
      console.error("Error loading ingredientes:", e);
    }
  };

  const loadRecetaIngredientes = async (recetaId: number) => {
    try {
      const data = await invoke<RecetaIngrediente[]>("get_receta_ingredientes", { recetaId });
      setRecetaIngredientes(data);
    } catch (e) {
      console.error("Error loading receta ingredientes:", e);
    }
  };

  const loadCosteReceta = async (recetaId: number) => {
    try {
      const data = await invoke<CosteReceta>("get_receta_coste", { recetaId });
      setCosteReceta(data);
    } catch (e) {
      console.error("Error loading coste:", e);
    }
  };

  const loadAlergenosReceta = async (recetaId: number) => {
    try {
      const data = await invoke<string[]>("get_receta_alergenos", { recetaId });
      setAlergenosReceta(data);
    } catch (e) {
      console.error("Error loading alérgenos:", e);
    }
  };

  useEffect(() => {
    loadRecetas();
    loadIngredientes();
  }, []);

  useEffect(() => {
    if (recetas.length > 0) {
      const loadAll = async () => {
        const map: Record<number, string[]> = {};
        for (const r of recetas) {
          try {
            const data = await invoke<string[]>("get_receta_alergenos", { recetaId: r.id });
            map[r.id] = data;
          } catch { /* ignore */ }
        }
        setAlergenosMap(map);
      };
      loadAll();
    }
  }, [recetas]);

  useEffect(() => {
    if (selectedReceta) {
      loadRecetaIngredientes(selectedReceta.id);
      loadCosteReceta(selectedReceta.id);
      loadAlergenosReceta(selectedReceta.id);
    }
  }, [selectedReceta]);

  const onSubmitReceta = async (data: RecetaFormData) => {
    try {
      const input = {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        categoria: data.categoria || null,
        porciones: parseInt(data.porciones) || 1,
        tiempo_preparacion: data.tiempo_preparacion ? parseInt(data.tiempo_preparacion) : null,
        es_base: data.es_base,
        precio_venta: data.precio_venta ? parseFloat(data.precio_venta) : null,
        margen_porcentaje: data.margen_porcentaje ? parseFloat(data.margen_porcentaje) : null,
      };
      if (editingId) {
        await invoke("update_receta", { id: editingId, input });
      } else {
        await invoke("create_receta", { input });
      }
      setShowForm(false);
      setEditingId(null);
      reset();
      loadRecetas();
    } catch (e) {
      console.error("Error saving receta:", e);
    }
  };

  const onSubmitIngrediente = async (data: IngredienteRecetaFormData) => {
    if (!selectedReceta) return;
    try {
      await invoke("add_receta_ingrediente", {
        input: {
          receta_id: selectedReceta.id,
          ingrediente_id: parseInt(data.ingrediente_id),
          sub_receta_id: null,
          cantidad: parseFloat(data.cantidad),
          unidad: data.unidad,
          merma_porcentaje: parseFloat(data.merma_porcentaje) || 0,
          notas: data.notas || null,
          orden: recetaIngredientes.length,
        },
      });
      setShowIngredienteForm(false);
      resetIng();
      loadRecetaIngredientes(selectedReceta.id);
    } catch (e) {
      console.error("Error adding ingrediente:", e);
    }
  };

  const handleEdit = (r: Receta) => {
    setEditingId(r.id);
    reset({
      nombre: r.nombre,
      descripcion: r.descripcion ?? "",
      categoria: r.categoria ?? "",
      porciones: String(r.porciones),
      tiempo_preparacion: r.tiempo_preparacion != null ? String(r.tiempo_preparacion) : "",
      es_base: r.es_base,
      precio_venta: r.precio_venta != null ? String(r.precio_venta) : "",
      margen_porcentaje: r.margen_porcentaje != null ? String(r.margen_porcentaje) : "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta receta y todos sus ingredientes?")) return;
    try {
      await invoke("delete_receta", { id });
      if (selectedReceta?.id === id) {
        setSelectedReceta(null);
        setRecetaIngredientes([]);
      }
      loadRecetas();
    } catch (e) {
      console.error("Error deleting receta:", e);
    }
  };

  const handleDeleteIngrediente = async (id: number) => {
    if (!confirm("¿Eliminar este ingrediente de la receta?")) return;
    try {
      await invoke("delete_receta_ingrediente", { id });
      if (selectedReceta) {
        loadRecetaIngredientes(selectedReceta.id);
      }
    } catch (e) {
      console.error("Error deleting ingrediente:", e);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    reset();
  };

  if (selectedReceta) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              setSelectedReceta(null);
              setRecetaIngredientes([]);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{selectedReceta.nombre}</h2>
            <p className="text-sm text-gray-500">
              {selectedReceta.categoria ?? "Sin categoría"} · {selectedReceta.porciones} porciones
              {selectedReceta.tiempo_preparacion && ` · ${selectedReceta.tiempo_preparacion} min`}
              {selectedReceta.es_base && " · Receta base"}
            </p>
          </div>
        </div>

        {selectedReceta.descripcion && (
          <p className="text-gray-600 mb-4">{selectedReceta.descripcion}</p>
        )}

        {alergenosReceta.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-500 mb-2">Alérgenos de la receta:</p>
            <div className="flex flex-wrap gap-2">
              {alergenosReceta.map((a) => (
                <span key={a} className={`px-3 py-1 rounded-full text-sm font-medium ${getAlergenoColor(a)}`}>
                  {getAlergenoLabel(a)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Ingredientes</h3>
          {!showIngredienteForm && (
            <button
              onClick={() => {
                resetIng();
                setShowIngredienteForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Añadir Ingrediente
            </button>
          )}
        </div>

        {showIngredienteForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Añadir Ingrediente</h3>
              <button onClick={() => setShowIngredienteForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitIng(onSubmitIngrediente)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingrediente *</label>
                <select
                  {...registerIng("ingrediente_id")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar...</option>
                  {ingredientes.map((i) => (
                    <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_base})</option>
                  ))}
                </select>
                {errorsIng.ingrediente_id && <p className="text-red-500 text-sm mt-1">{errorsIng.ingrediente_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
                <input
                  type="number"
                  step="0.001"
                  {...registerIng("cantidad")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errorsIng.cantidad && <p className="text-red-500 text-sm mt-1">{errorsIng.cantidad.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad *</label>
                <select
                  {...registerIng("unidad")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="ud">ud</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Merma %</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...registerIng("merma_porcentaje")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <input
                  {...registerIng("notas")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowIngredienteForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIng}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmittingIng ? "Añadiendo..." : "Añadir"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {recetaIngredientes.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No hay ingredientes en esta receta</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ingrediente</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cantidad</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unidad</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Merma %</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Notas</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recetaIngredientes.map((ri) => (
                  <tr key={ri.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {ri.ingrediente_nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{ri.cantidad}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ri.unidad}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{ri.merma_porcentaje}%</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ri.notas ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <button
                        onClick={() => handleDeleteIngrediente(ri.id)}
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

        {costeReceta && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Costes</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Coste total</p>
                <p className="text-2xl font-bold text-slate-800">{costeReceta.coste_total.toFixed(2)} €</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Coste por porción</p>
                <p className="text-2xl font-bold text-slate-800">{costeReceta.coste_porcion.toFixed(2)} €</p>
              </div>
              {costeReceta.food_cost_pct != null && (
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Food Cost</p>
                  <p className={`text-2xl font-bold ${
                    costeReceta.food_cost_pct < 30 ? "text-green-600" :
                    costeReceta.food_cost_pct <= 35 ? "text-yellow-500" :
                    "text-red-600"
                  }`}>
                    {costeReceta.food_cost_pct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">Precio actual: {costeReceta.precio_venta?.toFixed(2)} €/porción</p>
                </div>
              )}
              {costeReceta.margen_real_pct != null && (
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Margen real actual</p>
                  <p className={`text-2xl font-bold ${
                    costeReceta.margen_real_pct >= 70 ? "text-green-600" :
                    costeReceta.margen_real_pct >= 60 ? "text-yellow-500" :
                    "text-red-600"
                  }`}>
                    {costeReceta.margen_real_pct.toFixed(1)}%
                  </p>
                  {costeReceta.margen_porcentaje != null && (
                    <p className="text-xs text-gray-400">Objetivo mínimo: {costeReceta.margen_porcentaje}%</p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <p className="text-sm text-gray-500 mb-1">Precio mínimo sugerido/porción (margen {costeReceta.margen_porcentaje ?? 50}%)</p>
              <p className="text-2xl font-bold text-blue-600">{costeReceta.precio_venta_sugerido.toFixed(2)} €</p>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ingrediente</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cantidad</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unidad</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Precio/ud</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Merma</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Coste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {costeReceta.ingredientes.map((ci, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{ci.ingrediente_nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{ci.cantidad}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ci.unidad}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {ci.precio_por_unidad_receta != null ? `${ci.precio_por_unidad_receta.toFixed(2)} €` : <span className="text-red-400">Sin precio</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{ci.merma_porcentaje}%</td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right font-medium">{ci.coste.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">Total</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800 text-right">{costeReceta.coste_total.toFixed(2)} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Recetas</h2>
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
            Nueva Receta
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingId ? "Editar Receta" : "Nueva Receta"}
            </h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmitReceta)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                {...register("nombre")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <input
                {...register("categoria")}
                placeholder="Ej: Postres, Primer plato..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porciones *</label>
              <input
                type="number"
                min="1"
                {...register("porciones")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.porciones && <p className="text-red-500 text-sm mt-1">{errors.porciones.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo (min)</label>
              <input
                type="number"
                min="0"
                {...register("tiempo_preparacion")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                {...register("descripcion")}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio venta actual por porción (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register("precio_venta")}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Margen objetivo mínimo (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="99"
                {...register("margen_porcentaje")}
                placeholder="Ej: 70"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
              <label className="flex items-center gap-2 h-[42px]">
                <input
                  type="checkbox"
                  {...register("es_base")}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Receta base</span>
              </label>
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
        ) : recetas.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No hay recetas registradas</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Categoría</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Porciones</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Tiempo</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Base</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Alérgenos</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recetas.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedReceta(r)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.categoria ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{r.porciones}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {r.tiempo_preparacion ? `${r.tiempo_preparacion} min` : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">
                    {r.es_base ? "✓" : ""}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {alergenosMap[r.id] && alergenosMap[r.id].length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {alergenosMap[r.id].map((a) => (
                          <span key={a} className={`px-2 py-0.5 rounded-full text-xs font-medium ${getAlergenoColor(a)}`}>
                            {getAlergenoLabel(a)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleEdit(r)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
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
