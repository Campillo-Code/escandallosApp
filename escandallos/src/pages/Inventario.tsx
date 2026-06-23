import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Plus, X, AlertTriangle, ArrowDown, ArrowUp, Minus, Settings, FileSpreadsheet, FileText } from "lucide-react";
import { exportInventarioExcel, exportInventarioPDF } from "../lib/exports";

interface InventarioItem {
  id: number;
  ingrediente_id: number;
  ingrediente_nombre: string | null;
  unidad_base: string | null;
  stock_actual: number;
  stock_minimo: number;
  unidad: string;
  ubicacion: string | null;
}

interface Ingrediente {
  id: number;
  nombre: string;
  unidad_base: string;
}

interface Movimiento {
  id: number;
  ingrediente_id: number;
  ingrediente_nombre: string | null;
  tipo: string;
  cantidad: number;
  referencia: string | null;
  albaran_id: number | null;
  receta_id: number | null;
  notas: string | null;
  fecha: string;
}

const stockSchema = z.object({
  ingrediente_id: z.string().min(1, "Selecciona un ingrediente"),
  stock_actual: z.string().min(1, "El stock es obligatorio"),
  stock_minimo: z.string().min(1, "El stock mínimo es obligatorio"),
  ubicacion: z.string().optional(),
});

type StockFormData = z.infer<typeof stockSchema>;

const movimientoSchema = z.object({
  ingrediente_id: z.string().min(1, "Selecciona un ingrediente"),
  tipo: z.string().min(1, "Selecciona un tipo"),
  cantidad: z.string().min(1, "La cantidad es obligatoria"),
  referencia: z.string().optional(),
  notas: z.string().optional(),
});

type MovimientoFormData = z.infer<typeof movimientoSchema>;

const TIPOS_MOVIMIENTO = [
  { value: "entrada", label: "Entrada", icon: ArrowDown, color: "text-green-600" },
  { value: "salida", label: "Salida", icon: ArrowUp, color: "text-red-600" },
  { value: "merma", label: "Merma", icon: Minus, color: "text-yellow-600" },
  { value: "ajuste", label: "Ajuste", icon: Settings, color: "text-blue-600" },
];

export default function Inventario() {
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [showStockForm, setShowStockForm] = useState(false);
  const [showMovimientoForm, setShowMovimientoForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stock" | "movimientos">("stock");

  const {
    register: registerStock,
    handleSubmit: handleSubmitStock,
    reset: resetStock,
    formState: { errors: errorsStock, isSubmitting: isSubmittingStock },
  } = useForm<StockFormData>({
    resolver: zodResolver(stockSchema),
  });

  const {
    register: registerMov,
    handleSubmit: handleSubmitMov,
    reset: resetMov,
    watch: watchMov,
    formState: { errors: errorsMov, isSubmitting: isSubmittingMov },
  } = useForm<MovimientoFormData>({
    resolver: zodResolver(movimientoSchema),
    defaultValues: { tipo: "entrada" },
  });

  const selectedTipo = watchMov("tipo");

  const loadInventario = async () => {
    try {
      const data = await invoke<InventarioItem[]>("get_inventario");
      setInventario(data);
    } catch (e) {
      console.error("Error loading inventario:", e);
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

  const loadMovimientos = async () => {
    try {
      const data = await invoke<Movimiento[]>("get_inventario_movimientos", {});
      setMovimientos(data);
    } catch (e) {
      console.error("Error loading movimientos:", e);
    }
  };

  useEffect(() => {
    loadInventario();
    loadIngredientes();
    loadMovimientos();
  }, []);

  const onSubmitStock = async (data: StockFormData) => {
    try {
      await invoke("upsert_inventario", {
        input: {
          ingrediente_id: parseInt(data.ingrediente_id),
          stock_actual: parseFloat(data.stock_actual),
          stock_minimo: parseFloat(data.stock_minimo),
          unidad: ingredientes.find((i) => i.id === parseInt(data.ingrediente_id))?.unidad_base ?? "ud",
          ubicacion: data.ubicacion || null,
        },
      });
      setShowStockForm(false);
      resetStock();
      loadInventario();
    } catch (e) {
      alert("Error al guardar: " + e);
    }
  };

  const onSubmitMovimiento = async (data: MovimientoFormData) => {
    try {
      await invoke("add_inventario_movimiento", {
        input: {
          ingrediente_id: parseInt(data.ingrediente_id),
          tipo: data.tipo,
          cantidad: parseFloat(data.cantidad),
          referencia: data.referencia || null,
          albaran_id: null,
          receta_id: null,
          notas: data.notas || null,
        },
      });
      setShowMovimientoForm(false);
      resetMov();
      loadInventario();
      loadMovimientos();
    } catch (e) {
      alert("Error al registrar movimiento: " + e);
    }
  };

  const handleDeleteStock = async (ingredienteId: number) => {
    if (!confirm("¿Eliminar este ingrediente del inventario?")) return;
    try {
      await invoke("delete_inventario", { ingredienteId });
      loadInventario();
    } catch (e) {
      alert("Error al eliminar: " + e);
    }
  };

  const getIcon = (tipo: string) => {
    const found = TIPOS_MOVIMIENTO.find((t) => t.value === tipo);
    return found?.icon ?? ArrowDown;
  };

  const getIconColor = (tipo: string) => {
    const found = TIPOS_MOVIMIENTO.find((t) => t.value === tipo);
    return found?.color ?? "text-gray-600";
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Inventario</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab("stock")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === "stock"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Stock Actual
        </button>
        <button
          onClick={() => setTab("movimientos")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === "movimientos"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Movimientos
        </button>
      </div>

      {tab === "stock" && (
        <>
          <div className="flex justify-end gap-3 mb-4">
            <button
              onClick={() => exportInventarioExcel(inventario)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
            <button
              onClick={() => exportInventarioPDF(inventario)}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              <FileText size={18} />
              PDF
            </button>
            <button
              onClick={() => {
                resetStock();
                setShowStockForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Gestionar Stock
            </button>
          </div>

          {showStockForm && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Gestionar Stock</h3>
                <button onClick={() => setShowStockForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmitStock(onSubmitStock)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ingrediente *</label>
                  <select
                    {...registerStock("ingrediente_id")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    {ingredientes.map((i) => (
                      <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_base})</option>
                    ))}
                  </select>
                  {errorsStock.ingrediente_id && <p className="text-red-500 text-sm mt-1">{errorsStock.ingrediente_id.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Actual *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    {...registerStock("stock_actual")}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errorsStock.stock_actual && <p className="text-red-500 text-sm mt-1">{errorsStock.stock_actual.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    {...registerStock("stock_minimo")}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errorsStock.stock_minimo && <p className="text-red-500 text-sm mt-1">{errorsStock.stock_minimo.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                  <input
                    {...registerStock("ubicacion")}
                    placeholder="Ej: Nevera, Almacén"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowStockForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingStock}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmittingStock ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-gray-500">Cargando...</div>
            ) : inventario.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No hay ingredientes en inventario</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ingrediente</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Stock Actual</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Stock Mínimo</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ubicación</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inventario.map((inv) => {
                    const isLow = inv.stock_actual <= inv.stock_minimo;
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{inv.ingrediente_nombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {inv.stock_actual % 1 === 0 ? inv.stock_actual.toFixed(0) : inv.stock_actual.toFixed(3)} {inv.unidad}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {inv.stock_minimo % 1 === 0 ? inv.stock_minimo.toFixed(0) : inv.stock_minimo.toFixed(3)} {inv.unidad}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{inv.ubicacion ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                              <AlertTriangle size={14} /> Bajo
                            </span>
                          ) : (
                            <span className="text-green-600">OK</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <button
                            onClick={() => handleDeleteStock(inv.ingrediente_id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Minus size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "movimientos" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                resetMov();
                setShowMovimientoForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Nuevo Movimiento
            </button>
          </div>

          {showMovimientoForm && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Nuevo Movimiento</h3>
                <button onClick={() => setShowMovimientoForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmitMov(onSubmitMovimiento)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ingrediente *</label>
                  <select
                    {...registerMov("ingrediente_id")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    {ingredientes.map((i) => (
                      <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_base})</option>
                    ))}
                  </select>
                  {errorsMov.ingrediente_id && <p className="text-red-500 text-sm mt-1">{errorsMov.ingrediente_id.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select
                    {...registerMov("tipo")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TIPOS_MOVIMIENTO.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {selectedTipo === "ajuste" ? "Stock final *" : "Cantidad *"}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    {...registerMov("cantidad")}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errorsMov.cantidad && <p className="text-red-500 text-sm mt-1">{errorsMov.cantidad.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                  <input
                    {...registerMov("referencia")}
                    placeholder="Ej: Albarán #123"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    {...registerMov("notas")}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowMovimientoForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingMov}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmittingMov ? "Registrando..." : "Registrar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {movimientos.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No hay movimientos registrados</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ingrediente</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cantidad</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Referencia</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {movimientos.map((m) => {
                    const Icon = getIcon(m.tipo);
                    const color = getIconColor(m.tipo);
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{m.fecha}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.ingrediente_nombre}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center gap-1 font-medium ${color}`}>
                            <Icon size={14} /> {m.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{m.cantidad}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{m.referencia ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{m.notas ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
