import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, ChevronLeft, FileText } from "lucide-react";
import { exportFichaTecnicaPDF } from "../lib/exports";
import { getAlergenoLabel, getAlergenoColor } from "../lib/alergenos";

const schema = z.object({
  receta_id: z.string().min(1, "Selecciona un escandallo"),
  pasos_preparacion: z.string().optional(),
  fotos: z.string().optional(),
  notas_adicionales: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface FichaTecnica {
  id: number;
  receta_id: number;
  receta_nombre: string | null;
  pasos_preparacion: string | null;
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

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const loadFichas = async () => { try { setFichas(await invoke("get_fichas_tecnicas")); } catch (e) { console.error(e); } finally { setLoading(false); } };
  const loadRecetas = async () => { try { setRecetas(await invoke("get_recetas")); } catch (e) { console.error(e); } };

  useEffect(() => { loadFichas(); loadRecetas(); }, []);

  useEffect(() => {
    if (selectedFicha) {
      invoke<RecetaIngrediente[]>("get_receta_ingredientes", { recetaId: selectedFicha.receta_id }).then(setFichaIngredientes).catch(console.error);
      invoke<string[]>("get_receta_alergenos", { recetaId: selectedFicha.receta_id }).then(setFichaAlergenos).catch(console.error);
    }
  }, [selectedFicha]);

  const onSubmit = async (data: FormData) => {
    try {
      const input = {
        receta_id: parseInt(data.receta_id),
        pasos_preparacion: data.pasos_preparacion || null,
        fotos: data.fotos || null,
        notas_adicionales: data.notas_adicionales || null,
      };
      if (editingId) await invoke("update_ficha_tecnica", { id: editingId, input });
      else await invoke("create_ficha_tecnica", { input });
      setShowForm(false); setEditingId(null); reset(); loadFichas();
    } catch (e) { alert("Error: " + e); }
  };

  const handleEdit = (f: FichaTecnica) => {
    setEditingId(f.id); setShowForm(true);
    reset({
      receta_id: String(f.receta_id),
      pasos_preparacion: f.pasos_preparacion ?? "",
      fotos: f.fotos ?? "",
      notas_adicionales: f.notas_adicionales ?? "",
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta ficha técnica?")) return;
    try { await invoke("delete_ficha_tecnica", { id }); if (selectedFicha?.id === id) setSelectedFicha(null); loadFichas(); } catch (e) { alert("Error: " + e); }
  };

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
            const receta = recetas.find(r => r.id === selectedFicha.receta_id);
            exportFichaTecnicaPDF({
              receta_nombre: selectedFicha.receta_nombre ?? "",
              descripcion: receta?.descripcion ?? null,
              categoria: receta?.categoria ?? null,
              porciones: receta?.porciones ?? 1,
              tiempo_preparacion: receta?.tiempo_preparacion ?? null,
              ingredientes: fichaIngredientes.map(ri => ({ ingrediente_nombre: ri.ingrediente_nombre ?? "", cantidad: ri.cantidad, unidad: ri.unidad })),
              alergenos: fichaAlergenos,
              pasos_preparacion: selectedFicha.pasos_preparacion,
              fotos: (() => { try { return JSON.parse(selectedFicha.fotos ?? "[]"); } catch { return []; } })(),
              notas_adicionales: selectedFicha.notas_adicionales,
            });
          }} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 text-sm">
            <FileText size={14} /> Exportar PDF
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {fichaAlergenos.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Alérgenos</h3>
              <div className="flex flex-wrap gap-2">
                {fichaAlergenos.map(a => (
                  <span key={a} className={`px-3 py-1 rounded-full text-sm font-medium ${getAlergenoColor(a)}`}>{getAlergenoLabel(a)}</span>
                ))}
              </div>
            </div>
          )}

          {fichaIngredientes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Ingredientes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left pb-2 font-medium text-gray-600">Ingrediente</th><th className="text-right pb-2 font-medium text-gray-600">Cantidad</th></tr></thead>
                  <tbody>
                    {fichaIngredientes.map((ri, i) => (
                      <tr key={i} className="border-t border-gray-200"><td className="py-1.5 text-gray-800">{ri.ingrediente_nombre}</td><td className="py-1.5 text-gray-600 text-right">{ri.cantidad} {ri.unidad}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {selectedFicha.pasos_preparacion && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Pasos de preparación</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{selectedFicha.pasos_preparacion}</div>
            </div>
          )}

          {selectedFicha.fotos && (() => {
            try {
              const fotos = JSON.parse(selectedFicha.fotos);
              if (Array.isArray(fotos) && fotos.length > 0) {
                return (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Fotos</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {fotos.map((url: string, i: number) => (
                        <img key={i} src={url} alt={`Foto ${i + 1}`} className="w-full h-32 object-cover rounded-lg border" />
                      ))}
                    </div>
                  </div>
                );
              }
            } catch { return null; }
          })()}

          {selectedFicha.notas_adicionales && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Notas</h3>
              <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">{selectedFicha.notas_adicionales}</p>
            </div>
          )}

          {!selectedFicha.pasos_preparacion && !selectedFicha.fotos && !selectedFicha.notas_adicionales && (
            <p className="text-gray-500 text-center">Esta ficha técnica no tiene contenido. Edítala para añadir pasos, fotos o notas.</p>
          )}
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
            <button onClick={() => { setShowForm(false); setEditingId(null); reset(); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Escandallo *</label>
              <select {...register("receta_id")} disabled={!!editingId} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100">
                <option value="">Seleccionar...</option>
                {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              {errors.receta_id && <p className="text-red-500 text-sm mt-1">{errors.receta_id.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pasos de preparación</label>
              <textarea {...register("pasos_preparacion")} rows={8} placeholder="1. Preparar los ingredientes...&#10;2. Cocinar a fuego medio..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fotos (URLs, una por línea)</label>
              <textarea {...register("fotos")} rows={3} placeholder="https://ejemplo.com/foto1.jpg&#10;https://ejemplo.com/foto2.jpg" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
              <textarea {...register("notas_adicionales")} rows={3} placeholder="Presentación, conservación, maridaje..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); reset(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Escandallo</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Pasos</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fotos</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Notas</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fichas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedFicha(f)}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{f.receta_nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{f.pasos_preparacion ? "✓" : "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{f.fotos ? "✓" : "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{f.notas_adicionales ? "✓" : "-"}</td>
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
