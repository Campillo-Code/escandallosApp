import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, ChevronLeft, CheckCircle, FileText } from "lucide-react";
import { exportAlbaranPDF } from "../lib/exports";
import DateInput from "../components/DateInput";

const albaranSchema = z.object({
  proveedor_id: z.string().min(1, "Selecciona un proveedor"),
  numero_albaran: z.string().optional(),
  fecha_recepcion: z.string().min(1, "La fecha es obligatoria"),
  total: z.string().optional(),
  notas: z.string().optional(),
});

type AlbaranFormData = z.infer<typeof albaranSchema>;

interface Albaran {
  id: number;
  proveedor_id: number;
  proveedor_nombre: string | null;
  numero_albaran: string | null;
  fecha_recepcion: string;
  total: number | null;
  notas: string | null;
  procesado: boolean;
}

interface AlbaranDetalle {
  id: number;
  albaran_id: number;
  ingrediente_id: number;
  ingrediente_nombre: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  subtotal: number | null;
  precio_anterior: number | null;
}

interface Proveedor {
  id: number;
  nombre: string;
}

interface Ingrediente {
  id: number;
  nombre: string;
  unidad_base: string;
}

const detalleSchema = z.object({
  ingrediente_id: z.string().min(1, "Selecciona un ingrediente"),
  cantidad: z.string().min(1, "La cantidad es obligatoria"),
  coste_total: z.string().min(1, "El coste total es obligatorio"),
});

type DetalleFormData = z.infer<typeof detalleSchema>;

export default function Albaranes() {
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAlbaran, setSelectedAlbaran] = useState<Albaran | null>(null);
  const [detalles, setDetalles] = useState<AlbaranDetalle[]>([]);
  const [showDetalleForm, setShowDetalleForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AlbaranFormData>({
    resolver: zodResolver(albaranSchema),
    defaultValues: { fecha_recepcion: new Date().toISOString().split("T")[0] },
  });

  const fechaRecepcion = watch("fecha_recepcion");

  const {
    register: registerDetalle,
    handleSubmit: handleSubmitDetalle,
    reset: resetDetalle,
    formState: { errors: errorsDetalle, isSubmitting: isSubmittingDetalle },
  } = useForm<DetalleFormData>({
    resolver: zodResolver(detalleSchema),
  });

  const loadAlbaranes = async () => {
    try {
      const data = await invoke<Albaran[]>("get_albaranes");
      setAlbaranes(data);
    } catch (e) {
      console.error("Error loading albaranes:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadProveedores = async () => {
    try {
      const data = await invoke<Proveedor[]>("get_proveedores");
      setProveedores(data);
    } catch (e) {
      console.error("Error loading proveedores:", e);
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

  const loadDetalles = async (albaranId: number) => {
    try {
      const data = await invoke<AlbaranDetalle[]>("get_albaran_detalles", { albaranId: albaranId });
      setDetalles(data);
    } catch (e) {
      console.error("Error loading detalles:", e);
    }
  };

  useEffect(() => {
    loadAlbaranes();
    loadProveedores();
    loadIngredientes();
  }, []);

  useEffect(() => {
    if (selectedAlbaran) {
      loadDetalles(selectedAlbaran.id);
    }
  }, [selectedAlbaran]);

  const onSubmitAlbaran = async (data: AlbaranFormData) => {
    try {
      const input = {
        proveedor_id: parseInt(data.proveedor_id),
        numero_albaran: data.numero_albaran || null,
        fecha_recepcion: data.fecha_recepcion,
        total: data.total ? parseFloat(data.total) : null,
        notas: data.notas || null,
        activo: true,
      };
      if (editingId) {
        await invoke("update_albaran", { id: editingId, input });
      } else {
        await invoke("create_albaran", { input });
      }
      setShowForm(false);
      setEditingId(null);
      reset();
      loadAlbaranes();
    } catch (e) {
      alert("Error al guardar: " + e);
    }
  };

  const onSubmitDetalle = async (data: DetalleFormData) => {
    if (!selectedAlbaran) return;
    try {
      const ingrediente = ingredientes.find((i) => i.id === parseInt(data.ingrediente_id));
      const cantidad = parseFloat(data.cantidad);
      const costeTotal = parseFloat(data.coste_total);
      const precioUnitario = cantidad > 0 ? costeTotal / cantidad : 0;

      await invoke("add_albaran_detalle", {
        input: {
          albaran_id: selectedAlbaran.id,
          ingrediente_id: parseInt(data.ingrediente_id),
          cantidad,
          unidad: ingrediente?.unidad_base ?? "ud",
          precio_unitario: precioUnitario,
          subtotal: costeTotal,
        },
      });
      setShowDetalleForm(false);
      resetDetalle();
      loadDetalles(selectedAlbaran.id);
    } catch (e) {
      alert("Error al añadir línea: " + e);
    }
  };

  const handleEdit = (a: Albaran) => {
    setEditingId(a.id);
    reset({
      proveedor_id: a.proveedor_id.toString(),
      numero_albaran: a.numero_albaran ?? "",
      fecha_recepcion: a.fecha_recepcion,
      total: a.total?.toString() ?? "",
      notas: a.notas ?? "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este albarán y todos sus detalles?")) return;
    try {
      await invoke("delete_albaran", { id });
      if (selectedAlbaran?.id === id) {
        setSelectedAlbaran(null);
        setDetalles([]);
      }
      loadAlbaranes();
    } catch (e) {
      console.error("Error deleting albaran:", e);
    }
  };

  const handleDeleteDetalle = async (id: number) => {
    if (!confirm("¿Eliminar esta línea de detalle?")) return;
    try {
      await invoke("delete_albaran_detalle", { id });
      if (selectedAlbaran) {
        loadDetalles(selectedAlbaran.id);
      }
    } catch (e) {
      console.error("Error deleting detalle:", e);
    }
  };

  const handleProcesar = async (id: number) => {
    try {
      await invoke("procesar_albaran", { albaranId: id });
      setSelectedAlbaran(null);
      setDetalles([]);
      loadAlbaranes();
    } catch (e) {
      alert("Error al procesar: " + e);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    reset();
  };

  if (selectedAlbaran) {
    const totalDetalle = detalles.reduce((sum, d) => sum + (d.subtotal ?? 0), 0);

    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              setSelectedAlbaran(null);
              setDetalles([]);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800">
              {selectedAlbaran.numero_albaran || `Albarán #${selectedAlbaran.id}`}
            </h2>
            <p className="text-sm text-gray-500">
              {selectedAlbaran.proveedor_nombre} · {selectedAlbaran.fecha_recepcion}
            </p>
          </div>
          <button
            onClick={() => exportAlbaranPDF(selectedAlbaran, detalles)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText size={18} />
            PDF
          </button>
          {!selectedAlbaran.procesado && (
            <button
              onClick={() => handleProcesar(selectedAlbaran.id)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle size={18} />
              Procesar
            </button>
          )}
        </div>

        {selectedAlbaran.notas && (
          <p className="text-gray-600 mb-4">{selectedAlbaran.notas}</p>
        )}

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Detalle del albarán</h3>
          {!showDetalleForm && !selectedAlbaran.procesado && (
            <button
              onClick={() => {
                resetDetalle();
                setShowDetalleForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Añadir Línea
            </button>
          )}
        </div>

        {showDetalleForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Añadir Línea</h3>
              <button onClick={() => setShowDetalleForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitDetalle(onSubmitDetalle)} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingrediente *</label>
                <select
                  {...registerDetalle("ingrediente_id")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar...</option>
                  {ingredientes.map((i) => (
                    <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_base})</option>
                  ))}
                </select>
                {errorsDetalle.ingrediente_id && <p className="text-red-500 text-sm mt-1">{errorsDetalle.ingrediente_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  {...registerDetalle("cantidad")}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errorsDetalle.cantidad && <p className="text-red-500 text-sm mt-1">{errorsDetalle.cantidad.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coste total (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...registerDetalle("coste_total")}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Lo que pagaste por la cantidad indicada
                </p>
                {errorsDetalle.coste_total && <p className="text-red-500 text-sm mt-1">{errorsDetalle.coste_total.message}</p>}
              </div>
              <div className="md:col-span-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDetalleForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDetalle}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmittingDetalle ? "Añadiendo..." : "Añadir"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {detalles.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No hay líneas de detalle</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ingrediente</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cantidad</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Precio/kg o /l</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Subtotal</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {detalles.map((d) => {
                  let precioBase = d.precio_unitario;
                  let unidadBase = d.unidad;
                  if (d.unidad === "g") {
                    precioBase = d.precio_unitario * 1000;
                    unidadBase = "kg";
                  } else if (d.unidad === "ml") {
                    precioBase = d.precio_unitario * 1000;
                    unidadBase = "l";
                  }
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{d.ingrediente_nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{d.cantidad} {d.unidad}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{precioBase.toFixed(2)} €/{unidadBase}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 text-right">{(d.subtotal ?? 0).toFixed(2)} €</td>
                      <td className="px-4 py-3 text-sm text-right" onClick={(e) => e.stopPropagation()}>
                        {!selectedAlbaran.procesado && (
                          <button
                            onClick={() => handleDeleteDetalle(d.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-800">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-800 text-right">{totalDetalle.toFixed(2)} €</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Albaranes</h2>
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
            Nuevo Albarán
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingId ? "Editar Albarán" : "Nuevo Albarán"}
            </h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmitAlbaran)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
              <select
                {...register("proveedor_id")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {errors.proveedor_id && <p className="text-red-500 text-sm mt-1">{errors.proveedor_id.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº Albarán</label>
              <input
                {...register("numero_albaran")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <DateInput
                value={fechaRecepcion}
                onChange={(val) => setValue("fecha_recepcion", val)}
                label="Fecha Recepción *"
              />
              {errors.fecha_recepcion && <p className="text-red-500 text-sm mt-1">{errors.fecha_recepcion.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register("total")}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                {...register("notas")}
                rows={3}
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
        ) : albaranes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No hay albaranes registrados</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nº Albarán</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Proveedor</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {albaranes.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedAlbaran(a)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {a.numero_albaran || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{a.proveedor_nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{a.fecha_recepcion}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {a.total != null ? `${a.total.toFixed(2)} €` : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {a.procesado ? (
                      <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle size={14} /> Procesado
                      </span>
                    ) : (
                      <span className="text-gray-500">Pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleEdit(a)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
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
