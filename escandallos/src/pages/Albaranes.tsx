import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, ChevronLeft, CheckCircle, FileText, FileUp, Loader2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { exportAlbaranPDF } from "../lib/exports";
import SearchBar from "../components/SearchBar";
import SearchableSelect from "../components/SearchableSelect";
import DateInput from "../components/DateInput";
import {
  parsearDocumento,
  mejorCoincidencia,
  calcularCantidadReal,
  type ItemCatalogo,
  type CabeceraDocumento,
} from "../lib/albaranParser";

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
  ingrediente_id: z.number({ error: "Selecciona un artículo" }).min(1, "Selecciona un artículo"),
  cantidad: z.string().min(1, "La cantidad es obligatoria"),
  coste_total: z.string().min(1, "El coste total es obligatorio"),
});

type DetalleFormData = z.infer<typeof detalleSchema>;

interface FilaRevision {
  uid: number;
  descripcion: string;
  cantidad: string;
  unidad_linea: string | null;
  precio: string;
  item_id: number;
  incluida: boolean;
  contenido: number | null;
  unidad_contenido: string | null;
  cantidad_real: string;
  iva_pct: number | null;
  importe_con_iva: boolean;
  precio_con_iva: boolean;
}

export default function Albaranes() {
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [envases, setEnvases] = useState<Ingrediente[]>([]);
  const [bebidas, setBebidas] = useState<Ingrediente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAlbaran, setSelectedAlbaran] = useState<Albaran | null>(null);
  const [detalles, setDetalles] = useState<AlbaranDetalle[]>([]);
  const [showDetalleForm, setShowDetalleForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "pendiente" | "procesado">("todos");
  const [tipoDetalle, setTipoDetalle] = useState<"ingrediente" | "envase" | "bebida">("ingrediente");
  const [lineasTemp, setLineasTemp] = useState<{ ingrediente_id: number; nombre: string; unidad: string; cantidad: number; coste_total: number }[]>([]);
  const [showAddLinea, setShowAddLinea] = useState(false);
  const [lineaForm, setLineaForm] = useState({ ingrediente_id: 0, cantidad: "", coste_total: "" });
  const [revision, setRevision] = useState<FilaRevision[] | null>(null);
  const [cabeceraDoc, setCabeceraDoc] = useState<CabeceraDocumento | null>(null);
  const [cargandoDoc, setCargandoDoc] = useState(false);
  const [destinoDoc, setDestinoDoc] = useState<"form" | "albaran">("form");

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
    control: controlDetalle,
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
      const [ings, envs, bebs] = await Promise.all([
        invoke<Ingrediente[]>("get_ingredientes", { tipo: "ingrediente" }),
        invoke<Ingrediente[]>("get_ingredientes", { tipo: "envase" }),
        invoke<Ingrediente[]>("get_ingredientes", { tipo: "bebida" }),
      ]);
      setIngredientes(ings);
      setEnvases(envs);
      setBebidas(bebs);
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
      let albaranId: number;
      if (editingId) {
        await invoke("update_albaran", { id: editingId, input });
        albaranId = editingId;
      } else {
        albaranId = await invoke<number>("create_albaran", { input });
      }
      // Guardar líneas temporales
      for (const linea of lineasTemp) {
        const precioUnitario = linea.cantidad > 0 ? linea.coste_total / linea.cantidad : 0;
        await invoke("add_albaran_detalle", {
          input: {
            albaran_id: albaranId,
            ingrediente_id: linea.ingrediente_id,
            cantidad: linea.cantidad,
            unidad: linea.unidad,
            precio_unitario: precioUnitario,
            subtotal: linea.coste_total,
          },
        });
      }
      setShowForm(false);
      setEditingId(null);
      setLineasTemp([]);
      reset();
      loadAlbaranes();
    } catch (e) {
      alert("Error al guardar: " + e);
    }
  };

  const addLineaTemporal = () => {
    const ing = tipoDetalle === "ingrediente" ? ingredientes.find(i => i.id === lineaForm.ingrediente_id) :
                tipoDetalle === "envase" ? envases.find(i => i.id === lineaForm.ingrediente_id) :
                bebidas.find(i => i.id === lineaForm.ingrediente_id);
    if (!ing || !lineaForm.cantidad || !lineaForm.coste_total) return;
    setLineasTemp(prev => [...prev, {
      ingrediente_id: lineaForm.ingrediente_id,
      nombre: ing.nombre,
      unidad: ing.unidad_base,
      cantidad: parseFloat(lineaForm.cantidad),
      coste_total: parseFloat(lineaForm.coste_total),
    }]);
    setLineaForm({ ingrediente_id: 0, cantidad: "", coste_total: "" });
    setShowAddLinea(false);
  };

  const removeLineaTemporal = (index: number) => {
    setLineasTemp(prev => prev.filter((_, i) => i !== index));
  };

  const todosItems: ItemCatalogo[] = [
    ...ingredientes.map((i) => ({ ...i, tipo: "ingrediente" as const })),
    ...envases.map((i) => ({ ...i, tipo: "envase" as const })),
    ...bebidas.map((i) => ({ ...i, tipo: "bebida" as const })),
  ];

  const subirDocumento = async (destino: "form" | "albaran") => {
    try {
      const seleccion = await open({
        multiple: true,
        filters: [{ name: "Documentos de albarán", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "pdf"] }],
      });
      if (!seleccion) return;
      const rutas = (Array.isArray(seleccion) ? seleccion : [seleccion]).filter(
        (r): r is string => typeof r === "string"
      );
      if (rutas.length === 0) return;

      setCargandoDoc(true);

      let cabecera: CabeceraDocumento | null = null;
      const filas: FilaRevision[] = [];
      const errores: string[] = [];

      for (const ruta of rutas) {
        try {
          const texto = await invoke<string>("leer_documento_albaran", { path: ruta });
          const res = parsearDocumento(texto, todosItems);
          if (!cabecera && (res.cabecera.numero || res.cabecera.fecha || res.cabecera.proveedor_texto)) {
            cabecera = res.cabecera;
          } else if (cabecera) {
            // Completar datos que falten (los totales suelen estar solo en la última página)
            if (!cabecera.numero && res.cabecera.numero) cabecera.numero = res.cabecera.numero;
            if (!cabecera.fecha && res.cabecera.fecha) cabecera.fecha = res.cabecera.fecha;
            if (!cabecera.proveedor_texto && res.cabecera.proveedor_texto) {
              cabecera.proveedor_texto = res.cabecera.proveedor_texto;
            }
            if (cabecera.total_base == null && res.cabecera.total_base != null) {
              cabecera.total_base = res.cabecera.total_base;
            }
            if (cabecera.total_con_iva == null && res.cabecera.total_con_iva != null) {
              cabecera.total_con_iva = res.cabecera.total_con_iva;
            }
          }
          for (const l of res.lineas) {
            const uds = l.cantidad ?? 0;
            const item = l.item_id ? todosItems.find((i) => i.id === l.item_id) : undefined;
            filas.push({
              uid: filas.length,
              descripcion: l.descripcion,
              cantidad: l.cantidad != null ? String(l.cantidad) : "",
              unidad_linea: l.unidad_linea,
              precio: l.precio_unitario != null ? String(l.precio_unitario) : "",
              item_id: l.item_id ?? 0,
              incluida: true,
              contenido: l.contenido,
              unidad_contenido: l.unidad_contenido,
              cantidad_real:
                item && uds > 0
                  ? String(calcularCantidadReal(uds, l.contenido, l.unidad_contenido, l.unidad_linea, item.unidad_base) ?? uds)
                  : "",
              iva_pct: l.iva_pct,
              importe_con_iva: l.importe_con_iva,
              precio_con_iva: false,
            });
          }
        } catch (e) {
          errores.push(`${ruta.split(/[\\/]/).pop()}: ${e}`);
        }
      }

      // Reconciliación de IVA con los totales del pie del documento:
      // si la suma de los importes impreso coincide con el TOTAL (con IVA)
      // pero no con la Base, los precios unitarios ya llevan IVA incluido
      if (cabecera?.total_base != null && cabecera.total_con_iva != null) {
        const suma = filas.reduce(
          (s, f) => s + (parseFloat(f.cantidad) || 0) * (parseFloat(f.precio) || 0),
          0
        );
        const conIva = cabecera.total_con_iva;
        const base = cabecera.total_base;
        const coincideCon = Math.abs(suma - conIva) <= Math.max(0.05, conIva * 0.01);
        const coincideBase = Math.abs(suma - base) <= Math.max(0.05, base * 0.01);
        if (coincideCon && !coincideBase) {
          const ivaGlobal = Math.round((conIva / base - 1) * 1000) / 10;
          for (const f of filas) {
            f.precio_con_iva = true;
            if (f.iva_pct == null) f.iva_pct = ivaGlobal;
          }
        }
      }

      if (filas.length === 0) {
        alert(
          errores.length > 0
            ? `No se pudo leer ningún documento:\n${errores.join("\n")}`
            : "No se han detectado líneas de producto (¿PDF escaneado? Hazle una foto y súbela como imagen)."
        );
        return;
      }
      if (errores.length > 0) {
        alert(`Estos documentos no se pudieron leer:\n${errores.join("\n")}`);
      }

      setRevision(filas);
      setCabeceraDoc(cabecera);
      setDestinoDoc(destino);
    } catch (e) {
      alert("Error al seleccionar los documentos: " + e);
    } finally {
      setCargandoDoc(false);
    }
  };

  const insertarRevision = async () => {
    if (!revision) return;
    const validas = revision.filter((f) => f.incluida);
    if (validas.some((f) => !f.item_id)) {
      alert("Selecciona el artículo en todas las líneas marcadas.");
      return;
    }
    if (validas.some((f) => !(parseFloat(f.cantidad) > 0) || !(parseFloat(f.cantidad_real || "0") > 0))) {
      alert("Introduce la cantidad en todas las líneas marcadas.");
      return;
    }

    const preparar = (f: FilaRevision) => {
      const item = todosItems.find((i) => i.id === f.item_id)!;
      const uds = parseFloat(f.cantidad) || 0;
      const precio = parseFloat(f.precio) || 0;
      // Cantidad real en la unidad del artículo (uds × presentación)
      const cantBase = parseFloat(f.cantidad_real) || uds;
      // Coste sin IVA: si los precios unitarios del documento ya lo incluían,
      // se divide por el tipo detectado (reconciliado con Base/TOTAL del pie)
      let total = uds * precio;
      if (f.precio_con_iva && f.iva_pct != null && f.iva_pct > 0) {
        total = total / (1 + f.iva_pct / 100);
      }
      total = Math.round(total * 10000) / 10000;
      return { item, uds, cantBase, total };
    };

    if (destinoDoc === "form") {
      // Cabecera detectada (solo albarán nuevo)
      if (!editingId && cabeceraDoc) {
        if (cabeceraDoc.numero && !watch("numero_albaran")) setValue("numero_albaran", cabeceraDoc.numero);
        if (cabeceraDoc.fecha) setValue("fecha_recepcion", cabeceraDoc.fecha);
        if (!watch("total")) {
          const totalDoc = cabeceraDoc.total_con_iva ?? cabeceraDoc.total_base;
          if (totalDoc != null) setValue("total", totalDoc.toFixed(2));
        }
        if (cabeceraDoc.proveedor_texto) {
          const m = mejorCoincidencia(
            cabeceraDoc.proveedor_texto,
            proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))
          );
          if (m) setValue("proveedor_id", String(m.id));
        }
      }
      setLineasTemp((prev) => [
        ...prev,
        ...validas.map((f) => {
          const p = preparar(f);
          return {
            ingrediente_id: p.item.id,
            nombre: p.item.nombre,
            unidad: p.item.unidad_base,
            cantidad: p.cantBase,
            coste_total: p.total,
          };
        }),
      ]);
      setRevision(null);
      return;
    }

    if (!selectedAlbaran) return;
    try {
      for (const f of validas) {
        const p = preparar(f);
        await invoke("add_albaran_detalle", {
          input: {
            albaran_id: selectedAlbaran.id,
            ingrediente_id: p.item.id,
            cantidad: p.cantBase,
            unidad: p.item.unidad_base,
            precio_unitario: p.cantBase > 0 ? p.total / p.cantBase : 0,
            subtotal: p.total,
          },
        });
      }
      await loadDetalles(selectedAlbaran.id);
      setRevision(null);
    } catch (e) {
      alert("Error al insertar las líneas: " + e);
    }
  };

  const onSubmitDetalle = async (data: DetalleFormData) => {
    if (!selectedAlbaran) return;
    try {
      const todos = [...ingredientes, ...envases, ...bebidas];
      const ingrediente = todos.find((i) => i.id === data.ingrediente_id);
      const cantidad = parseFloat(data.cantidad);
      const costeTotal = parseFloat(data.coste_total);
      const precioUnitario = cantidad > 0 ? costeTotal / cantidad : 0;

      await invoke("add_albaran_detalle", {
        input: {
          albaran_id: selectedAlbaran.id,
          ingrediente_id: data.ingrediente_id,
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
          <div className="flex items-center gap-2">
            {!selectedAlbaran.procesado && (
              <button
                onClick={() => subirDocumento("albaran")}
                disabled={cargandoDoc}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {cargandoDoc ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                {cargandoDoc ? "Leyendo..." : "Subir fotos/PDF"}
              </button>
            )}
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
        </div>

        {showDetalleForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Añadir Línea</h3>
              <button onClick={() => setShowDetalleForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <button type="button" onClick={() => setTipoDetalle("ingrediente")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tipoDetalle === "ingrediente" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                🥕 Ingrediente
              </button>
              <button type="button" onClick={() => setTipoDetalle("envase")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tipoDetalle === "envase" ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                📦 Envase
              </button>
              <button type="button" onClick={() => setTipoDetalle("bebida")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tipoDetalle === "bebida" ? "bg-cyan-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                🥤 Bebida
              </button>
            </div>
            <form onSubmit={handleSubmitDetalle(onSubmitDetalle)} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tipoDetalle === "ingrediente" ? "Ingrediente *" : tipoDetalle === "envase" ? "Envase *" : "Bebida *"}
                </label>
                <Controller
                  control={controlDetalle}
                  name="ingrediente_id"
                  rules={{ required: "Selecciona un artículo" }}
                  render={({ field }) => (
                    <SearchableSelect
                      options={
                        tipoDetalle === "ingrediente" ? ingredientes.map(i => ({ value: i.id, label: `${i.nombre} (${i.unidad_base})` })) :
                        tipoDetalle === "envase" ? envases.map(i => ({ value: i.id, label: `${i.nombre} (${i.unidad_base})` })) :
                        bebidas.map(i => ({ value: i.id, label: `${i.nombre} (${i.unidad_base})` }))
                      }
                      value={field.value ? Number(field.value) : 0}
                      onChange={(val) => field.onChange(val)}
                      placeholder="Seleccionar..."
                    />
                  )}
                />
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
        {revision && (
          <ModalRevision
            filas={revision}
            onChange={(next) => setRevision(next)}
            items={todosItems}
            onInsertar={insertarRevision}
            onCancelar={() => setRevision(null)}
          />
        )}
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

            {/* Líneas del albarán */}
            <div className="md:col-span-2 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">Líneas del albarán</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => subirDocumento("form")}
                    disabled={cargandoDoc}
                    className="flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
                  >
                    {cargandoDoc ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                    {cargandoDoc ? "Leyendo..." : "Subir fotos/PDF"}
                  </button>
                  <button type="button" onClick={() => setShowAddLinea(true)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                    <Plus size={16} /> Añadir línea
                  </button>
                </div>
              </div>

              {showAddLinea && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="flex gap-2 mb-2">
                    {[{ k: "ingrediente", l: "🥕 Ingrediente" }, { k: "envase", l: "📦 Envase" }, { k: "bebida", l: "🥤 Bebida" }].map(t => (
                      <button key={t.k} type="button" onClick={() => { setTipoDetalle(t.k as any); setLineaForm({ ingrediente_id: 0, cantidad: "", coste_total: "" }); }}
                        className={`px-3 py-1 rounded text-xs font-medium ${tipoDetalle === t.k ? "bg-blue-600 text-white" : "bg-white text-gray-600 border"}`}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={lineaForm.ingrediente_id} onChange={(e) => setLineaForm({ ...lineaForm, ingrediente_id: parseInt(e.target.value) })}
                      className="border rounded px-2 py-1.5 text-sm">
                      <option value={0}>Seleccionar...</option>
                      {(tipoDetalle === "ingrediente" ? ingredientes : tipoDetalle === "envase" ? envases : bebidas).map(i => (
                        <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_base})</option>
                      ))}
                    </select>
                    <input type="number" step="0.001" placeholder="Cantidad" value={lineaForm.cantidad}
                      onChange={(e) => setLineaForm({ ...lineaForm, cantidad: e.target.value })}
                      className="border rounded px-2 py-1.5 text-sm" />
                    <input type="number" step="0.01" placeholder="Coste €" value={lineaForm.coste_total}
                      onChange={(e) => setLineaForm({ ...lineaForm, coste_total: e.target.value })}
                      className="border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div className="flex gap-2 mt-2 justify-end">
                    <button type="button" onClick={() => setShowAddLinea(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                    <button type="button" onClick={addLineaTemporal} className="text-xs text-blue-600 font-medium hover:text-blue-800">Añadir</button>
                  </div>
                </div>
              )}

              {lineasTemp.length === 0 ? (
                <p className="text-xs text-gray-400">Sin líneas añadidas</p>
              ) : (
                <div className="space-y-1">
                  {lineasTemp.map((l, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                      <span>{l.nombre} × {l.cantidad} {l.unidad}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{l.coste_total.toFixed(2)} €</span>
                        <button type="button" onClick={() => removeLineaTemporal(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end text-sm font-semibold pt-1 border-t">
                    <span>Total: {lineasTemp.reduce((s, l) => s + l.coste_total, 0).toFixed(2)} €</span>
                  </div>
                </div>
              )}
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
          <>
            <div className="p-4 pb-2 flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px]">
                <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Buscar albarán..." />
              </div>
              <div className="flex gap-1">
                {[{ key: "todos", label: "Todos" }, { key: "pendiente", label: "Pendientes" }, { key: "procesado", label: "Procesados" }].map(f => (
                  <button key={f.key} onClick={() => setFiltroEstado(f.key as any)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filtroEstado === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
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
              {albaranes.filter((a) => {
                const q = searchTerm.toLowerCase();
                if (filtroEstado === "pendiente" && a.procesado) return false;
                if (filtroEstado === "procesado" && !a.procesado) return false;
                return !q || (a.numero_albaran ?? "").toLowerCase().includes(q) || (a.proveedor_nombre ?? "").toLowerCase().includes(q);
              }).map((a) => (
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
          </>
        )}
      </div>
      {revision && (
        <ModalRevision
          filas={revision}
          onChange={(next) => setRevision(next)}
          items={todosItems}
          onInsertar={insertarRevision}
          onCancelar={() => setRevision(null)}
        />
      )}
    </div>
  );
}

function ModalRevision({
  filas,
  onChange,
  items,
  onInsertar,
  onCancelar,
}: {
  filas: FilaRevision[];
  onChange: (next: FilaRevision[]) => void;
  items: ItemCatalogo[];
  onInsertar: () => void;
  onCancelar: () => void;
}) {
  const recalcReal = (f: FilaRevision, patch: Partial<FilaRevision>): Partial<FilaRevision> => {
    const merged = { ...f, ...patch };
    const item = items.find((i) => i.id === merged.item_id);
    const uds = parseFloat(merged.cantidad);
    const real =
      item && uds > 0
        ? calcularCantidadReal(
            uds,
            merged.contenido,
            merged.unidad_contenido,
            merged.unidad_linea,
            item.unidad_base
          )
        : null;
    if (real == null) return patch;
    return { ...patch, cantidad_real: String(real) };
  };

  const updateFila = (uid: number, patch: Partial<FilaRevision>) =>
    onChange(
      filas.map((f) => {
        if (f.uid !== uid) return f;
        // Solo se recalcula la cantidad real al cambiar uds o artículo;
        // una edición manual de "Real" se respeta hasta el próximo cambio
        const tocaCalculo = "cantidad" in patch || "item_id" in patch;
        return tocaCalculo ? { ...f, ...recalcReal(f, patch) } : { ...f, ...patch };
      })
    );

  const incluidas = filas.filter((f) => f.incluida);
  const total = incluidas.reduce(
    (s, f) => s + (parseFloat(f.cantidad) || 0) * (parseFloat(f.precio) || 0),
    0
  );
  const pendientes = incluidas.filter(
    (f) => !f.item_id || !(parseFloat(f.cantidad) > 0) || !(parseFloat(f.cantidad_real || "0") > 0)
  ).length;

  const iconoTipo = (t: string) => (t === "envase" ? "📦" : t === "bebida" ? "🥤" : "🥕");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Revisión del documento</h3>
            <p className="text-xs text-gray-500">
              {filas.length} líneas detectadas — desmarca las que no correspondan y asigna los artículos
            </p>
          </div>
          <button onClick={onCancelar} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b">
                <th className="w-8 pb-2"></th>
                <th className="pb-2">Descripción</th>
                <th className="pb-2 w-52">Artículo</th>
                <th className="pb-2 w-24 text-right" title="Cantidad del documento">Uds</th>
                <th
                  className="pb-2 w-28 text-right"
                  title="Cantidad real en la unidad del artículo (uds × presentación del envase)"
                >
                  Real
                </th>
                <th className="pb-2 w-24 text-right">Precio €</th>
                <th className="pb-2 w-28 text-right">Subtotal</th>
                <th className="w-8 pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map((f) => {
                const subtotal = (parseFloat(f.cantidad) || 0) * (parseFloat(f.precio) || 0);
                const itemFila = items.find((i) => i.id === f.item_id);
                return (
                  <tr key={f.uid} className={f.incluida ? "" : "opacity-40"}>
                    <td className="py-1.5">
                      <input
                        type="checkbox"
                        checked={f.incluida}
                        onChange={(e) => updateFila(f.uid, { incluida: e.target.checked })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={f.descripcion}
                        onChange={(e) => updateFila(f.uid, { descripcion: e.target.value })}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <SearchableSelect
                        options={items.map((i) => ({
                          value: i.id,
                          label: `${iconoTipo(i.tipo)} ${i.nombre} (${i.unidad_base})`,
                        }))}
                        value={f.item_id}
                        onChange={(val) => updateFila(f.uid, { item_id: val })}
                        placeholder={f.item_id ? "..." : "Seleccionar..."}
                      />
                      {f.incluida && !f.item_id && (
                        <p className="text-[11px] text-red-500 mt-0.5">Obligatorio</p>
                      )}
                    </td>
                    <td className="py-1.5 pr-1">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.001"
                          value={f.cantidad}
                          onChange={(e) => updateFila(f.uid, { cantidad: e.target.value })}
                          className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-right"
                          title="Cantidad del documento"
                        />
                        <span className="text-[11px] text-gray-400 w-5" title="Unidad detectada en el documento">
                          {f.unidad_linea ?? ""}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-1">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.001"
                          value={f.cantidad_real}
                          onChange={(e) => updateFila(f.uid, { cantidad_real: e.target.value })}
                          className="w-16 border border-amber-200 bg-amber-50 rounded px-2 py-1 text-sm text-right"
                          title="Cantidad real en la unidad del artículo (uds × presentación)"
                        />
                        <span className="text-[11px] text-gray-400 w-6">{itemFila?.unidad_base ?? ""}</span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="0.0001"
                        value={f.precio}
                        onChange={(e) => updateFila(f.uid, { precio: e.target.value })}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-sm text-gray-700 text-right font-mono">
                      {subtotal.toFixed(2)} €
                      {(f.importe_con_iva || f.precio_con_iva) && f.iva_pct != null && (
                        <span
                          className="block text-[10px] text-amber-700 font-sans"
                          title={
                            f.precio_con_iva
                              ? `Los precios unitarios llevan IVA (${f.iva_pct}%) incluido: el coste grabado se normaliza a sin IVA`
                              : `El importe impreso lleva IVA (${f.iva_pct}%) incluido; el precio unitario no`
                          }
                        >
                          {f.precio_con_iva ? `precios c/IVA ${f.iva_pct}%` : `importe c/IVA ${f.iva_pct}%`}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5">
                      <button
                        onClick={() => onChange(filas.filter((x) => x.uid !== f.uid))}
                        className="text-red-400 hover:text-red-600"
                        title="Quitar línea"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filas.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No queda ninguna línea</p>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm">
            {pendientes > 0 ? (
              <span className="text-red-600">{pendientes} líneas sin artículo/cantidad</span>
            ) : (
              <span className="text-gray-500">{incluidas.length} líneas a insertar</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-gray-800">Total: {total.toFixed(2)} €</span>
            <button
              onClick={onCancelar}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={onInsertar}
              disabled={incluidas.length === 0 || pendientes > 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              Insertar {incluidas.length} líneas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
