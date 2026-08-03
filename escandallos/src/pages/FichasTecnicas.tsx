import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, ChevronLeft, FileText } from "lucide-react";
import DateInput from "../components/DateInput";
import { exportFichaTecnicaPDF } from "../lib/exports";
import { getAlergenoLabel, getAlergenoColor } from "../lib/alergenos";

const schema = z.object({
  receta_id: z.string().min(1, "Selecciona un escandallo"),
  codigo_interno: z.string().optional(),
  catalogado_en: z.string().optional(),
  fecha: z.string().optional(),
  instrucciones_consumo: z.string().optional(),
  pasos_preparacion: z.string().optional(),
  conservacion: z.string().optional(),
  vida_util: z.string().optional(),
  regeneracion: z.string().optional(),
  fotos: z.string().optional(),
  notas_adicionales: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface FichaTecnica {
  id: number;
  receta_id: number;
  receta_nombre: string | null;
  codigo_interno: string | null;
  catalogado_en: string | null;
  fecha: string | null;
  instrucciones_consumo: string | null;
  pasos_preparacion: string | null;
  conservacion: string | null;
  vida_util: string | null;
  regeneracion: string | null;
  fotos: string | null;
  notas_adicionales: string | null;
}

interface Receta { id: number; nombre: string; descripcion: string | null; categoria: string | null; porciones: number; tiempo_preparacion: number | null; }
interface RecetaIngrediente { ingrediente_nombre: string | null; cantidad: number; unidad: string; }

export default function FichasTecnicas() {
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFicha, setSelectedFicha] = useState<FichaTecnica | null>(null);
  const [fichaIngredientes, setFichaIngredientes] = useState<RecetaIngrediente[]>([]);
  const [fichaAlergenos, setFichaAlergenos] = useState<string[]>([]);
  const [fotosPreview, setFotosPreview] = useState<string>("");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const fechaValue = watch("fecha") ?? "";

  const loadFichas = async () => { try { setFichas(await invoke("get_fichas_tecnicas")); } catch (e) { console.error(e); } finally { setLoading(false); } };
  const loadRecetas = async () => { try { setRecetas(await invoke("get_recetas")); } catch (e) { console.error(e); } };

  useEffect(() => { loadFichas(); loadRecetas(); }, []);

  useEffect(() => {
    if (selectedFicha) {
      invoke<RecetaIngrediente[]>("get_receta_ingredientes", { receta_id: selectedFicha.receta_id }).then(setFichaIngredientes).catch(console.error);
      invoke<string[]>("get_receta_alergenos", { receta_id: selectedFicha.receta_id }).then(setFichaAlergenos).catch(console.error);
    }
  }, [selectedFicha]);

  const onSubmit = async (data: FormData) => {
    try {
      const input = {
        receta_id: parseInt(data.receta_id),
        codigo_interno: data.codigo_interno || null,
        catalogado_en: data.catalogado_en || null,
        fecha: data.fecha || null,
        instrucciones_consumo: data.instrucciones_consumo || null,
        pasos_preparacion: data.pasos_preparacion || null,
        conservacion: data.conservacion || null,
        vida_util: data.vida_util || null,
        regeneracion: data.regeneracion || null,
        fotos: data.fotos ? JSON.stringify(data.fotos) : null,
        notas_adicionales: data.notas_adicionales || null,
      };
      if (editingId) await invoke("update_ficha_tecnica", { id: editingId, input });
      else await invoke("create_ficha_tecnica", { input });
      setShowForm(false); setEditingId(null); reset(); setFotosPreview(""); loadFichas();
    } catch (e) { alert("Error: " + e); }
  };

  const handleEdit = (f: FichaTecnica) => {
    setEditingId(f.id); setShowForm(true); setSelectedFicha(null);
    const foto = (() => { try { return JSON.parse(f.fotos ?? "null"); } catch { return f.fotos; } })();
    setFotosPreview(typeof foto === "string" ? foto : "");
    reset({
      receta_id: String(f.receta_id),
      codigo_interno: f.codigo_interno ?? "",
      catalogado_en: f.catalogado_en ?? "",
      fecha: f.fecha ?? "",
      instrucciones_consumo: f.instrucciones_consumo ?? "",
      pasos_preparacion: f.pasos_preparacion ?? "",
      conservacion: f.conservacion ?? "",
      vida_util: f.vida_util ?? "",
      regeneracion: f.regeneracion ?? "",
      fotos: typeof foto === "string" ? foto : "",
      notas_adicionales: f.notas_adicionales ?? "",
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta ficha técnica?")) return;
    try { await invoke("delete_ficha_tecnica", { id }); if (selectedFicha?.id === id) setSelectedFicha(null); loadFichas(); } catch (e) { alert("Error: " + e); }
  };

  const recetaSeleccionada = recetas.find(r => r.id === Number(selectedFicha?.receta_id ?? 0));

  if (selectedFicha) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelectedFicha(null)} className="text-gray-500 hover:text-gray-700"><ChevronLeft size={24} /></button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800">Ficha Técnica: {selectedFicha.receta_nombre}</h2>
          </div>
          <button onClick={() => handleEdit(selectedFicha)} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm">
            <Pencil size={14} /> Editar
          </button>
          <button onClick={() => {
            exportFichaTecnicaPDF({
              receta_nombre: selectedFicha.receta_nombre ?? "",
              codigo_interno: selectedFicha.codigo_interno,
              catalogado_en: selectedFicha.catalogado_en,
              fecha: selectedFicha.fecha,
              porciones: recetaSeleccionada?.porciones ?? 1,
              instrucciones_consumo: selectedFicha.instrucciones_consumo,
              ingredientes: fichaIngredientes.map(ri => ({ ingrediente_nombre: ri.ingrediente_nombre ?? "", cantidad: ri.cantidad, unidad: ri.unidad })),
              alergenos: fichaAlergenos,
              pasos_preparacion: selectedFicha.pasos_preparacion,
              conservacion: selectedFicha.conservacion,
              vida_util: selectedFicha.vida_util,
              regeneracion: selectedFicha.regeneracion,
              fotos: (() => { try { return JSON.parse(selectedFicha.fotos ?? "null"); } catch { return selectedFicha.fotos; } })(),
            });
          }} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 text-sm">
            <FileText size={14} /> Exportar PDF
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-900 text-white text-center py-3">
            <h3 className="text-lg font-bold tracking-wide">FICHA TÉCNICA DE RECETA</h3>
          </div>

          {/* Código interno + Nombre */}
          <div className="bg-indigo-100 px-4 py-2 border-b">
            <span className="text-sm font-semibold text-indigo-900">CÓDIGO INTERNO: {selectedFicha.codigo_interno || "—"}</span>
          </div>
          <div className="bg-indigo-50 px-4 py-2 border-b">
            <span className="text-sm font-semibold text-indigo-900">NOMBRE DEL PLATO: {selectedFicha.receta_nombre}</span>
          </div>

          {/* Catalogado / Fecha / Raciones / Instrucciones */}
          <div className="grid grid-cols-4 border-b">
            <div className="bg-indigo-200 px-4 py-2 text-center">
              <p className="text-xs font-bold text-indigo-900">CATALOGADO EN</p>
              <p className="text-sm text-indigo-800">{selectedFicha.catalogado_en || "—"}</p>
            </div>
            <div className="bg-indigo-200 px-4 py-2 text-center border-l">
              <p className="text-xs font-bold text-indigo-900">FECHA</p>
              <p className="text-sm text-indigo-800">{selectedFicha.fecha || "—"}</p>
            </div>
            <div className="bg-indigo-200 px-4 py-2 text-center border-l">
              <p className="text-xs font-bold text-indigo-900">Nº RACIONES</p>
              <p className="text-sm text-indigo-800">{recetaSeleccionada?.porciones ?? "—"}</p>
            </div>
            <div className="bg-indigo-50 px-4 py-2 border-l">
              <p className="text-xs font-bold text-indigo-900 mb-1">INSTRUCCIONES DE CONSUMO</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedFicha.instrucciones_consumo || "—"}</p>
            </div>
          </div>

          {/* Ingredientes + Imagen */}
          <div className="grid grid-cols-3 border-b">
            <div className="col-span-2">
              <div className="bg-indigo-200 px-4 py-2">
                <p className="text-xs font-bold text-indigo-900">INGREDIENTES</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Ingrediente</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {fichaIngredientes.map((ri, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="px-4 py-1.5 text-gray-800">{ri.ingrediente_nombre}</td>
                      <td className="px-4 py-1.5 text-gray-600 text-right">{ri.cantidad} {ri.unidad}</td>
                    </tr>
                  ))}
                  {fichaIngredientes.length === 0 && (
                    <tr><td colSpan={2} className="px-4 py-3 text-gray-400 text-center text-sm">Sin ingredientes</td></tr>
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
              {selectedFicha.pasos_preparacion ? (
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{selectedFicha.pasos_preparacion}</div>
              ) : (
                <p className="text-sm text-gray-500">Sin pasos definidos</p>
              )}
            </div>
          </div>

          {/* Conservación */}
          <div className="border-b">
            <div className="bg-indigo-200 px-4 py-2">
              <p className="text-xs font-bold text-indigo-900">CONSERVACIÓN</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-700">{selectedFicha.conservacion || "—"}</p>
            </div>
          </div>

          {/* Vida útil */}
          <div className="border-b">
            <div className="bg-indigo-200 px-4 py-2">
              <p className="text-xs font-bold text-indigo-900">VIDA ÚTIL</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-700">{selectedFicha.vida_util || "—"}</p>
            </div>
          </div>

          {/* Regeneración */}
          <div>
            <div className="bg-indigo-200 px-4 py-2">
              <p className="text-xs font-bold text-indigo-900">REGENERACIÓN</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-700">{selectedFicha.regeneracion || "—"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Fichas Técnicas</h2>
        {!showForm && (
          <button onClick={() => { setEditingId(null); reset(); setShowForm(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={18} /> Nueva Ficha
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{editingId ? "Editar" : "Nueva"} Ficha Técnica</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); reset(); setFotosPreview(""); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Escandallo *</label>
                <select {...register("receta_id")} disabled={!!editingId} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100">
                  <option value="">Seleccionar...</option>
                  {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
                {errors.receta_id && <p className="text-red-500 text-sm mt-1">{errors.receta_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código interno</label>
                <input {...register("codigo_interno")} placeholder="Ej: FT-001" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catalogado en</label>
                <input {...register("catalogado_en")} placeholder="Ej: Carta verano" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <DateInput value={fechaValue} onChange={(iso) => setValue("fecha", iso)} label="Fecha" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones de consumo</label>
                <input {...register("instrucciones_consumo")} placeholder="Ej: Servir caliente, listo para consumir" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Elaboración (pasos)</label>
              <textarea {...register("pasos_preparacion")} rows={6} placeholder="1. Recepción de ingredientes.&#10;2. Conservación en refrigeración (&lt;4 °C).&#10;3. Elaboración de masa.&#10;4. Formado.&#10;5. Sellado.&#10;..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conservación</label>
                <input {...register("conservacion")} placeholder="Ej: Conservar entre 0 y 4 °C" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vida útil</label>
                <input {...register("vida_util")} placeholder="Ej: Consumir antes del..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regeneración</label>
                <input {...register("regeneracion")} placeholder="Ej: Calentar 3 min en microondas" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
              <textarea {...register("notas_adicionales")} rows={2} placeholder="Notas extra..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
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
          fichas.length === 0 ? <div className="p-6 text-center text-gray-500">No hay fichas técnicas</div> : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Código</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Escandallo</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Catalogado en</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fichas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedFicha(f)}>
                    <td className="px-4 py-3 text-sm text-gray-600">{f.codigo_interno || "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{f.receta_nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{f.catalogado_en || "—"}</td>
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
