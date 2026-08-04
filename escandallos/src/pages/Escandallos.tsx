import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, ChevronLeft, FileText } from "lucide-react";
import { exportRecetaPDF } from "../lib/exports";
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
  codigo_caja: string | null;
}

interface RecetaIngrediente {
  id: number;
  receta_id: number;
  ingrediente_id: number | null;
  ingrediente_nombre: string | null;
  sub_receta_id: number | null;
  sub_receta_nombre: string | null;
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

interface Guarnicion {
  id: number;
  nombre: string;
  descripcion: string | null;
}

interface CosteGuarnicion {
  nombre: string;
  coste_total: number;
  porciones: number;
  coste_porcion: number;
  margen_porcentaje: number;
  precio_venta: number | null;
  precio_venta_sugerido: number;
  ingredientes: CosteIngrediente[];
}

interface RecetaGuarnicion {
  id: number;
  receta_id: number;
  guarnicion_id: number;
  guarnicion_nombre: string | null;
}

const ingredienteRecetaSchema = z.object({
  ingrediente_id: z.string().optional(),
  sub_receta_id: z.string().optional(),
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
  const [guarniciones, setGuarniciones] = useState<Guarnicion[]>([]);
  const [recetaGuarniciones, setRecetaGuarniciones] = useState<RecetaGuarnicion[]>([]);
  const [costesGuarniciones, setCostesGuarniciones] = useState<CosteGuarnicion[]>([]);
  const [showGuarnForm, setShowGuarnForm] = useState(false);
  const [recetasBase, setRecetasBase] = useState<Receta[]>([]);
  const [tipoIngrediente, setTipoIngrediente] = useState<"ingrediente" | "receta">("ingrediente");

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
      const data = await invoke<RecetaIngrediente[]>("get_receta_ingredientes", { receta_id: recetaId });
      setRecetaIngredientes(data);
    } catch (e) {
      console.error("Error loading receta ingredientes:", e);
    }
  };

  const loadCosteReceta = async (recetaId: number) => {
    try {
      const data = await invoke<CosteReceta>("get_receta_coste", { receta_id: recetaId });
      setCosteReceta(data);
    } catch (e) {
      console.error("Error loading coste:", e);
    }
  };

  const loadAlergenosReceta = async (recetaId: number) => {
    try {
      const data = await invoke<string[]>("get_receta_alergenos", { receta_id: recetaId });
      setAlergenosReceta(data);
    } catch (e) {
      console.error("Error loading alérgenos:", e);
    }
  };

  useEffect(() => {
    loadRecetas();
    loadIngredientes();
    invoke<Receta[]>("get_recetas_base").then(setRecetasBase).catch(console.error);
    invoke<Guarnicion[]>("get_guarniciones").then(setGuarniciones).catch(console.error);
  }, []);

  useEffect(() => {
    if (recetas.length > 0) {
      const loadAll = async () => {
        const map: Record<number, string[]> = {};
        for (const r of recetas) {
          try {
            const data = await invoke<string[]>("get_receta_alergenos", { receta_id: r.id });
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
      // Load guarniciones for this receta
      invoke<RecetaGuarnicion[]>("get_receta_guarniciones", { receta_id: selectedReceta.id })
        .then(setRecetaGuarniciones)
        .catch(console.error);
    }
  }, [selectedReceta]);

  useEffect(() => {
    if (recetaGuarniciones.length > 0) {
      const loadAll = async () => {
        const costes: CosteGuarnicion[] = [];
        for (const rg of recetaGuarniciones) {
          try {
            const c = await invoke<CosteGuarnicion>("get_guarnicion_coste", { guarnicion_id: rg.guarnicion_id });
            costes.push(c);
          } catch { /* ignore */ }
        }
        setCostesGuarniciones(costes);
      };
      loadAll();
    } else {
      setCostesGuarniciones([]);
    }
  }, [recetaGuarniciones]);

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
    if (tipoIngrediente === "ingrediente" && !data.ingrediente_id) { alert("Selecciona un ingrediente"); return; }
    if (tipoIngrediente === "receta" && !data.sub_receta_id) { alert("Selecciona una receta base"); return; }
    const input = {
      receta_id: selectedReceta.id,
      ingrediente_id: tipoIngrediente === "ingrediente" ? parseInt(data.ingrediente_id!) : null,
      sub_receta_id: tipoIngrediente === "receta" ? parseInt(data.sub_receta_id!) : null,
      cantidad: parseFloat(data.cantidad),
      unidad: data.unidad,
      merma_porcentaje: parseFloat(data.merma_porcentaje) || 0,
      notas: data.notas || null,
      orden: recetaIngredientes.length,
    };
    console.log("Añadiendo:", input);
    try {
      await invoke("add_receta_ingrediente", { input });
      setShowIngredienteForm(false);
      resetIng({ merma_porcentaje: "0" });
      setTipoIngrediente("ingrediente");
      loadRecetaIngredientes(selectedReceta.id);
      loadCosteReceta(selectedReceta.id);
    } catch (e) {
      console.error("Error adding ingrediente:", e);
      alert("Error: " + e);
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
    if (!confirm("¿Eliminar este escandallo y todos sus ingredientes?")) return;
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
    if (!confirm("¿Eliminar este ingrediente del escandallo?")) return;
    try {
      await invoke("delete_receta_ingrediente", { id });
      if (selectedReceta) {
        loadRecetaIngredientes(selectedReceta.id);
        loadCosteReceta(selectedReceta.id);
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
            <p className="text-sm font-medium text-gray-500 mb-2">Alérgenos del escandallo:</p>
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
              <button onClick={() => { setShowIngredienteForm(false); setTipoIngrediente("ingrediente"); resetIng({ merma_porcentaje: "0" }); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            {/* Toggle ingrediente / receta base */}
            <div className="flex gap-2 mb-4">
              <button type="button" onClick={() => setTipoIngrediente("ingrediente")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tipoIngrediente === "ingrediente" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                Ingrediente
              </button>
              <button type="button" onClick={() => { setTipoIngrediente("receta"); resetIng({ merma_porcentaje: "0", unidad: "ud" }); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tipoIngrediente === "receta" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                Receta base
              </button>
            </div>
            <form onSubmit={handleSubmitIng(onSubmitIngrediente)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tipoIngrediente === "ingrediente" ? "Ingrediente *" : "Receta base *"}
                </label>
                {tipoIngrediente === "ingrediente" ? (
                  <select
                    {...registerIng("ingrediente_id", { required: tipoIngrediente === "ingrediente" ? "Selecciona un ingrediente" : false })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    {ingredientes.map((i) => (
                      <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_base})</option>
                    ))}
                  </select>
                ) : (
                  <select
                    {...registerIng("sub_receta_id", { required: tipoIngrediente === "receta" ? "Selecciona una receta base" : false })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar receta base...</option>
                    {recetasBase.filter(rb => rb.id !== selectedReceta?.id).map((rb) => (
                      <option key={rb.id} value={rb.id}>{rb.nombre} ({rb.porciones} ud.)</option>
                    ))}
                  </select>
                )}
                {errorsIng.ingrediente_id && tipoIngrediente === "ingrediente" && <p className="text-red-500 text-sm mt-1">{errorsIng.ingrediente_id.message}</p>}
                {errorsIng.sub_receta_id && tipoIngrediente === "receta" && <p className="text-red-500 text-sm mt-1">{errorsIng.sub_receta_id.message}</p>}
                {recetasBase.length === 0 && tipoIngrediente === "receta" && <p className="text-xs text-gray-400 mt-1">No hay recetas marcadas como base</p>}
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
                  disabled={tipoIngrediente === "receta"}
                >
                  {tipoIngrediente === "receta" ? (
                    <option value="ud">ud</option>
                  ) : (
                    <>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="ud">ud</option>
                    </>
                  )}
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
            <div className="p-6 text-center text-gray-500">No hay ingredientes en este escandallo</div>
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
                      {ri.sub_receta_id ? (
                        <span className="flex items-center gap-1.5">
                          <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded font-semibold">RECETA</span>
                          {ri.sub_receta_nombre ?? `Receta #${ri.sub_receta_id}`}
                        </span>
                      ) : (
                        ri.ingrediente_nombre ?? "—"
                      )}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Costes</h3>
              <button
                onClick={() => {
                  exportRecetaPDF({
                    nombre: selectedReceta.nombre,
                    descripcion: selectedReceta.descripcion,
                    categoria: selectedReceta.categoria,
                    porciones: selectedReceta.porciones,
                    tiempo_preparacion: selectedReceta.tiempo_preparacion,
                    precio_venta: selectedReceta.precio_venta,
                    margen_porcentaje: selectedReceta.margen_porcentaje,
                    ingredientes: costeReceta.ingredientes,
                    alergenos: alergenosReceta,
                    coste_total: costeReceta.coste_total,
                    coste_porcion: costeReceta.coste_porcion,
                    food_cost_pct: costeReceta.food_cost_pct,
                    margen_real_pct: costeReceta.margen_real_pct,
                    guarniciones: costesGuarniciones.map(g => ({
                      nombre: g.nombre,
                      coste_total: g.coste_total,
                      ingredientes: g.ingredientes,
                    })),
                  });
                }}
                className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                <FileText size={16} />
                Exportar PDF
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Coste total</p>
                <p className="text-2xl font-bold text-slate-800">{costeReceta.coste_total.toFixed(2)} €</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Coste por porción</p>
                {(() => {
                  const costeGuarnPorcion = costesGuarniciones.reduce((s, c) => s + c.coste_porcion, 0);
                  const costePorcComb = costeReceta.coste_porcion + costeGuarnPorcion;
                  return (
                    <>
                      <p className="text-2xl font-bold text-slate-800">{costePorcComb.toFixed(2)} €</p>
                      {costeGuarnPorcion > 0 && <p className="text-xs text-gray-400">Receta: {costeReceta.coste_porcion.toFixed(2)}€ + Guarn.: {costeGuarnPorcion.toFixed(2)}€</p>}
                    </>
                  );
                })()}
              </div>
              {costeReceta.food_cost_pct != null && (
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Food Cost</p>
                  {(() => {
                    const costeGuarnPorcion = costesGuarniciones.reduce((s, c) => s + c.coste_porcion, 0);
                    const costePorcComb = costeReceta.coste_porcion + costeGuarnPorcion;
                    const precioVenta = costeReceta.precio_venta ?? 0;
                    const foodCostComb = precioVenta > 0 ? (costePorcComb / precioVenta) * 100 : null;
                    return (
                      <>
                        {foodCostComb != null ? (
                          <>
                            <p className={`text-2xl font-bold ${foodCostComb < 30 ? "text-green-600" : foodCostComb <= 35 ? "text-yellow-500" : "text-red-600"}`}>
                              {foodCostComb.toFixed(1)}%
                            </p>
                            {costeGuarnPorcion > 0 && <p className="text-xs text-gray-400">Sin guarnición: {costeReceta.food_cost_pct.toFixed(1)}%</p>}
                          </>
                        ) : (
                          <p className="text-2xl font-bold text-gray-400">—</p>
                        )}
                        <p className="text-xs text-gray-400">Precio actual: {precioVenta.toFixed(2)} €/porción</p>
                      </>
                    );
                  })()}
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
              {(() => {
                const costeGuarnPorcion = costesGuarniciones.reduce((s, c) => s + c.coste_porcion, 0);
                const costePorcionComb = costeReceta.coste_porcion + costeGuarnPorcion;
                const margen = costeReceta.margen_porcentaje ?? 50;
                const precioSugerido = margen < 100 && margen > 0 ? costePorcionComb / (1 - margen / 100) : costePorcionComb * 2;
                return (
                  <>
                    <p className="text-xs text-gray-400 mb-1">
                      Coste/porción: {costeReceta.coste_porcion.toFixed(2)}€
                      {costeGuarnPorcion > 0 && ` + ${costeGuarnPorcion.toFixed(2)}€ guarn. = ${costePorcionComb.toFixed(2)}€`}
                    </p>
                    <p className="text-2xl font-bold text-blue-600">{precioSugerido.toFixed(2)} €</p>
                  </>
                );
              })()}
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
                  {(() => {
                    const costesPorcion = costesGuarniciones.map(cg => cg.coste_porcion);
                    const costeGuarnPorcion = costesPorcion.reduce((s, c) => s + c, 0);
                    if (costeGuarnPorcion === 0) return null;
                    return (
                      <>
                        {costesGuarniciones.map((cg, i) => (
                          <tr key={i} className="bg-amber-50">
                            <td colSpan={4} className="px-4 py-2 text-sm text-amber-800 text-right">+ {cg.nombre} (1 ración)</td>
                            <td className="px-4 py-2 text-sm text-amber-800 text-right">→</td>
                            <td className="px-4 py-2 text-sm font-medium text-amber-800 text-right">{cg.coste_porcion.toFixed(2)} €</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 border-t-2 border-blue-200">
                          <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-blue-800 text-right">Total porción</td>
                          <td className="px-4 py-3 text-sm font-bold text-blue-800 text-right">{(costeReceta.coste_total + costeGuarnPorcion).toFixed(2)} €</td>
                        </tr>
                      </>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Guarniciones */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Guarniciones</h3>
            {!showGuarnForm && (
              <button
                onClick={() => setShowGuarnForm(true)}
                className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
              >
                <Plus size={18} />
                Añadir Guarnición
              </button>
            )}
          </div>

          {showGuarnForm && (
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">Seleccionar guarnición</h4>
                <button onClick={() => setShowGuarnForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {guarniciones
                  .filter(g => !recetaGuarniciones.some(rg => rg.guarnicion_id === g.id))
                  .map(g => (
                    <button
                      key={g.id}
                      onClick={async () => {
                        try {
                          await invoke("add_receta_guarnicion", { input: { receta_id: selectedReceta.id, guarnicion_id: g.id } });
                          setShowGuarnForm(false);
                          setRecetaGuarniciones(await invoke("get_receta_guarniciones", { receta_id: selectedReceta.id }));
                        } catch (e) { alert("Error: " + e); }
                      }}
                      className="text-left p-3 border border-gray-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800">{g.nombre}</p>
                      {g.descripcion && <p className="text-xs text-gray-500 mt-0.5">{g.descripcion}</p>}
                    </button>
                  ))}
                {guarniciones.filter(g => !recetaGuarniciones.some(rg => rg.guarnicion_id === g.id)).length === 0 && (
                  <p className="text-sm text-gray-500 col-span-full">Todas las guarniciones ya están añadidas</p>
                )}
              </div>
            </div>
          )}

          {recetaGuarniciones.length > 0 && costesGuarniciones.length > 0 && (
            <div className="space-y-3">
              {recetaGuarniciones.map((rg, idx) => {
                const coste = costesGuarniciones[idx];
                if (!coste) return null;
                return (
                  <div key={rg.id} className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-800">+ {rg.guarnicion_nombre}</span>
                        <span className="text-sm text-gray-500 ml-3">1 ración: {coste.coste_porcion.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-800">Combinado: {(costeReceta ? costeReceta.coste_porcion + coste.coste_porcion : coste.coste_porcion).toFixed(2)} €/porción</span>
                        <button
                          onClick={async () => {
                            if (!confirm("¿Eliminar esta guarnición de la receta?")) return;
                            try {
                              await invoke("delete_receta_guarnicion", { id: rg.id });
                              setRecetaGuarniciones(await invoke("get_receta_guarniciones", { receta_id: selectedReceta.id }));
                            } catch (e) { alert("Error: " + e); }
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Ingrediente</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Cantidad</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Unidad</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Precio/ud</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Coste</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {coste.ingredientes.map((ci, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-800">{ci.ingrediente_nombre}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 text-right">{ci.cantidad}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{ci.unidad}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 text-right">{ci.precio_por_unidad_receta?.toFixed(2) ?? "-"} €</td>
                            <td className="px-4 py-2 text-sm text-gray-800 text-right font-medium">{ci.coste.toFixed(2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-amber-50 border-t border-amber-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-right">1 ración</td>
                          <td className="px-4 py-2 text-sm font-bold text-right">{coste.coste_porcion.toFixed(2)} €</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })}
              {costeReceta && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Coste escandallo + guarniciones (porción)</span>
                    <span className="text-xl font-bold text-blue-700">
                      {costeReceta.coste_porcion.toFixed(2)} + {costesGuarniciones.reduce((s, c) => s + c.coste_porcion, 0).toFixed(2)} = {(costeReceta.coste_porcion + costesGuarniciones.reduce((s, c) => s + c.coste_porcion, 0)).toFixed(2)} €
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          {recetaGuarniciones.length === 0 && (
            <p className="text-sm text-gray-500">No hay guarniciones asociadas a este escandallo</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Escandallos</h2>
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
            Nuevo Escandallo
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingId ? "Editar Escandallo" : "Nuevo Escandallo"}
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
                <span className="text-sm font-medium text-gray-700">Escandallo base</span>
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
          <div className="p-6 text-center text-gray-500">No hay escandallos registrados</div>
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
