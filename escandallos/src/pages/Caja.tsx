import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShoppingCart, Trash2, Plus, Minus, X, Search, Clock } from "lucide-react";

interface ProductoCaja {
  id: number;
  nombre: string;
  precio_venta: number;
  codigo_caja: string | null;
  categoria: string;
  tipo: string;
}

interface TicketLine {
  receta_id: number | null;
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
}

interface CajaTicket {
  id: number;
  fecha: string;
  hora: string;
  total: number;
  items: string;
  tipo_venta: string | null;
  notas: string | null;
}

interface CajaResumen {
  total_vendido: number;
  num_tickets: number;
  ticket_medio: number;
  por_categoria: { categoria: string; total: number; cantidad: number }[];
}

const TIPO_VENTA_OPTIONS = [
  { value: "menu_dia", label: "Menú del Día" },
  { value: "plato", label: "Plato" },
  { value: "bebida", label: "Bebida" },
  { value: "postre", label: "Postre" },
  { value: "mixto", label: "Mixto" },
];

export default function Caja() {
  const [productos, setProductos] = useState<ProductoCaja[]>([]);
  const [ticket, setTicket] = useState<TicketLine[]>([]);
  const [search, setSearch] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const [resumen, setResumen] = useState<CajaResumen | null>(null);
  const [ticketsHoy, setTicketsHoy] = useState<CajaTicket[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [tipoVenta, setTipoVenta] = useState("mixto");
  const [notas, setNotas] = useState("");
  const [processing, setProcessing] = useState(false);
  const codigoRef = useRef<HTMLInputElement>(null);

  const loadProductos = async () => {
    try {
      const data = await invoke<ProductoCaja[]>("get_productos_caja");
      setProductos(data);
      // Set default tab to first available category
      if (data.length > 0) {
        const cats = [...new Set(data.map((p) => p.categoria))];
        if (cats.length > 0 && activeTab === "Todos") setActiveTab(cats[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadResumen = async () => {
    try {
      const data = await invoke<CajaResumen>("get_caja_resumen", { fecha: null });
      setResumen(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTickets = async () => {
    try {
      const data = await invoke<CajaTicket[]>("get_caja_tickets", { fechaDesde: null, fechaHasta: null });
      setTicketsHoy(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadProductos();
    loadResumen();
    loadTickets();
  }, []);

  // Auto-focus code input
  useEffect(() => {
    codigoRef.current?.focus();
  }, [ticket]);

  // Filter products
  const filteredProductos = productos.filter((p) => {
    const matchSearch =
      !search ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.codigo_caja && p.codigo_caja.toLowerCase().includes(search.toLowerCase()));
    const matchTab =
      activeTab === "Todos" || p.categoria === activeTab || (activeTab === "Menús" && p.tipo === "menu");
    return matchSearch && matchTab;
  });

  // Get unique categories for tabs
  const categories = ["Todos", "Menús", ...new Set(productos.map((p) => p.categoria))];

  // Add product to ticket
  const addProducto = (prod: ProductoCaja) => {
    setTicket((prev) => {
      const existing = prev.find((l) => l.nombre === prod.nombre);
      if (existing) {
        return prev.map((l) =>
          l.nombre === prod.nombre
            ? { ...l, cantidad: l.cantidad + 1, subtotal: (l.cantidad + 1) * l.precio }
            : l
        );
      }
      return [
        ...prev,
        {
          receta_id: prod.tipo === "receta" ? prod.id : null,
          nombre: prod.nombre,
          cantidad: 1,
          precio: prod.precio_venta,
          subtotal: prod.precio_venta,
        },
      ];
    });
    setCodigoInput("");
    setSearch("");
  };

  // Handle code input
  const handleCodigo = (value: string) => {
    setCodigoInput(value);
    if (value.length >= 2) {
      const found = productos.find(
        (p) => p.codigo_caja && p.codigo_caja.toLowerCase() === value.toLowerCase()
      );
      if (found) {
        addProducto(found);
      }
    }
  };

  // Update quantity
  const updateCantidad = (idx: number, delta: number) => {
    setTicket((prev) =>
      prev
        .map((l, i) => {
          if (i !== idx) return l;
          const newCant = l.cantidad + delta;
          if (newCant <= 0) return null;
          return { ...l, cantidad: newCant, subtotal: newCant * l.precio };
        })
        .filter(Boolean) as TicketLine[]
    );
  };

  // Remove line
  const removeLine = (idx: number) => {
    setTicket((prev) => prev.filter((_, i) => i !== idx));
  };

  // Total
  const total = ticket.reduce((sum, l) => sum + l.subtotal, 0);

  // Cobrar
  const handleCobrar = async () => {
    if (ticket.length === 0) return;
    setProcessing(true);
    try {
      await invoke("create_caja_ticket", {
        input: {
          items: ticket,
          total,
          tipo_venta: tipoVenta,
          notas: notas || null,
        },
      });
      setTicket([]);
      setNotas("");
      setTipoVenta("mixto");
      loadResumen();
      loadTickets();
    } catch (e) {
      alert("Error al cobrar: " + e);
    } finally {
      setProcessing(false);
    }
  };

  // Delete ticket
  const handleDeleteTicket = async (id: number) => {
    if (!confirm("¿Eliminar este ticket? Se borrarán las ventas asociadas.")) return;
    try {
      await invoke("delete_caja_ticket", { id });
      loadResumen();
      loadTickets();
    } catch (e) {
      alert("Error: " + e);
    }
  };

  // Parse ticket items for display
  const parseTicketItems = (itemsJson: string): TicketLine[] => {
    try {
      return JSON.parse(itemsJson);
    } catch {
      return [];
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart size={24} /> Caja
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Clock size={16} /> Historial
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* IZQUIERDA: Productos */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Buscador + código */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <input
              ref={codigoRef}
              value={codigoInput}
              onChange={(e) => handleCodigo(e.target.value)}
              placeholder="Código"
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-center uppercase"
              maxLength={10}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  activeTab === cat
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid de productos */}
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 content-start">
            {filteredProductos.map((prod, idx) => (
              <button
                key={`${prod.tipo}-${prod.id}-${idx}`}
                onClick={() => addProducto(prod)}
                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all text-center min-h-[80px]"
              >
                <span className="text-sm font-medium text-gray-800 leading-tight">{prod.nombre}</span>
                <span className="text-lg font-bold text-blue-600 mt-1">{prod.precio_venta.toFixed(2)}€</span>
                {prod.codigo_caja && (
                  <span className="text-[10px] font-mono text-gray-400 mt-0.5">{prod.codigo_caja}</span>
                )}
              </button>
            ))}
            {filteredProductos.length === 0 && (
              <div className="col-span-full text-center text-gray-400 py-8">No hay productos</div>
            )}
          </div>
        </div>

        {/* DERECHA: Ticket */}
        <div className="w-80 flex flex-col bg-white rounded-lg shadow border border-gray-200">
          {/* Header ticket */}
          <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800">Ticket Actual</span>
              {ticket.length > 0 && (
                <button onClick={() => setTicket([])} className="text-xs text-red-500 hover:text-red-700">
                  Vaciar
                </button>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <select
                value={tipoVenta}
                onChange={(e) => setTipoVenta(e.target.value)}
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
              >
                {TIPO_VENTA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Líneas del ticket */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {ticket.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">
                Añade productos pulsando los botones
              </div>
            ) : (
              ticket.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCantidad(idx, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center font-medium">{line.cantidad}</span>
                    <button
                      onClick={() => updateCantidad(idx, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="flex-1 truncate text-gray-800">{line.nombre}</span>
                  <span className="font-medium text-gray-700">{line.subtotal.toFixed(2)}€</span>
                  <button onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Notas */}
          {ticket.length > 0 && (
            <div className="px-3 pb-2">
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas (opcional)"
                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
              />
            </div>
          )}

          {/* Total + Cobrar */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">Total</span>
              <span className="text-2xl font-bold text-gray-800">{total.toFixed(2)}€</span>
            </div>
            <button
              onClick={handleCobrar}
              disabled={ticket.length === 0 || processing}
              className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
            >
              {processing ? "Procesando..." : "COBRAR"}
            </button>
          </div>
        </div>
      </div>

      {/* Resumen del día */}
      {resumen && (
        <div className="mt-4 bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex items-center gap-8 flex-wrap">
            <div>
              <span className="text-xs text-gray-500">Tickets hoy</span>
              <p className="text-xl font-bold text-gray-800">{resumen.num_tickets}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Total vendido</span>
              <p className="text-xl font-bold text-green-600">{resumen.total_vendido.toFixed(2)}€</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Ticket medio</span>
              <p className="text-xl font-bold text-gray-800">{resumen.ticket_medio.toFixed(2)}€</p>
            </div>
            {resumen.por_categoria.map((cat) => (
              <div key={cat.categoria}>
                <span className="text-xs text-gray-500">{cat.categoria}</span>
                <p className="text-sm font-medium text-gray-700">
                  {cat.total.toFixed(2)}€ ({cat.cantidad})
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal historial */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg">Historial de Tickets</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {ticketsHoy.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No hay tickets</p>
              ) : (
                <div className="space-y-3">
                  {ticketsHoy.map((t) => {
                    const items = parseTicketItems(t.items);
                    return (
                      <div key={t.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800">
                            {t.fecha} {t.hora}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-green-600">{t.total.toFixed(2)}€</span>
                            <button
                              onClick={() => handleDeleteTicket(t.id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {t.tipo_venta && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            {TIPO_VENTA_OPTIONS.find((o) => o.value === t.tipo_venta)?.label || t.tipo_venta}
                          </span>
                        )}
                        <div className="mt-1 text-xs text-gray-500">
                          {items.map((it, i) => (
                            <span key={i}>
                              {it.cantidad}x {it.nombre}
                              {i < items.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
