import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, ChevronLeft, FileText } from "lucide-react";
import DateInput from "../components/DateInput";
import { exportFichaRecetaPDF } from "../lib/exports";
import { getAlergenoLabel, getAlergenoColor } from "../lib/alergenos";

const schema = z.object({
  receta_id: z.string().min(1, "Selecciona un escandallo"),
  catalogado_en: z.string().optional(),
  fecha: z.string().optional(),
  fotos: z.string().optional(),
  notas_adicionales: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface FichaReceta {
  id: number;
  receta_id: number;
  receta_nombre: string | null;
  catalogado_en: string | null;
  fecha: string | null;
  fotos: string | null;
  notas_adicionales: string | null;
}

interface Receta {
  id: number;
  nombre: string;
  descripcion: string | null;
  elaboracion: string | null;
  conservacion: string | null;
  regeneracion: string | null;
  vida_util: string | null;
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
  food_cost_pct: number | null;
  margen_real_pct: number | null;
  precio_venta: number | null;
  ingredientes: CosteIngrediente[];
}

export default function FichasReceta() {
  const [fichas, setFichas] = useState<FichaReceta[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFicha, setSelectedFicha] = useState<FichaReceta | null>(null);
  const [fichaIngredientes, setFichaIngredientes] = useState<RecetaIngrediente[]>([]);
  const [fichaAlergenos, setFichaAlergenos] = useState<string[]>([]);
  const [fichaCoste, setFichaCoste] = useState<CosteReceta | null>(null);
  const [fotosPreview, setFotosPreview] = useState<string>("");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const fechaValue = watch("fecha") ?? "";

  const loadFichas = async () => { try { setFichas(await invoke("get_fichas_receta")); } catch (e) { console.error(e); } finally { setLoading(false); } };
  const loadRecetas = async () => { try { setRecetas(await invoke("get_recetas")); } catch (e) { console.error(e); } };

  useEffect(() => { loadFichas(); loadRecetas(); }, []);

  useEffect(() => {
    if (selectedFicha) {
      invoke<RecetaIngrediente[]>("get_receta_ingredientes", { recetaId: selectedFicha.receta_id }).then(setFichaIngredientes).catch(console.error);
      invoke<string[]>("get_receta_alergenos", { recetaId: selectedFicha.receta_id }).then(setFichaAlergenos).catch(console.error);
      invoke<CosteReceta>("get_receta_coste", { recetaId: selectedFicha.receta_id }).then(setFichaCoste).catch(console.error);
    }
  }, [selectedFicha]);

  const onSubmit = async (data: FormData) => {
    try {
      const input = {
        receta_id: parseInt(data.receta_id),
        catalogado_en: data.catalogado_en || null,
        fecha: data.fecha || null,
        fotos: data.fotos || null,
        notas_adicionales: data.notas_adicionales || null,
      };
      if (editingId) await invoke("update_ficha_receta", { id: editingId, input });
      else await invoke("create_ficha_receta", { input });
      setShowForm(false); setEditingId(null); reset(); setFotosPreview(""); loadFichas();
    } catch (e) { alert("Error: " + e); }
  };

  const handleEdit = (f: FichaReceta) => {
    setEditingId(f.id); setShowForm(true); setSelectedFicha(null);
    const foto = (() => { try { return JSON.parse(f.fotos ?? "null"); } catch { return f.fotos; } })();
    setFotosPreview(typeof foto === "string" ? foto : "");
    reset({
      receta_id: String(f.receta_id),
      catalogado_en: f.catalogado_en ?? "",
      fecha: f.fecha ?? "",
      fotos: typeof foto === "string" ? foto : "",
      notas_adicionales: f.notas_adicionales ?? "",
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta ficha de receta?")) return;
    try { await invoke("delete_ficha_receta", { id }); if (selectedFicha?.id === id) setSelectedFicha(null); loadFichas(); } catch (e) { alert("Error: " + e); }
  };

  if (selectedFicha) {
    const receta = recetas.find(r => r.id === selectedFicha.receta_id);

    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setSelectedFicha(null); setFichaIngredientes([]); setFichaAlergenos([]); setFichaCoste(null); }} className="text-gray-500 hover:text-gray-700"><ChevronLeft size={24} /></button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800">Ficha de Receta: {selectedFicha.receta_nombre}</h2>
          </div>
          <button onClick={() => handleEdit(selectedFicha)} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm">
            <Pencil size={14} /> Editar
          </button>
          <button onClick={() => {
            exportFichaRecetaPDF({
              receta_nombre: selectedFicha.receta_nombre ?? "",
              catalogado_en: selectedFicha.catalogado_en,
              fecha: selectedFicha.fecha,
              porciones: receta?.porciones ?? 0,
              precio_venta: receta?.precio_venta ?? null,
              tiempo_preparacion: receta?.tiempo_preparacion ?? null,
              ingredientes: fichaIngredientes.map(ri => ({
                ingrediente_nombre: ri.ingrediente_nombre ?? ri.sub_receta_nombre ?? "",
                cantidad: ri.cantidad,
                unidad: ri.unidad,
                merma_porcentaje: ri.merma_porcentaje,
              })),
              coste_ingredientes: fichaCoste?.ingredientes ?? [],
              alergenos: fichaAlergenos,
              elaboracion: receta?.elaboracion ?? null,
              conservacion: receta?.conservacion ?? null,
              regeneracion: receta?.regeneracion ?? null,
              vida_util: receta?.vida_util ?? null,
              coste_total: fichaCoste?.coste_total ?? 0,
              coste_porcion: fichaCoste?.coste_porcion ?? 0,
              food_cost_pct: fichaCoste?.food_cost_pct ?? null,
              margen_real_pct: fichaCoste?.margen_real_pct ?? null,
              margen_porcentaje: receta?.margen_porcentaje ?? null,
              notas_adicionales: selectedFicha.notas_adicionales,
              fotos: (() => { try { return JSON.parse(selectedFicha.fotos ?? "null"); } catch { return selectedFicha.fotos; } })(),
            });
          }} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 text-sm">
            <FileText size={14} /> Exportar PDF
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-900 text-white text-center py-3">
            <h3 className="text-lg font-bold tracking-wide">FICHA DE RECETA</h3>
          </div>

          {/* Código interno + Nombre */}
          <div className="bg-indigo-100 px-4 py-2 border-b">
            <span className="text-sm font-semibold text-indigo-900">CÓDIGO INTERNO: {selectedFicha.catalogado_en || "—"}</span>
          </div>
          <div className="bg-indigo-50 px-4 py-2 border-b">
            <span className="text-sm font-semibold text-indigo-900">NOMBRE DEL PLATO: {selectedFicha.receta_nombre}</span>
          </div>

          {/* Row: Catalogado en | Nº Porciones | Precio/Porción | Tiempo Elaboración */}
          <div className="grid grid-cols-4 border-b">
            <div className="bg-indigo-200 px-4 py-2 text-center border-r">
              <p className="text-xs font-bold text-indigo-900">CATALOGADO EN</p>
              <p className="text-sm text-indigo-800">{selectedFicha.catalogado_en || "—"}</p>
            </div>
            <div className="bg-indigo-200 px-4 py-2 text-center border-r">
              <p className="text-xs font-bold text-indigo-900">Nº PORCIONES</p>
              <p className="text-sm text-indigo-800">{receta?.porciones ?? "—"}</p>
            </div>
            <div className="bg-indigo-200 px-4 py-2 text-center border-r">
              <p className="text-xs font-bold text-indigo-900">PRECIO/PORCIÓN</p>
              <p className="text-sm text-indigo-800">{receta?.precio_venta != null ? `${receta.precio_venta.toFixed(2)} €` : "—"}</p>
            </div>
            <div className="bg-indigo-200 px-4 py-2 text-center">
              <p className="text-xs font-bold text-indigo-900">TIEMPO ELABOR.</p>
              <p className="text-sm text-indigo-800">{receta?.tiempo_preparacion != null ? `${receta.tiempo_preparacion} min` : "—"}</p>
            </div>
          </div>

          {/* Fecha */}
          <div className="border-b">
            <div className="bg-indigo-200 px-4 py-2 text-center">
              <p className="text-xs font-bold text-indigo-900">FECHA</p>
              <p className="text-sm text-indigo-800">{selectedFicha.fecha || "—"}</p>
            </div>
          </div>

          {/* Ingredientes + Imagen */}
          <div className="grid grid-cols-3 border-b">
            <div className="col-span-2">
              <div className="bg-indigo-200 px-4 py-2">
                <p className="text-xs font-bold text-indigo-900">INGREDIENTES Y CANTIDADES</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Ingrediente</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Unidad</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Cantidad</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Precio/ud</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Merma</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Coste</th>
                  </tr>
                </thead>
                <tbody>
                  {fichaIngredientes.map((ri, i) => {
                    const costeIng = fichaCoste?.ingredientes.find(
                      ci => ci.ingrediente_nombre === (ri.ingrediente_nombre ?? ri.sub_receta_nombre)
                    );
                    return (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className="px-4 py-1.5 text-gray-800">{ri.ingrediente_nombre || ri.sub_receta_nombre}</td>
                        <td className="px-4 py-1.5 text-gray-600 text-right">{ri.unidad}</td>
                        <td className="px-4 py-1.5 text-gray-600 text-right">{ri.cantidad}</td>
                        <td className="px-4 py-1.5 text-gray-600 text-right">{costeIng?.precio_por_unidad_receta != null ? `${costeIng.precio_por_unidad_receta.toFixed(4)} €` : "—"}</td>
                        <td className="px-4 py-1.5 text-gray-600 text-right">{ri.merma_porcentaje}%</td>
                        <td className="px-4 py-1.5 text-gray-800 text-right font-medium">{costeIng?.coste != null ? `${costeIng.coste.toFixed(2)} €` : "—"}</td>
                      </tr>
                    );
                  })}
                  {fichaIngredientes.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-3 text-gray-400 text-center text-sm">Sin ingredientes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-100 flex items-center justify-center border-l min-h-[200px]">
              {(() => {
                const foto = (() => { try { return JSON.parse(selectedFicha.fotos ?? "null"); } catch { return selectedFicha.fotos; } })();
                if (typeof foto === "string" && foto) {
                  return <img src={foto} alt="Receta" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
                }
                return <span className="text-gray-400 text-sm font-medium">IMAGEN RECETA</span>;
              })()}
            </div>
          </div>

          {/* Alérgenos */}
          <div className="border-b">
            <div className="bg-indigo-200 px-4 py-2">
              <p className="text-xs font-bold text-indigo-900">ALÉRGENOS</p>
            </div>
            <div className="px-4 py-3">
              {fichaAlergenos.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {fichaAlergenos.map(a => (
                    <span key={a} className={`px-3 py-1 rounded-full text-sm font-medium ${getAlergenoColor(a)}`}>{getAlergenoLabel(a)}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Sin alérgenos registrados</p>
              )}
            </div>
          </div>

          {/* Elaboración */}
          <div className="border-b">
            <div className="bg-indigo-200 px-4 py-2">
              <p className="text-xs font-bold text-indigo-900">ELABORACIÓN</p>
            </div>
            <div className="px-4 py-3">
              {receta?.elaboracion ? (
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{receta.elaboracion}</div>
              ) : (
                <p className="text-sm text-gray-500">Sin elaboración definida</p>
              )}
            </div>
          </div>

          {/* Conservación | Regeneración | Vida Útil */}
          <div className="grid grid-cols-3 border-b">
            <div className="border-r">
              <div className="bg-indigo-200 px-4 py-2">
                <p className="text-xs font-bold text-indigo-900">CONSERVACIÓN</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-gray-700">{receta?.conservacion || "—"}</p>
              </div>
            </div>
            <div className="border-r">
              <div className="bg-indigo-200 px-4 py-2">
                <p className="text-xs font-bold text-indigo-900">REGENERACIÓN</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-gray-700">{receta?.regeneracion || "—"}</p>
              </div>
            </div>
            <div>
              <div className="bg-indigo-200 px-4 py-2">
                <p className="text-xs font-bold text-indigo-900">VIDA ÚTIL</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-gray-700">{receta?.vida_util || "—"}</p>
              </div>
            </div>
          </div>

          {/* Costes */}
          {fichaCoste && (
            <>
              <div className="border-b">
                <div className="bg-indigo-900 text-white text-center py-2">
                  <p className="text-xs font-bold tracking-wide">COSTES</p>
                </div>
                <div className="grid grid-cols-4">
                  <div className="bg-indigo-200 px-3 py-2 text-center border-r">
                    <p className="text-xs font-bold text-indigo-900">Coste total</p>
                  </div>
                  <div className="bg-indigo-200 px-3 py-2 text-center border-r">
                    <p className="text-xs font-bold text-indigo-900">Coste por porción</p>
                  </div>
                  <div className="bg-indigo-200 px-3 py-2 text-center border-r">
                    <p className="text-xs font-bold text-indigo-900">Food cost</p>
                  </div>
                  <div className="bg-indigo-200 px-3 py-2 text-center">
                    <p className="text-xs font-bold text-indigo-900">Margen real actual</p>
                  </div>
                  <div className="px-3 py-2 text-center border-r border-t">
                    <p className="text-sm font-semibold text-gray-800">{fichaCoste.coste_total.toFixed(2)} €</p>
                  </div>
                  <div className="px-3 py-2 text-center border-r border-t">
                    <p className="text-sm font-semibold text-gray-800">{fichaCoste.coste_porcion.toFixed(2)} €</p>
                  </div>
                  <div className="px-3 py-2 text-center border-r border-t">
                    <p className="text-sm font-semibold text-gray-800">{fichaCoste.food_cost_pct != null ? `${fichaCoste.food_cost_pct.toFixed(1)}%` : "—"}</p>
                  </div>
                  <div className="px-3 py-2 text-center border-t">
                    <p className="text-sm font-semibold text-gray-800">{fichaCoste.margen_real_pct != null ? `${fichaCoste.margen_real_pct.toFixed(1)}%` : "—"}</p>
                  </div>
                </div>
              </div>
              <div className="border-b">
                <div className="bg-indigo-900 text-white text-center py-2">
                  <p className="text-xs font-bold tracking-wide">PRECIO MÍNIMO SUGERIDO/PORCIÓN (margen {receta?.margen_porcentaje ?? 50}%)</p>
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-gray-500">Coste/porción: {fichaCoste.coste_porcion.toFixed(2)} €</p>
                      <p className="text-3xl font-bold text-blue-600">
                        {(fichaCoste.coste_porcion / (1 - (receta?.margen_porcentaje ?? 50) / 100)).toFixed(2)} €
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notas adicionales */}
          {selectedFicha.notas_adicionales && (
            <div className="border-b">
              <div className="bg-indigo-200 px-4 py-2">
                <p className="text-xs font-bold text-indigo-900">NOTAS ADICIONALES</p>
              </div>
              <div className="px-4 py-3">
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{selectedFicha.notas_adicionales}</div>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Fichas de Receta</h2>
        {!showForm && (
          <button onClick={() => { setEditingId(null); reset(); setShowForm(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={18} /> Nueva Ficha
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{editingId ? "Editar" : "Nueva"} Ficha de Receta</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); reset(); setFotosPreview(""); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Escandallo *</label>
                <select {...register("receta_id")} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="">Seleccionar...</option>
                  {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
                {errors.receta_id && <p className="text-red-500 text-sm mt-1">{errors.receta_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catalogado en</label>
                <input {...register("catalogado_en")} placeholder="Ej: FR-001" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <DateInput value={fechaValue} onChange={(iso) => setValue("fecha", iso)} label="Fecha" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto del producto</label>
                {fotosPreview && (
                  <div className="mb-2 relative inline-block">
                    <img src={fotosPreview} alt="Vista previa" className="h-32 rounded-lg border border-gray-200 object-cover" />
                    <button type="button" onClick={() => { setFotosPreview(""); setValue("fotos", ""); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"><X size={14} /></button>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = reader.result as string;
                    setFotosPreview(base64);
                    setValue("fotos", base64);
                  };
                  reader.readAsDataURL(file);
                }} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
              <textarea {...register("notas_adicionales")} rows={3} placeholder="Notas extra..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); reset(); setFotosPreview(""); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{isSubmitting ? "Guardando..." : editingId ? "Actualizar" : "Crear"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="p-6 text-center text-gray-500">Cargando...</div> :
          fichas.length === 0 ? <div className="p-6 text-center text-gray-500">No hay fichas de receta</div> : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Código interno</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Escandallo</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fichas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedFicha(f)}>
                    <td className="px-4 py-3 text-sm text-gray-600">{f.catalogado_en || "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{f.receta_nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{f.fecha || "—"}</td>
                    <td className="px-4 py-3 text-sm text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleEdit(f)} className="text-blue-600 hover:text-blue-800 mr-3"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(f.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
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
