import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShoppingCart, Check, X, Clock, Package } from "lucide-react";

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

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<WhatsappPedido[]>([]);
  const [filtro, setFiltro] = useState<string>("pendiente");
  const [loading, setLoading] = useState(true);
  const [pedidoExpandido, setPedidoExpandido] = useState<number | null>(null);
  const [motivoCancel, setMotivoCancel] = useState<number | null>(null);
  const [motivoText, setMotivoText] = useState("");
  const [pedidoCount, setPedidoCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);

  const loadPedidos = async () => {
    try {
      const data = await invoke<WhatsappPedido[]>("get_whatsapp_pedidos", {
        estado: filtro === "todos" ? null : filtro,
      });
      const newCount = data.filter(p => p.estado === "pendiente").length;
      if (newCount > prevCountRef.current && prevCountRef.current > 0 && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      prevCountRef.current = newCount;
      setPedidoCount(newCount);
      setPedidos(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setLoading(true);
    loadPedidos();
    const interval = setInterval(loadPedidos, 10000);
    return () => clearInterval(interval);
  }, [filtro]);

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
      await invoke("update_whatsapp_pedido_estado", {
        id: motivoCancel,
        estado: "cancelado",
        motivo: motivoText || null,
      });
      setMotivoCancel(null);
      setMotivoText("");
      loadPedidos();
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
      case "cancelado": return "bg-red-100 text-red-700";
      default: return "bg-yellow-100 text-yellow-700";
    }
  };

  return (
    <div className="p-6">
      <audio ref={audioRef} preload="auto" />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart size={28} /> Pedidos WhatsApp
          {pedidoCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-sm font-bold px-2 py-0.5 rounded-full animate-pulse">
              {pedidoCount} nuevos
            </span>
          )}
        </h2>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "pendiente", label: "Pendientes", icon: <Clock size={14} /> },
          { key: "confirmado", label: "Confirmados", icon: <Check size={14} /> },
          { key: "cancelado", label: "Cancelados", icon: <X size={14} /> },
          { key: "todos", label: "Todos", icon: <Package size={14} /> },
        ].map(f => (
          <button key={f.key} onClick={() => { setFiltro(f.key); setLoading(true); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtro === f.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
            }`}>
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Lista de pedidos */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        ) : pedidos.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <ShoppingCart size={48} className="mx-auto mb-2 opacity-30" />
            <p>No hay pedidos {filtro !== "todos" ? `con estado "${filtro}"` : ""}</p>
          </div>
        ) : (
          pedidos.map(pedido => {
            const items = getItems(pedido.items);
            const isExpanded = pedidoExpandido === pedido.id;
            return (
              <div key={pedido.id} className={`bg-white rounded-xl border overflow-hidden ${
                pedido.estado === "pendiente" ? "border-yellow-300 shadow-sm" : "border-gray-200"
              }`}>
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
                    </div>
                    <div className="text-sm text-gray-800 font-medium">
                      {pedido.nombre_cliente || pedido.telefono}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {pedido.created_at} · {items.length} artículo(s)
                      {pedido.fecha_entrega && ` · Entrega: ${pedido.fecha_entrega}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">{pedido.total.toFixed(2)} €</div>
                    {pedido.estado === "pendiente" && (
                      <div className="flex gap-1 mt-1">
                        <button onClick={(e) => { e.stopPropagation(); handleConfirm(pedido.id); }}
                          className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200" title="Confirmar">
                          <Check size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleCancel(pedido.id); }}
                          className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="Cancelar">
                          <X size={14} />
                        </button>
                      </div>
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
                            <td className="py-1.5">
                              <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{item.categoria}</span>
                            </td>
                            <td className="py-1.5 text-gray-800">{item.descripcion}</td>
                            <td className="py-1.5 text-center text-gray-600">{item.cantidad}</td>
                            <td className="py-1.5 text-right text-gray-600 font-mono">{item.precio_unitario.toFixed(2)} €</td>
                            <td className="py-1.5 text-right font-mono font-medium">{item.subtotal.toFixed(2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pedido.notas && (
                      <p className="mt-2 text-xs text-gray-400 italic">📝 {pedido.notas}</p>
                    )}
                    {pedido.motivo_cancelacion && (
                      <p className="mt-2 text-xs text-red-500 italic">❌ Motivo cancelación: {pedido.motivo_cancelacion}</p>
                    )}
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
            <p className="text-sm text-gray-600 mb-3">Motivo de cancelación (opcional):</p>
            <textarea value={motivoText} onChange={(e) => setMotivoText(e.target.value)}
              placeholder="Ej: No tenemos disponibilidad..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-20 mb-4" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setMotivoCancel(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Volver</button>
              <button onClick={confirmCancel} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Cancelar pedido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
