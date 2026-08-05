import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShoppingCart, Trash2, X, Clock, TrendingUp, FileText } from "lucide-react";

interface CajaCategoria {
  id: number;
  nombre: string;
  precio: number;
  plus: number;
  orden: number;
  activa: boolean;
}

interface PlatoCaja {
  id: number;
  categoria_id: number;
  nombre: string;
  activo: boolean;
}

interface TicketItem {
  categoria: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

interface CajaTicket {
  id: number;
  fecha: string;
  hora: string;
  total: number;
  items: string;
  notas: string | null;
  metodo_pago: string | null;
}

interface CajaResumen {
  total_vendido: number;
  num_tickets: number;
  ticket_medio: number;
  por_categoria: { categoria: string; total: number; cantidad: number }[];
}

export default function Caja() {
  const [categorias, setCategorias] = useState<CajaCategoria[]>([]);
  const [platos, setPlatos] = useState<PlatoCaja[]>([]);
  const [ticket, setTicket] = useState<TicketItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<CajaCategoria | null>(null);
  const [selectedPlato, setSelectedPlato] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [usePlus, setUsePlus] = useState(false);
  const [notas, setNotas] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [resumen, setResumen] = useState<CajaResumen | null>(null);
  const [ticketsHoy, setTicketsHoy] = useState<CajaTicket[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState("");

  const getLocalDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  // Menu state
  const [menuPrimero, setMenuPrimero] = useState("");
  const [menuSegundo, setMenuSegundo] = useState("");
  const [menuPostre, setMenuPostre] = useState("");
  const [menuBebida, setMenuBebida] = useState("");

  const loadCategorias = async () => {
    try {
      const data = await invoke<CajaCategoria[]>("get_caja_categorias");
      setCategorias(data.filter(c => c.activa));
    } catch (e) { setError(String(e)); }
  };

  const loadResumen = async () => {
    try {
      const data = await invoke<CajaResumen>("get_caja_resumen", { fecha: null });
      setResumen(data);
    } catch (e) {
      console.error("[Caja] Error cargando resumen:", e);
      setError("Error resumen: " + String(e));
    }
  };

  const loadTicketsHoy = async () => {
    try {
      const hoy = getLocalDate();
      console.log("[Caja] Cargando tickets del día:", hoy);
      const data = await invoke<CajaTicket[]>("get_caja_tickets", { fechaDesde: hoy, fechaHasta: hoy });
      console.log("[Caja] Tickets obtenidos:", data.length, data);
      setTicketsHoy(data);
    } catch (e) { console.error("[Caja] Error cargando tickets:", e); setError("Error cargando historial: " + String(e)); }
  };

  useEffect(() => {
    loadCategorias();
    loadResumen();
    loadTicketsHoy();
  }, []);

  const loadPlatos = async (catId: number) => {
    try {
      const data = await invoke<PlatoCaja[]>("get_platos_caja", { categoriaId: catId });
      setPlatos(data);
    } catch (e) { console.error(e); }
  };

  const isMenu = (cat: CajaCategoria) => cat.nombre.toLowerCase().includes("men");

  const openAddModal = (cat: CajaCategoria) => {
    setSelectedCategoria(cat);
    setSelectedPlato("");
    setCantidad(1);
    setUsePlus(false);
    setMenuPrimero("");
    setMenuSegundo("");
    setMenuPostre("");
    setMenuBebida("");
    setShowAddModal(true);
    loadPlatos(cat.id);
  };

  const getPrecio = () => {
    if (!selectedCategoria) return 0;
    return selectedCategoria.precio + (usePlus ? selectedCategoria.plus : 0);
  };

  const addItem = () => {
    if (!selectedCategoria) return;

    if (isMenu(selectedCategoria)) {
      // Menú: add 4 items (primero, segundo, postre, optionally bebida)
      const precio = selectedCategoria.precio;
      const items: TicketItem[] = [];
      const catName = selectedCategoria.nombre;

      if (menuPrimero) {
        const p = platos.find(p => p.id === Number(menuPrimero));
        items.push({ categoria: catName, descripcion: `Primero: ${p?.nombre ?? ""}`, cantidad: 1, precio_unitario: 0, subtotal: 0 });
      }
      if (menuSegundo) {
        const p = platos.find(p => p.id === Number(menuSegundo));
        items.push({ categoria: catName, descripcion: `Segundo: ${p?.nombre ?? ""}`, cantidad: 1, precio_unitario: 0, subtotal: 0 });
      }
      if (menuPostre) {
        const p = platos.find(p => p.id === Number(menuPostre));
        items.push({ categoria: catName, descripcion: `Postre: ${p?.nombre ?? ""}`, cantidad: 1, precio_unitario: 0, subtotal: 0 });
      }
      if (menuBebida) {
        const p = platos.find(p => p.id === Number(menuBebida));
        items.push({ categoria: catName, descripcion: `Bebida: ${p?.nombre ?? ""}`, cantidad: 1, precio_unitario: 0, subtotal: 0 });
      }

      if (items.length === 0) return;

      // First item gets the full price, rest are 0
      items[0].precio_unitario = precio;
      items[0].subtotal = precio;

      setTicket(prev => [...prev, ...items]);
    } else {
      // Regular category
      if (!selectedPlato) return;
      const p = platos.find(p => p.id === Number(selectedPlato));
      if (!p) return;
      const precio = getPrecio();
      const subtotal = precio * cantidad;
      setTicket(prev => [...prev, {
        categoria: selectedCategoria.nombre,
        descripcion: p.nombre,
        cantidad,
        precio_unitario: precio,
        subtotal,
      }]);
    }
    setShowAddModal(false);
  };

  const removeItem = (index: number) => {
    setTicket(prev => prev.filter((_, i) => i !== index));
  };

  const totalTicket = ticket.reduce((sum, item) => sum + item.subtotal, 0);

  const cobrar = async () => {
    if (ticket.length === 0) return;
    try {
      console.log("[Caja] Cobrando:", { items: ticket, total: totalTicket, notas, metodoPago });
      await invoke("create_caja_ticket", {
        input: { items: ticket, total: totalTicket, notas: notas || null, metodo_pago: metodoPago }
      });
      console.log("[Caja] Ticket creado OK");
      setTicket([]);
      setNotas("");
      setMetodoPago("efectivo");
      await loadResumen();
      await loadTicketsHoy();
    } catch (e) { console.error("[Caja] Error cobrando:", e); setError(String(e)); }
  };

  const deleteTicket = async (id: number) => {
    try {
      await invoke("delete_caja_ticket", { id });
      setShowDeleteConfirm(null);
      loadResumen();
      loadTicketsHoy();
    } catch (e) { setError(String(e)); }
  };

  const getMenuPlatos = (catName: string) => {
    const cat = categorias.find(c => c.nombre.toLowerCase().includes(catName.toLowerCase()));
    if (!cat) return [];
    return platos.filter(p => p.categoria_id === cat.id);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart size={28} /> Caja
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
            <Clock size={16} /> Historial
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
          {error} <button onClick={() => setError("")}><X size={16} /></button>
        </div>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left: Categories + Ticket items */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Category buttons */}
          <div className="grid grid-cols-4 gap-2">
            {categorias.map((cat) => (
              <button key={cat.id} onClick={() => openAddModal(cat)}
                className="relative bg-white border-2 border-gray-200 rounded-xl p-3 text-center hover:border-blue-400 hover:shadow-md transition-all group">
                <div className="font-semibold text-gray-800 text-sm group-hover:text-blue-600">{cat.nombre}</div>
                <div className="text-lg font-bold text-blue-600 mt-1">{cat.precio.toFixed(2)} €</div>
                {cat.plus > 0 && (
                  <div className="text-xs text-orange-500 mt-0.5">+ {cat.plus.toFixed(2)} €</div>
                )}
              </button>
            ))}
          </div>

          {/* Current ticket items */}
          <div className="flex-1 bg-white rounded-xl border overflow-auto">
            {ticket.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <ShoppingCart size={48} className="mx-auto mb-2 opacity-30" />
                  <p>Selecciona una categoría para empezar</p>
                </div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Categoría</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Descripción</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Uds</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Precio</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ticket.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">
                        <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{item.categoria}</span>
                      </td>
                      <td className="px-4 py-2 text-sm font-medium">{item.descripcion}</td>
                      <td className="px-4 py-2 text-sm text-center">{item.cantidad}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono">{item.precio_unitario.toFixed(2)} €</td>
                      <td className="px-4 py-2 text-sm text-right font-mono font-semibold">{item.subtotal.toFixed(2)} €</td>
                      <td className="px-2">
                        <button onClick={() => removeItem(i)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Ticket summary + Resumen */}
        <div className="w-80 flex flex-col gap-4">
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm text-gray-500 mb-2">Ticket actual</div>
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-sm text-gray-600">{ticket.length} artículos</span>
              <span className="text-3xl font-bold text-gray-800">{totalTicket.toFixed(2)} €</span>
            </div>
            <div className="mb-3">
              <input value={notas} onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas (opcional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Método de pago</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: "efectivo", label: "Efectivo" },
                  { id: "tarjeta", label: "Tarjeta" },
                  { id: "qr", label: "QR" },
                ].map(m => (
                  <button key={m.id} onClick={() => setMetodoPago(m.id)}
                    className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      metodoPago === m.id
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={cobrar} disabled={ticket.length === 0}
              className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-lg">
              Cobrar {totalTicket.toFixed(2)} €
            </button>
            {ticket.length > 0 && (
              <button onClick={() => { setTicket([]); setNotas(""); }}
                className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors">
                Cancelar ticket
              </button>
            )}
          </div>

          {resumen && (
            <div className="bg-white rounded-xl border p-4 flex-1 overflow-auto">
              <div className="text-sm text-gray-500 mb-3 flex items-center gap-1"><TrendingUp size={14} /> Resumen hoy</div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-700">{resumen.total_vendido.toFixed(2)} €</div>
                  <div className="text-xs text-blue-500">Total</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-700">{resumen.num_tickets}</div>
                  <div className="text-xs text-green-500">Tickets</div>
                </div>
                <div className="col-span-2 bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold text-gray-700">{resumen.ticket_medio.toFixed(2)} € ticket medio</div>
                </div>
              </div>
              {resumen.por_categoria.length > 0 && (
                <div className="space-y-1">
                  {resumen.por_categoria.map((cat, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-600">{cat.categoria} ×{cat.cantidad}</span>
                      <span className="font-mono font-medium">{cat.total.toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add item modal */}
      {showAddModal && selectedCategoria && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{selectedCategoria.nombre}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {isMenu(selectedCategoria) ? (
                <>
                  <p className="text-sm text-gray-500">Selecciona los platos del menú:</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primero *</label>
                    <select value={menuPrimero} onChange={(e) => setMenuPrimero(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="">Seleccionar...</option>
                      {getMenuPlatos("primero").map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Segundo *</label>
                    <select value={menuSegundo} onChange={(e) => setMenuSegundo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="">Seleccionar...</option>
                      {getMenuPlatos("segundo").map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postre *</label>
                    <select value={menuPostre} onChange={(e) => setMenuPostre(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="">Seleccionar...</option>
                      {getMenuPlatos("postre").map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bebida (opcional)</label>
                    <select value={menuBebida} onChange={(e) => setMenuBebida(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="">Ninguna</option>
                      {getMenuPlatos("bebida").map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    Precio: <span className="font-bold text-gray-800">{selectedCategoria.precio.toFixed(2)} €</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selecciona plato *</label>
                    <select value={selectedPlato} onChange={(e) => setSelectedPlato(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="">Seleccionar plato...</option>
                      {platos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    {platos.length === 0 && (
                      <p className="text-xs text-orange-500 mt-1">No hay platos en esta categoría. Añádelos en Precios Caja → Platos.</p>
                    )}
                  </div>

                  {selectedCategoria.plus > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <input type="checkbox" id="usePlus" checked={usePlus} onChange={(e) => setUsePlus(e.target.checked)}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                      <label htmlFor="usePlus" className="text-sm">
                        <span className="font-medium text-orange-800">Con Plus</span>
                        <span className="text-orange-600 ml-1">(+{selectedCategoria.plus.toFixed(2)} €)</span>
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                          className="px-3 py-2 hover:bg-gray-100 text-lg font-bold">−</button>
                        <span className="flex-1 text-center font-semibold text-lg">{cantidad}</span>
                        <button onClick={() => setCantidad(cantidad + 1)}
                          className="px-3 py-2 hover:bg-gray-100 text-lg font-bold">+</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                      <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                        <span className="font-mono font-bold text-lg text-blue-600">{getPrecio().toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-sm text-gray-500">
                    Subtotal: <span className="font-bold text-gray-800">{(getPrecio() * cantidad).toFixed(2)} €</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={addItem}
                disabled={isMenu(selectedCategoria) ? (!menuPrimero && !menuSegundo && !menuPostre) : !selectedPlato}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 font-medium">
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2"><FileText size={20} /> Tickets de hoy</h2>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {ticketsHoy.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No hay tickets hoy</p>
              ) : (
                <div className="space-y-3">
                  {ticketsHoy.map((ticket) => {
                    const items: TicketItem[] = JSON.parse(ticket.items);
                    return (
                      <div key={ticket.id} className="border rounded-xl p-4 hover:shadow-sm transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-sm text-gray-500">{ticket.hora}</span>
                            <span className="ml-2 font-bold text-lg">{ticket.total.toFixed(2)} €</span>
                            {ticket.metodo_pago && ticket.metodo_pago !== "efectivo" && (
                              <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                ticket.metodo_pago === "tarjeta" ? "bg-purple-100 text-purple-700" :
                                ticket.metodo_pago === "qr" ? "bg-cyan-100 text-cyan-700" :
                                "bg-gray-100 text-gray-700"
                              }`}>
                                {ticket.metodo_pago === "tarjeta" ? "💳 Tarjeta" : ticket.metodo_pago === "qr" ? "📱 QR" : ticket.metodo_pago}
                              </span>
                            )}
                          </div>
                          <button onClick={() => setShowDeleteConfirm(ticket.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs mr-1">{item.categoria}</span>
                                {item.descripcion} ×{item.cantidad}
                              </span>
                              <span className="font-mono">{item.subtotal.toFixed(2)} €</span>
                            </div>
                          ))}
                        </div>
                        {ticket.notas && (
                          <div className="mt-2 text-xs text-gray-400 italic">📝 {ticket.notas}</div>
                        )}
                        {showDeleteConfirm === ticket.id && (
                          <div className="mt-3 flex gap-2 justify-end">
                            <button onClick={() => setShowDeleteConfirm(null)} className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
                            <button onClick={() => deleteTicket(ticket.id)} className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Eliminar</button>
                          </div>
                        )}
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
