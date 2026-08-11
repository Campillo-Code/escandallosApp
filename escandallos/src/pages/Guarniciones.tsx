import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, ChevronLeft } from "lucide-react";
import SearchBar from "../components/SearchBar";
import SearchableSelect from "../components/SearchableSelect";

const guarnicionSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().optional(),
  porciones: z.string().min(1, "Mínimo 1 porción"),
  margen_porcentaje: z.string().optional(),
  precio_venta: z.string().optional(),
});
type GuarnicionFormData = z.infer<typeof guarnicionSchema>;

const ingredienteSchema = z.object({
  ingrediente_id: z.string().min(1, "Selecciona un ingrediente"),
  cantidad: z.string().min(1, "La cantidad es obligatoria"),
  unidad: z.string().min(1, "La unidad es obligatoria"),
  merma_porcentaje: z.string().optional(),
});
type IngredienteFormData = z.infer<typeof ingredienteSchema>;

interface Guarnicion { id: number; nombre: string; descripcion: string | null; porciones: number; margen_porcentaje: number; precio_venta: number | null; }
interface Ingrediente { id: number; nombre: string; unidad_base: string; }
interface GuarnicionIngrediente {
  id: number; guarnicion_id: number; ingrediente_id: number;
  ingrediente_nombre: string | null; cantidad: number; unidad: string; merma_porcentaje: number;
}
interface CosteGuarnicion {
  nombre: string; coste_total: number; porciones: number; coste_porcion: number; margen_porcentaje: number; precio_venta: number | null; precio_venta_sugerido: number;
  ingredientes: { ingrediente_nombre: string; cantidad: number; unidad: string; precio_unitario: number | null; precio_por_unidad_receta: number | null; merma_porcentaje: number; coste: number; }[];
}

export default function Guarniciones() {
  const [guarniciones, setGuarniciones] = useState<Guarnicion[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGuarnicion, setSelectedGuarnicion] = useState<Guarnicion | null>(null);
  const [guarnIngredientes, setGuarnIngredientes] = useState<GuarnicionIngrediente[]>([]);
  const [coste, setCoste] = useState<CosteGuarnicion | null>(null);
  const [showIngForm, setShowIngForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GuarnicionFormData>({ resolver: zodResolver(guarnicionSchema) });
  const { register: registerIng, control: controlIng, handleSubmit: handleSubmitIng, reset: resetIng, formState: { errors: errorsIng, isSubmitting: isSubmittingIng } } = useForm<IngredienteFormData>({ resolver: zodResolver(ingredienteSchema) });

  const loadGuarniciones = async () => { try { setGuarniciones(await invoke("get_guarniciones")); } catch (e) { console.error(e); } finally { setLoading(false); } };
  const loadIngredientes = async () => { try { setIngredientes(await invoke("get_ingredientes")); } catch (e) { console.error(e); } };
  const loadGuarnIngred = async (gid: number) => { try { setGuarnIngredientes(await invoke("get_guarnicion_ingredientes", { guarnicionId: gid })); } catch (e) { console.error(e); } };
  const loadCoste = async (gid: number) => { try { setCoste(await invoke("get_guarnicion_coste", { guarnicionId: gid })); } catch (e) { console.error(e); } };

  useEffect(() => { loadGuarniciones(); loadIngredientes(); }, []);
  useEffect(() => { if (selectedGuarnicion) { loadGuarnIngred(selectedGuarnicion.id); loadCoste(selectedGuarnicion.id); } }, [selectedGuarnicion]);

  const onSubmit = async (data: GuarnicionFormData) => {
    try {
      const input = { nombre: data.nombre, descripcion: data.descripcion || null, porciones: data.porciones ? parseInt(data.porciones) : null, margen_porcentaje: data.margen_porcentaje ? parseFloat(data.margen_porcentaje) : null, precio_venta: data.precio_venta ? parseFloat(data.precio_venta) : null };
      if (editingId) await invoke("update_guarnicion", { id: editingId, input });
      else await invoke("create_guarnicion", { input });
      setShowForm(false); setEditingId(null); reset(); loadGuarniciones();
    } catch (e) { alert("Error: " + e); }
  };

  const onSubmitIng = async (data: IngredienteFormData) => {
    if (!selectedGuarnicion) return;
    try {
      await invoke("add_guarnicion_ingrediente", {
        input: { guarnicion_id: selectedGuarnicion.id, ingrediente_id: parseInt(data.ingrediente_id), cantidad: parseFloat(data.cantidad), unidad: data.unidad, merma_porcentaje: parseFloat(data.merma_porcentaje ?? "0") || 0 }
      });
      setShowIngForm(false); resetIng(); loadGuarnIngred(selectedGuarnicion.id); loadCoste(selectedGuarnicion.id);
    } catch (e) { alert("Error: " + e); }
  };

  const handleEdit = (g: Guarnicion) => { setEditingId(g.id); reset({ nombre: g.nombre, descripcion: g.descripcion ?? "", porciones: String(g.porciones ?? 1), margen_porcentaje: String(g.margen_porcentaje ?? 30), precio_venta: g.precio_venta != null ? String(g.precio_venta) : "" }); setShowForm(true); };
  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar guarnición?")) return;
    try { await invoke("delete_guarnicion", { id }); if (selectedGuarnicion?.id === id) { setSelectedGuarnicion(null); setGuarnIngredientes([]); setCoste(null); } loadGuarniciones(); } catch (e) { alert("Error: " + e); }
  };
  const handleDeleteIng = async (id: number) => {
    if (!confirm("¿Eliminar ingrediente?")) return;
    try { await invoke("delete_guarnicion_ingrediente", { id }); if (selectedGuarnicion) { loadGuarnIngred(selectedGuarnicion.id); loadCoste(selectedGuarnicion.id); } } catch (e) { alert("Error: " + e); }
  };

  if (selectedGuarnicion) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setSelectedGuarnicion(null); setGuarnIngredientes([]); setCoste(null); }} className="text-gray-500 hover:text-gray-700"><ChevronLeft size={24} /></button>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{selectedGuarnicion.nombre}</h2>
            {selectedGuarnicion.descripcion && <p className="text-sm text-gray-500">{selectedGuarnicion.descripcion}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Ingredientes</h3>
          {!showIngForm && (
            <button onClick={() => { resetIng(); setShowIngForm(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={18} /> Añadir
            </button>
          )}
        </div>

        {showIngForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Añadir Ingrediente</h3>
              <button onClick={() => setShowIngForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitIng(onSubmitIng)} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingrediente *</label>
                <Controller
                  control={controlIng}
                  name="ingrediente_id"
                  rules={{ required: "Selecciona un ingrediente" }}
                  render={({ field }) => (
                    <SearchableSelect
                      options={ingredientes.map(i => ({ value: i.id, label: `${i.nombre} (${i.unidad_base})` }))}
                      value={field.value ? Number(field.value) : 0}
                      onChange={(val) => field.onChange(val)}
                      placeholder="Seleccionar..."
                    />
                  )}
                />
                {errorsIng.ingrediente_id && <p className="text-red-500 text-sm mt-1">{errorsIng.ingrediente_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
                <input type="number" step="0.001" min="0" {...registerIng("cantidad")} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                {errorsIng.cantidad && <p className="text-red-500 text-sm mt-1">{errorsIng.cantidad.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad *</label>
                <select {...registerIng("unidad")} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="kg">kg</option><option value="g">g</option><option value="l">l</option><option value="ml">ml</option><option value="ud">ud</option>
                </select>
              </div>
              <div className="md:col-span-4 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowIngForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={isSubmittingIng} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{isSubmittingIng ? "Añadiendo..." : "Añadir"}</button>
              </div>
            </form>
          </div>
        )}

        {guarnIngredientes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No hay ingredientes</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ingrediente</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cantidad</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unidad</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Merma</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {guarnIngredientes.map(gi => (
                  <tr key={gi.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{gi.ingrediente_nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{gi.cantidad}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{gi.unidad}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{gi.merma_porcentaje}%</td>
                    <td className="px-4 py-3 text-sm text-right"><button onClick={() => handleDeleteIng(gi.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {coste && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-semibold">Escandallo — Coste total: {coste.coste_total.toFixed(2)} € ({coste.porciones} porciones)</h3>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-gray-600">Coste/porción: <span className="font-medium">{coste.coste_porcion.toFixed(2)} €</span></span>
                <span className="text-gray-600">Margen: <span className="font-medium">{coste.margen_porcentaje.toFixed(1)}%</span></span>
                {coste.precio_venta != null && (
                  <span className="text-gray-600">Precio venta: <span className="font-medium">{coste.precio_venta.toFixed(2)} €</span></span>
                )}
                <span className="text-blue-600 font-medium">Precio sugerido: {coste.precio_venta_sugerido.toFixed(2)} €</span>
              </div>
            </div>
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
                {coste.ingredientes.map((ci, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{ci.ingrediente_nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{ci.cantidad}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ci.unidad}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{ci.precio_por_unidad_receta?.toFixed(2) ?? "-"} €</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{ci.merma_porcentaje}%</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 text-right">{ci.coste.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-right">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-right">{coste.coste_total.toFixed(2)} €</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Guarniciones</h2>
        {!showForm && (
          <button onClick={() => { setEditingId(null); reset(); setShowForm(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={18} /> Nueva Guarnición
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{editingId ? "Editar" : "Nueva"} Guarnición</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); reset(); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input {...register("nombre")} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input {...register("descripcion")} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porciones *</label>
              <input type="number" min="1" {...register("porciones")} placeholder="10" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              {errors.porciones && <p className="text-red-500 text-sm mt-1">{errors.porciones.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Margen %</label>
              <input type="number" step="0.01" min="0" max="99" {...register("margen_porcentaje")} placeholder="30" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio venta (€)</label>
              <input type="number" step="0.01" min="0" {...register("precio_venta")} placeholder="Opcional" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); reset(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{isSubmitting ? "Guardando..." : editingId ? "Actualizar" : "Crear"}</button>
            </div>
          </form>
        </div>
      )}

      <>
        <div className="p-4 pb-2">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Buscar guarnición..." />
        </div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? <div className="p-6 text-center text-gray-500">Cargando...</div> :
            guarniciones.length === 0 ? <div className="p-6 text-center text-gray-500">No hay guarniciones</div> : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Descripción</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {guarniciones.filter(g => g.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(g => (
                    <tr key={g.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedGuarnicion(g)}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{g.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{g.descripcion ?? "-"}</td>
                      <td className="px-4 py-3 text-sm text-right" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleEdit(g)} className="text-blue-600 hover:text-blue-800 mr-3"><Pencil size={16} /></button>
                        <button onClick={() => handleDelete(g.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </>
    </div>
  );
}
