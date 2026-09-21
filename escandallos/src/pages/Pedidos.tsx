import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShoppingCart, Check, X, Plus, Trash2, CreditCard } from "lucide-react";
import SearchableSelect from "../components/SearchableSelect";
import DateInput from "../components/DateInput";

interface WhatsappPedido {
  id: number;
  telefono: string;
  nombre_cliente: string | null;
  items: string;
  total: number;
  notas: string | null;
  tipo: string;
  estado: string;
  motivo_cancelacion: string | null;
  fecha_entrega: string | null;
  created_at: string;
}

interface TicketItem {
  categoria: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

interface CajaCategoria {
  id: number;
  nombre: string;
  precio: number;
  plus: number;
  activa: boolean;
}

interface PlatoCaja {
  id: number;
  categoria_id: number;
  nombre: string;
  plus: number;
  activo: boolean;
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<WhatsappPedido[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>("pendiente");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [pedidoExpandido, setPedidoExpandido] = useState<number | null>(null);
  const [motivoCancel, setMotivoCancel] = useState<number | null>(null);
  const [motivoText, setMotivoText] = useState("");
  const [pedidoCount, setPedidoCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);

  // Formulario nuevo pedido
  const [showForm, setShowForm] = useState(false);
  const [formTipo, setFormTipo] = useState<"pedido" | "encargo">("pedido");
  const [formNombre, setFormNombre] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formItems, setFormItems] = useState<{ categoria: string; descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }[]>([]);
  const [formNotas, setFormNotas] = useState("");
  const [formFechaEntrega, setFormFechaEntrega] = useState("");
  const [categorias, setCategorias] = useState<CajaCategoria[]>([]);
  const [platos, setPlatos] = useState<PlatoCaja[]>([]);

  const loadPedidos = async () => {
    try {
      const data = await invoke<WhatsappPedido[]>("get_whatsapp_pedidos", {
        estado: filtroEstado === "todos" ? null : filtroEstado,
      });
      // Filtrar por tipo
      let filtrados = filtroTipo === "todos" ? data : data.filter(p => p.tipo === filtroTipo);
      // Filtrar por fechas
      if (fechaDesde) filtrados = filtrados.filter(p => p.created_at >= fechaDesde);
      if (fechaHasta) filtrados = filtrados.filter(p => p.created_at <= fechaHasta + " 23:59");
      const newCount = data.filter(p => p.estado === "pendiente").length;
      if (newCount > prevCountRef.current && prevCountRef.current > 0 && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      prevCountRef.current = newCount;
      setPedidoCount(newCount);
      setPedidos(filtrados);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadCatalogo = async () => {
    try {
      const [cats, plats] = await Promise.all([
        invoke<CajaCategoria[]>("get_caja_categorias"),
        invoke<PlatoCaja[]>("get_platos_caja", { categoriaId: null }),
      ]);
      setCategorias(cats.filter(c => c.activa));
      setPlatos(plats.filter(p => p.activo));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    setLoading(true);
    loadPedidos();
    loadCatalogo();
    const interval = setInterval(loadPedidos, 10000);
    return () => clearInterval(interval);
  }, [filtroEstado, filtroTipo, fechaDesde, fechaHasta]);

  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczIj2NysaRXS4cXJ3P2rBnMyI9jcrGkV0uHFydz9qwZzMiPY3KxpFdLhxcnc/asGczIj2NysaRXS4cXJ3P2rBnMyI9jcrGkV0uHFydz9qwZzMiPY3KxpFdLhxcnc/asGczIj0=");
  }, []);

  const handleConfirm = async (id: number) => {
    try {
      await invoke("update_whatsapp_pedido_estado", { id, estado: "confirmado", motivo: null });
      loadPedidos();
    } catch (e) { alert("Error: " + e); }
  };

  const handleCancel = async (id: number) => {
    setMotivoCancel(id);
    setMotivoText("");
  };

  const confirmCancel = async () => {
    if (motivoCancel === null) return;
    try {
      await invoke("update_whatsapp_pedido_estado", { id: motivoCancel, estado: "cancelado", motivo: motivoText || null });
      setMotivoCancel(null);
      setMotivoText("");
      loadPedidos();
    } catch (e) { alert("Error: " + e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este pedido permanentemente?")) return;
    try {
      await invoke("delete_whatsapp_pedido", { id });
      loadPedidos();
    } catch (e) { alert("Error: " + e); }
  };

  const handleCobrar = async (pedido: WhatsappPedido) => {
    // Marcar como cobrado y llevar a la caja
    try {
      await invoke("update_whatsapp_pedido_estado", { id: pedido.id, estado: "cobrado", motivo: null });
      // Navegar a la caja
      window.location.href = "/caja";
    } catch (e) { alert("Error: " + e); }
  };

  const getItems = (itemsJson: string): TicketItem[] => {
    try { return JSON.parse(itemsJson); } catch { return []; }
  };

  const getColorByTipo = (tipo: string) => {
    switch (tipo) {
      case "encargo": return "bg-purple-100 text-purple-700";
      default: return "bg-blue-100 text-blue-700";
    }
  };

  const getColorByEstado = (estado: string) => {
    switch (estado) {
      case "confirmado": return "bg-green-100 text-green-700";
      case "cobrado": return "bg-blue-100 text-blue-700";
      case "cancelado": return "bg-red-100 text-red-700";
      default: return "bg-yellow-100 text-yellow-700";
    }
  };

  // Formulario manual
  const addItemManual = (platoId: number) => {
    const plato = platos.find(p => p.id === platoId);
    if (!plato) return;
    const cat = categorias.find(c => c.id === plato.categoria_id);
    const precio = (cat?.precio || 0) + (plato.plus || 0);
    setFormItems(prev => [...prev, { categoria: cat?.nombre || "", descripcion: plato.nombre, cantidad: 1, precio_unitario: precio, subtotal: precio }]);
  };

  const updateItemCantidad = (index: number, cantidad: number) => {
    setFormItems(prev => prev.map((item, i) => i === index ? { ...item, cantidad, subtotal: item.precio_unitario * cantidad } : item));
  };

  const removeItem = (index: number) => {
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  const formTotal = formItems.reduce((sum, item) => sum + item.subtotal, 0);

  const handleCrearPedido = async () => {
    if (formItems.length === 0) { alert("Añade al menos un plato"); return; }
    try {
      await invoke("create_whatsapp_pedido_manual", {
        input: { telefono: formTelefono || "manual", nombre_cliente: formNombre || null, items: formItems, total: formTotal, notas: formNotas || null, tipo: formTipo, fecha_entrega: formFechaEntrega || null },
      });
      setShowForm(false);
      setFormNombre(""); setFormTelefono(""); setFormItems([]); setFormNotas(""); setFormFechaEntrega("");
      loadPedidos();
    } catch (e) { alert("Error: " + e); }
  };

  return (
    <div className="p-6">
      <audio ref={audioRef} preload="auto" />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart size={28} /> Pedidos
          {pedidoCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-sm font-bold px-2 py-0.5 rounded-full animate-pulse">{pedidoCount} nuevos</span>
          )}
        </h2>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={18} /> Nuevo Pedido
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <div className="flex gap-1">
              {[{ key: "pendiente", label: "Pendientes" }, { key: "confirmado", label: "Confirmados" }, { key: "cobrado", label: "Cobrados" }, { key: "cancelado", label: "Cancelados" }, { key: "todos", label: "Todos" }].map(f => (
                <button key={f.key} onClick={() => setFiltroEstado(f.key)}
                  className={`px-2 py-1 rounded text-xs font-medium ${filtroEstado === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <div className="flex gap-1">
              {[{ key: "todos", label: "Todos" }, { key: "pedido", label: "Pedidos" }, { key: "encargo", label: "Encargos" }].map(f => (
                <button key={f.key} onClick={() => setFiltroTipo(f.key)}
                  className={`px-2 py-1 rounded text-xs font-medium ${filtroTipo === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <DateInput value={fechaDesde} onChange={setFechaDesde} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <DateInput value={fechaHasta} onChange={setFechaHasta} />
          </div>
          {(fechaDesde || fechaHasta) && (
            <button onClick={() => { setFechaDesde(""); setFechaHasta(""); }} className="text-xs text-blue-600 hover:underline">Limpiar</button>
          )}
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        ) : pedidos.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <ShoppingCart size={48} className="mx-auto mb-2 opacity-30" />
            <p>No hay pedidos con estos filtros</p>
          </div>
        ) : (
          pedidos.map(pedido => {
            const items = getItems(pedido.items);
            const isExpanded = pedidoExpandido === pedido.id;
            return (
              <div key={pedido.id} className={`bg-white rounded-xl border overflow-hidden ${pedido.estado === "pendiente" ? "border-yellow-300 shadow-sm" : "border-gray-200"}`}>
                <div onClick={() => setPedidoExpandido(isExpanded ? null : pedido.id)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getColorByTipo(pedido.tipo)}`}>
                        {pedido.tipo === "encargo" ? "📦 Encargo" : "🛒 Pedido"}
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getColorByEstado(pedido.estado)}`}>
                        {pedido.estado}
                      </span>
                      {pedido.tipo === "manual" && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">📝 Manual</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-800 font-medium">{pedido.nombre_cliente || pedido.telefono}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {pedido.created_at} · {items.length} artículo(s)
                      {pedido.fecha_entrega && ` · Entrega: ${pedido.fecha_entrega}`}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div className="font-bold text-gray-800">{pedido.total.toFixed(2)} €</div>
                    {pedido.estado === "pendiente" && (
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleConfirm(pedido.id); }}
                          className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200" title="Confirmar">
                          <Check size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleCobrar(pedido); }}
                          className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200" title="Cobrar">
                          <CreditCard size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleCancel(pedido.id); }}
                          className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="Cancelar">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    {pedido.estado !== "pendiente" && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(pedido.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-gray-50 px-4 py-3 border-t">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500">
                          <th className="text-left pb-1">Categoría</th>
                          <th className="text-left pb-1">Plato</th>
                          <th className="text-center pb-1">Uds</th>
                          <th className="text-right pb-1">Precio</th>
                          <th className="text-right pb-1">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className="border-t border-gray-200">
                            <td className="py-1.5"><span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{item.categoria}</span></td>
                            <td className="py-1.5 text-gray-800">{item.descripcion}</td>
                            <td className="py-1.5 text-center text-gray-600">{item.cantidad}</td>
                            <td className="py-1.5 text-right text-gray-600 font-mono">{item.precio_unitario.toFixed(2)} €</td>
                            <td className="py-1.5 text-right font-mono font-medium">{item.subtotal.toFixed(2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pedido.notas && <p className="mt-2 text-xs text-gray-400 italic">📝 {pedido.notas}</p>}
                    {pedido.motivo_cancelacion && <p className="mt-2 text-xs text-red-500 italic">❌ Motivo cancelación: {pedido.motivo_cancelacion}</p>}
                    <div className="text-xs text-gray-400 mt-1">Tel: {pedido.telefono}</div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal cancelación */}
      {motivoCancel !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Cancelar pedido</h3>
            <textarea value={motivoText} onChange={(e) => setMotivoText(e.target.value)}
              placeholder="Motivo de cancelación (opcional)..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-20 mb-4" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setMotivoCancel(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Volver</button>
              <button onClick={confirmCancel} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Cancelar pedido</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Pedido */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Nuevo Pedido</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setFormTipo("pedido")} className={`px-4 py-2 rounded-lg text-sm font-medium ${formTipo === "pedido" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>🛒 Pedido</button>
                <button onClick={() => setFormTipo("encargo")} className={`px-4 py-2 rounded-lg text-sm font-medium ${formTipo === "encargo" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600"}`}>📦 Encargo</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del cliente</label>
                  <input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Nombre" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} placeholder="600 123 456" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              {formTipo === "encargo" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de entrega</label>
                  <input type="date" value={formFechaEntrega} onChange={(e) => setFormFechaEntrega(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Añadir plato</label>
                <SearchableSelect
                  options={platos.map(p => { const cat = categorias.find(c => c.id === p.categoria_id); const precio = (cat?.precio || 0) + (p.plus || 0); return { value: p.id, label: `${p.nombre} (${cat?.nombre || ""}) - ${precio.toFixed(2)}€` }; })}
                  value={0} onChange={(val) => { if (val) addItemManual(val); }} placeholder="Seleccionar plato..." />
              </div>
              {formItems.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">Plato</th><th className="text-center px-3 py-2">Uds</th><th className="text-right px-3 py-2">Precio</th><th className="text-right px-3 py-2">Subtotal</th><th className="w-8"></th></tr></thead>
                    <tbody className="divide-y">
                      {formItems.map((item, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2"><span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mr-1">{item.categoria}</span>{item.descripcion}</td>
                          <td className="px-3 py-2 text-center"><input type="number" min="1" value={item.cantidad} onChange={(e) => updateItemCantidad(i, parseInt(e.target.value) || 1)} className="w-16 border rounded px-2 py-1 text-center text-sm" /></td>
                          <td className="px-3 py-2 text-right font-mono">{item.precio_unitario.toFixed(2)} €</td>
                          <td className="px-3 py-2 text-right font-mono font-medium">{item.subtotal.toFixed(2)} €</td>
                          <td className="px-3 py-2"><button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold"><tr><td colSpan={3} className="px-3 py-2 text-right">Total:</td><td className="px-3 py-2 text-right font-mono">{formTotal.toFixed(2)} €</td><td></td></tr></tfoot>
                  </table>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={formNotas} onChange={(e) => setFormNotas(e.target.value)} placeholder="Notas adicionales..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-16" />
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleCrearPedido} disabled={formItems.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium">Crear pedido ({formTotal.toFixed(2)} €)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
