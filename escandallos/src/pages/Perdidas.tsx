import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TrendingDown, Plus, X, Trash2 } from "lucide-react";
import SearchableSelect from "../components/SearchableSelect";
import DateInput from "../components/DateInput";

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
  receta_id: number | null;
}

interface FilaPlato {
  uid: number;
  plato_id: number;
  nombre: string;
  hechas: string;
  precio: string;
  coste: string;
  sueltas: string;
  enMenu: string;
}

interface FilaMenu {
  nombre: string;
  precio: string;
  coste: string;
  ud: string;
}

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const num = (s: string) => {
  const v = parseFloat(String(s).replace(",", "."));
  return isNaN(v) ? 0 : v;
};

export default function Perdidas() {
  const [fecha, setFecha] = useState(hoyISO());
  const [categorias, setCategorias] = useState<CajaCategoria[]>([]);
  const [platos, setPlatos] = useState<PlatoCaja[]>([]);
  const [filas, setFilas] = useState<FilaPlato[]>([]);
  const [menu, setMenu] = useState<FilaMenu | null>(null);
  const [cargandoCoste, setCargandoCoste] = useState(false);
  const uidRef = useRef(0);

  useEffect(() => {
    Promise.all([
      invoke<CajaCategoria[]>("get_caja_categorias").then(cs => setCategorias(cs.filter(c => c.activa))),
      invoke<PlatoCaja[]>("get_platos_caja", { categoriaId: null }).then(ps => setPlatos(ps.filter(p => p.activo))),
    ]).catch(e => console.error(e));
  }, []);

  // Menú de la planificación del día elegido
  useEffect(() => {
    let cancelado = false;
    if (platos.length === 0) return;
    setMenu(null);
    invoke<any[]>("get_menu_del_dia", { fecha })
      .then(async filasMenu => {
        if (cancelado || !filasMenu || filasMenu.length === 0) return;
        const m = filasMenu[0];
        const partes = [m.primero_id, m.segundo_id, m.postre_id].filter((x): x is number => !!x);
        if (partes.length === 0) return;
        const platosDelMenu = partes
          .map(id => platos.find(p => p.id === id))
          .filter((p): p is PlatoCaja => !!p);
        if (platosDelMenu.length === 0) return;

        let coste = 0;
        let todosConReceta = platosDelMenu.length === partes.length;
        for (const p of platosDelMenu) {
          if (!p.receta_id) { todosConReceta = false; break; }
          try {
            const c = await invoke<{ coste_porcion: number }>("get_receta_coste", { recetaId: p.receta_id });
            coste += c.coste_porcion;
          } catch { todosConReceta = false; break; }
        }
        if (cancelado) return;
        setMenu({
          nombre: `Menú: ${platosDelMenu.map(p => p.nombre).join(" + ")}`,
          precio: String(m.precio_base ?? 0),
          coste: todosConReceta ? coste.toFixed(2) : "",
          ud: "",
        });
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [fecha, platos]);

  const añadirPlato = async (platoId: number) => {
    const plato = platos.find(p => p.id === platoId);
    if (!plato) return;
    const cat = categorias.find(c => c.id === plato.categoria_id);
    const precio = (cat?.precio || 0) + (plato.plus || 0);
    const uid = ++uidRef.current;
    setFilas(prev => [...prev, {
      uid,
      plato_id: plato.id,
      nombre: `${cat?.nombre ?? ""} — ${plato.nombre}`,
      hechas: "1",
      precio: precio.toFixed(2),
      coste: "",
      sueltas: "0",
      enMenu: "0",
    }]);
    if (plato.receta_id) {
      setCargandoCoste(true);
      try {
        const c = await invoke<{ coste_porcion: number }>("get_receta_coste", { recetaId: plato.receta_id });
        setFilas(prev => prev.map(f => (f.uid === uid && f.coste === "" ? { ...f, coste: c.coste_porcion.toFixed(2) } : f)));
      } catch (e) {
        console.error("Error coste:", e);
      } finally {
        setCargandoCoste(false);
      }
    }
  };

  const actualizar = (uid: number, patch: Partial<FilaPlato>) =>
    setFilas(prev => prev.map(f => (f.uid === uid ? { ...f, ...patch } : f)));

  const quitarFila = (uid: number) => setFilas(prev => prev.filter(f => f.uid !== uid));

  const noVendidas = (f: FilaPlato) => num(f.hechas) - num(f.sueltas) - num(f.enMenu);
  const ingresosFila = (f: FilaPlato) => num(f.sueltas) * num(f.precio);
  const desperdicioFila = (f: FilaPlato) => {
    const nv = noVendidas(f);
    return nv > 0 ? nv * num(f.coste) : 0;
  };

  const ingresosPlatos = filas.reduce((s, f) => s + ingresosFila(f), 0);
  const ingresosMenu = menu ? num(menu.ud) * num(menu.precio) : 0;
  const ingresosTotales = ingresosPlatos + ingresosMenu;
  const costeProducido = filas.reduce((s, f) => s + num(f.hechas) * num(f.coste), 0);
  const desperdicioTotal = filas.reduce((s, f) => s + desperdicioFila(f), 0);
  const resultado = ingresosTotales - costeProducido;
  const sinCoste = filas.filter(f => !f.coste.trim()).length;
  const beneficioMenu = menu ? num(menu.ud) * num(menu.precio) - num(menu.ud) * num(menu.coste) : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <TrendingDown size={28} /> Pérdidas
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Día</span>
          <DateInput value={fecha} onChange={setFecha} />
        </div>
      </div>

      {/* Platos */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Platos del día</h3>
          <div className="w-72">
            <SearchableSelect
              options={platos.map(p => {
                const cat = categorias.find(c => c.id === p.categoria_id);
                return { value: p.id, label: `${cat?.nombre ?? ""} — ${p.nombre}` };
              })}
              value={0}
              onChange={(val) => { if (val) añadirPlato(val); }}
              placeholder="Añadir plato..."
            />
          </div>
        </div>
        {cargandoCoste && <p className="text-xs text-blue-600 mb-2">Calculando coste...</p>}

        {filas.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            Sin platos — añade los que quieras simular para este día
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-2 py-2 text-xs font-medium text-gray-600">Plato</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-600">Hechas</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-600">Precio €</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-600" title="Coste por ración (escandallo, editable)">Coste/rac €</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-600">Vend. sueltas</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-600">Vend. menú</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-600">No vend.</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-600">Ingresos €</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-gray-600" title="No vendidas × coste por ración">Desperdicio €</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map(f => {
                  const nv = noVendidas(f);
                  return (
                    <tr key={f.uid} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 text-sm font-medium text-gray-800 max-w-[220px] truncate" title={f.nombre}>{f.nombre}</td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" min="0" value={f.hechas} onChange={e => actualizar(f.uid, { hechas: e.target.value })}
                          className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-right" />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" step="0.01" min="0" value={f.precio} onChange={e => actualizar(f.uid, { precio: e.target.value })}
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-right" />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" step="0.01" min="0" value={f.coste} onChange={e => actualizar(f.uid, { coste: e.target.value })}
                          placeholder="sin receta"
                          className={`w-20 border rounded px-2 py-1 text-sm text-right ${f.coste.trim() ? "border-gray-200" : "border-red-300 bg-red-50"}`} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" min="0" value={f.sueltas} onChange={e => actualizar(f.uid, { sueltas: e.target.value })}
                          className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-right" />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" min="0" value={f.enMenu} onChange={e => actualizar(f.uid, { enMenu: e.target.value })}
                          className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-right" />
                      </td>
                      <td className={`px-2 py-1.5 text-sm text-right font-medium ${nv > 0 ? "text-red-600" : nv < 0 ? "text-blue-500" : "text-gray-500"}`}>
                        {nv}
                      </td>
                      <td className="px-2 py-1.5 text-sm text-right font-mono">{ingresosFila(f).toFixed(2)}</td>
                      <td className={`px-2 py-1.5 text-sm text-right font-mono font-semibold ${desperdicioFila(f) > 0 ? "text-amber-600" : "text-gray-400"}`}>
                        {desperdicioFila(f).toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => quitarFila(f.uid)} className="text-red-400 hover:text-red-600" title="Quitar">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Menú del día */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Menú vendido</h3>
          {!menu && (
            <button onClick={() => setMenu({ nombre: "Menú (manual)", precio: "", coste: "", ud: "" })}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
              <Plus size={16} /> Añadir menú a mano
            </button>
          )}
        </div>
        {!menu ? (
          <p className="text-sm text-gray-400">
            No hay menú en la planificación de este día (o está cerrado) — puedes añadirlo a mano si vendiste menús
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-64">
              <label className="block text-xs text-gray-500 mb-1">Menú (rellenado de la planificación)</label>
              <input value={menu.nombre} onChange={e => setMenu({ ...menu, nombre: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ud. vendidas</label>
              <input type="number" min="0" value={menu.ud} onChange={e => setMenu({ ...menu, ud: e.target.value })}
                className="w-24 border border-gray-200 rounded px-3 py-2 text-sm text-right" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Precio menú €</label>
              <input type="number" step="0.01" min="0" value={menu.precio} onChange={e => setMenu({ ...menu, precio: e.target.value })}
                className="w-24 border border-gray-200 rounded px-3 py-2 text-sm text-right" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Coste menú €</label>
              <input type="number" step="0.01" min="0" value={menu.coste} onChange={e => setMenu({ ...menu, coste: e.target.value })}
                placeholder="sin coste"
                className={`w-24 border rounded px-3 py-2 text-sm text-right ${menu.coste.trim() ? "border-gray-200" : "border-red-300 bg-red-50"}`} />
            </div>
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-center">
              <div className="text-xs text-blue-600">Ingresos</div>
              <div className="font-bold text-blue-800">{ingresosMenu.toFixed(2)} €</div>
            </div>
            <div className={`rounded-lg px-3 py-2 text-center ${beneficioMenu >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              <div className="text-xs text-gray-600">Beneficio</div>
              <div className={`font-bold ${beneficioMenu >= 0 ? "text-green-700" : "text-red-600"}`}>{beneficioMenu.toFixed(2)} €</div>
            </div>
            <button onClick={() => setMenu(null)} className="text-gray-400 hover:text-red-600 pb-2" title="Quitar menú">
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Ingresos totales</div>
          <div className="text-2xl font-bold text-blue-700">{ingresosTotales.toFixed(2)} €</div>
          <div className="text-[11px] text-gray-400 mt-1">sueltas {ingresosPlatos.toFixed(2)} + menú {ingresosMenu.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Coste producido</div>
          <div className="text-2xl font-bold text-gray-800">{costeProducido.toFixed(2)} €</div>
          <div className="text-[11px] text-gray-400 mt-1">hechas × coste/ración</div>
        </div>
        <div className={`rounded-xl shadow p-4 text-center ${desperdicioTotal > 0 ? "bg-amber-50" : "bg-white"}`}>
          <div className="text-xs text-gray-500 mb-1">Desperdicio (no vendidas)</div>
          <div className={`text-2xl font-bold ${desperdicioTotal > 0 ? "text-amber-600" : "text-gray-400"}`}>{desperdicioTotal.toFixed(2)} €</div>
          <div className="text-[11px] text-gray-400 mt-1">coste hundido en unidades tiradas o regaladas</div>
        </div>
        <div className={`rounded-xl shadow p-4 text-center ${resultado >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <div className="text-xs text-gray-500 mb-1">Resultado del día</div>
          <div className={`text-2xl font-bold ${resultado >= 0 ? "text-green-700" : "text-red-600"}`}>{resultado.toFixed(2)} €</div>
          <div className="text-[11px] text-gray-400 mt-1">ingresos − coste producido</div>
        </div>
      </div>

      {sinCoste > 0 && (
        <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          ⚠ {sinCoste} plato(s) sin coste calculado — teclea su coste por ración para que entre en el coste producido y el desperdicio.
        </p>
      )}
      {filas.some(f => noVendidas(f) < 0) && (
        <p className="mt-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          ℹ Hay platos con más vendidas que hechas (negativo en "No vend.") — revisa los números.
        </p>
      )}
    </div>
  );
}
