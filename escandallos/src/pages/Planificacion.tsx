import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CalendarDays, Copy, Download, ChevronLeft, ChevronRight, Ban } from "lucide-react";
import SearchableSelect from "../components/SearchableSelect";
import DateInput from "../components/DateInput";
import { exportResumenIngredientesExcel } from "../lib/exports";

interface PlatoCaja {
  id: number;
  categoria_id: number;
  nombre: string;
  plus: number;
  receta_id: number | null;
  activo: boolean;
}

interface CajaCategoria {
  id: number;
  nombre: string;
  activa: boolean;
}

interface Suelto {
  id: number;
  plato_caja_id: number;
  nombre: string | null;
}

interface DiaPlan {
  id?: number;
  fecha: string;
  cerrado: boolean;
  primero_id: number | null;
  segundo_id: number | null;
  postre_id: number | null;
  precio_base: number;
  observaciones: string | null;
  sueltos: Suelto[];
}

interface ResumenRow {
  ingrediente_id: number;
  nombre: string | null;
  unidad_base: string | null;
  cantidad_necesaria: number;
  stock: number | null;
  falta: number;
}

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function fechaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diaVacio(fecha: string): DiaPlan {
  return {
    fecha,
    cerrado: false,
    primero_id: null,
    segundo_id: null,
    postre_id: null,
    precio_base: 12,
    observaciones: null,
    sueltos: [],
  };
}

export default function Planificacion() {
  const hoy = new Date();
  const [mes, setMes] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
  const [dias, setDias] = useState<DiaPlan[]>([]);
  const [platos, setPlatos] = useState<PlatoCaja[]>([]);
  const [categorias, setCategorias] = useState<CajaCategoria[]>([]);
  const [loading, setLoading] = useState(true);

  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [resDesde, setResDesde] = useState(fechaISO(hoy));
  const [resHasta, setResHasta] = useState(() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + 6);
    return fechaISO(d);
  });
  const [resumen, setResumen] = useState<ResumenRow[] | null>(null);
  const [calculando, setCalculando] = useState(false);

  const loadPlan = async () => {
    try {
      const data = await invoke<DiaPlan[]>("get_planificacion", { mes });
      const [anio, mesNum] = mes.split("-").map(Number);
      const ultimo = new Date(anio, mesNum, 0).getDate();
      const completo: DiaPlan[] = [];
      for (let d = 1; d <= ultimo; d++) {
        const fecha = `${mes}-${String(d).padStart(2, "0")}`;
        const existente = data.find((x) => x.fecha === fecha);
        completo.push(existente ?? diaVacio(fecha));
      }
      setDias(completo);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogo = async () => {
    try {
      const [cats, plats] = await Promise.all([
        invoke<CajaCategoria[]>("get_caja_categorias"),
        invoke<PlatoCaja[]>("get_platos_caja", { categoriaId: null }),
      ]);
      setCategorias(cats.filter((c) => c.activa));
      setPlatos(plats.filter((p) => p.activo));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadPlan();
  }, [mes]);
  useEffect(() => {
    loadCatalogo();
  }, []);

  const platosDe = (catName: string) => {
    const cat = categorias.find((c) => c.nombre.toLowerCase().includes(catName));
    if (!cat) return [];
    return platos.filter((p) => p.categoria_id === cat.id);
  };

  const guardar = async (dia: DiaPlan) => {
    try {
      const actualizado = await invoke<number>("save_planificacion_dia", {
        input: {
          fecha: dia.fecha,
          cerrado: dia.cerrado,
          primero_id: dia.primero_id,
          segundo_id: dia.segundo_id,
          postre_id: dia.postre_id,
          precio_base: dia.precio_base,
          observaciones: dia.observaciones || null,
        },
      });
      setDias((prev) => prev.map((d) => (d.fecha === dia.fecha ? { ...dia, id: actualizado } : d)));
    } catch (e) {
      alert("Error al guardar: " + e);
      loadPlan();
    }
  };

  const cambiarCampo = (fecha: string, patch: Partial<DiaPlan>) => {
    const dia = dias.find((d) => d.fecha === fecha);
    if (!dia) return;
    const nuevo = { ...dia, ...patch };
    setDias((prev) => prev.map((d) => (d.fecha === fecha ? nuevo : d)));
    guardar(nuevo);
  };

  const cambiarObservaciones = (fecha: string, texto: string) => {
    setDias((prev) => prev.map((d) => (d.fecha === fecha ? { ...d, observaciones: texto } : d)));
  };

  const guardarObservaciones = (fecha: string) => {
    const dia = dias.find((d) => d.fecha === fecha);
    if (dia) guardar(dia);
  };

  const anadirSuelto = async (fecha: string, platoId: number) => {
    if (!platoId) return;
    try {
      await invoke("add_planificacion_suelto", { fecha, platoCajaId: platoId });
      await loadPlan();
    } catch (e) {
      alert("Error al añadir suelto: " + e);
    }
  };

  const quitarSuelto = async (sueltoId: number) => {
    try {
      await invoke("delete_planificacion_suelto", { id: sueltoId });
      await loadPlan();
    } catch (e) {
      alert("Error al quitar suelto: " + e);
    }
  };

  const copiarDeAyer = async (fecha: string) => {
    const ayer = new Date(fecha);
    ayer.setDate(ayer.getDate() - 1);
    try {
      await invoke("copiar_planificacion_dia", {
        fechaOrigen: fechaISO(ayer),
        fechaDestino: fecha,
      });
      await loadPlan();
    } catch (e) {
      alert("Error al copiar: " + e);
    }
  };

  const calcularResumen = async () => {
    setCalculando(true);
    try {
      const data = await invoke<ResumenRow[]>("get_resumen_ingredientes", {
        fechaDesde: resDesde,
        fechaHasta: resHasta,
      });
      setResumen(data);
    } catch (e) {
      alert("Error al calcular: " + e);
    } finally {
      setCalculando(false);
    }
  };

  const platosSinReceta = () => {
    let n = 0;
    for (const d of dias) {
      if (d.cerrado) continue;
      for (const pid of [d.primero_id, d.segundo_id, d.postre_id, ...d.sueltos.map((s) => s.plato_caja_id)]) {
        if (pid) {
          const p = platos.find((x) => x.id === pid);
          if (p && !p.receta_id) n++;
        }
      }
    }
    return n;
  };

  const nombreMes = (m: string) => {
    const [a, mesNum] = m.split("-").map(Number);
    const nombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${nombres[mesNum - 1]} ${a}`;
  };

  const cambiarMes = (delta: number) => {
    const [a, m] = mes.split("-").map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const fmt = (n: number | null) => (n == null ? "—" : n % 1 === 0 ? n.toFixed(0) : n.toFixed(3));

  if (loading) return <div className="p-6 text-center text-gray-500">Cargando...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarDays size={28} /> Planificación de menú
        </h2>
        <button
          onClick={() => setMostrarResumen(!mostrarResumen)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
        >
          <Download size={18} /> Ingredientes necesarios
        </button>
      </div>

      {mostrarResumen && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <DateInput value={resDesde} onChange={setResDesde} label="Desde" />
            <DateInput value={resHasta} onChange={setResHasta} label="Hasta" />
            <button onClick={calcularResumen} disabled={calculando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {calculando ? "Calculando..." : "Calcular"}
            </button>
            {resumen && resumen.length > 0 && (
              <button
                onClick={() => exportResumenIngredientesExcel(resumen, `${resDesde}_${resHasta}`)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download size={16} /> Excel
              </button>
            )}
          </div>

          {platosSinReceta() > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              ⚠ {platosSinReceta()} platos planificados no tienen receta vinculada y no se tienen en cuenta en el cálculo.
            </p>
          )}

          {resumen && (
            resumen.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No hay platos con receta planificados en ese rango (o todos los días están cerrados).
              </p>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-sm font-medium text-gray-600">Ingrediente</th>
                      <th className="text-right px-3 py-2 text-sm font-medium text-gray-600">Necesario</th>
                      <th className="text-left px-3 py-2 text-sm font-medium text-gray-600">Unidad</th>
                      <th className="text-right px-3 py-2 text-sm font-medium text-gray-600">Stock</th>
                      <th className="text-right px-3 py-2 text-sm font-medium text-gray-600">Falta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resumen.map((r) => (
                      <tr key={r.ingrediente_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-800">{r.nombre}</td>
                        <td className="px-3 py-2 text-sm text-right font-mono">{fmt(r.cantidad_necesaria)}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{r.unidad_base}</td>
                        <td className="px-3 py-2 text-sm text-right font-mono text-gray-500">{fmt(r.stock)}</td>
                        <td className={`px-3 py-2 text-sm text-right font-mono font-semibold ${r.falta > 0 ? "text-red-600" : "text-gray-400"}`}>
                          {r.falta > 0 ? fmt(r.falta) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => cambiarMes(-1)} className="p-2 rounded-lg border hover:bg-gray-50">
          <ChevronLeft size={18} />
        </button>
        <span className="text-lg font-semibold text-gray-800 min-w-44 text-center">{nombreMes(mes)}</span>
        <button onClick={() => cambiarMes(1)} className="p-2 rounded-lg border hover:bg-gray-50">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-2 py-2 text-xs font-medium text-gray-500">Sem</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">Fecha</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">Día</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left w-44">1.º</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left w-44">2.º</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left w-40">Postre</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 text-right">Menú €</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">Sueltos</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 text-left">Observaciones</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 text-center" title="Día cerrado">⬤</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-500 text-center" title="Copiar de ayer">⧉</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dias.map((dia, idx) => {
              const fecha = new Date(dia.fecha + "T00:00:00");
              const diaSemana = fecha.getDay();
              const esDomingo = diaSemana === 0;
              const opcionesPlatos = (cat: string) =>
                platosDe(cat).map((p) => ({
                  value: p.id,
                  label: `${p.nombre}${p.plus > 0 ? ` (+${p.plus.toFixed(2)}€)` : ""}${!p.receta_id ? " ⚠" : ""}`,
                }));
              const opcionesSueltos = platosDe("raci").map((p) => ({
                value: p.id,
                label: `${p.nombre}${!p.receta_id ? " ⚠" : ""}`,
              }));
              return (
                <tr key={dia.fecha} className={`${dia.cerrado ? "opacity-50 bg-gray-50" : esDomingo ? "bg-orange-50/50" : ""} hover:bg-gray-50`}>
                  <td className="px-2 py-1.5 text-xs text-gray-400 text-center align-top">{idx === 0 || new Date(dias[idx - 1].fecha + "T00:00:00").getDay() === 0 ? isoWeek(fecha) : ""}</td>
                  <td className="px-2 py-1.5 text-sm text-gray-600 whitespace-nowrap align-top">
                    {fecha.getDate()}/{fecha.getMonth() + 1}
                  </td>
                  <td className="px-2 py-1.5 text-sm font-medium text-gray-800 whitespace-nowrap align-top">
                    {DIAS_CORTOS[diaSemana]}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <SearchableSelect options={opcionesPlatos("primero")} value={dia.primero_id ?? 0}
                      onChange={(v) => !dia.cerrado && cambiarCampo(dia.fecha, { primero_id: v || null })}
                      placeholder="—" />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <SearchableSelect options={opcionesPlatos("segundo")} value={dia.segundo_id ?? 0}
                      onChange={(v) => !dia.cerrado && cambiarCampo(dia.fecha, { segundo_id: v || null })}
                      placeholder="—" />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <SearchableSelect options={opcionesPlatos("postre")} value={dia.postre_id ?? 0}
                      onChange={(v) => !dia.cerrado && cambiarCampo(dia.fecha, { postre_id: v || null })}
                      placeholder="—" />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input type="number" step="0.5" min="0" value={dia.precio_base} disabled={dia.cerrado}
                      onChange={(e) => cambiarCampo(dia.fecha, { precio_base: parseFloat(e.target.value) || 0 })}
                      className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-right disabled:bg-transparent" />
                  </td>
                  <td className="px-2 py-1.5 align-top min-w-52">
                    <div className="flex flex-wrap gap-1 items-center">
                      {dia.sueltos.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 text-xs">
                          {s.nombre ?? `#${s.plato_caja_id}`}
                          {!dia.cerrado && (
                            <button onClick={() => quitarSuelto(s.id)} className="text-blue-400 hover:text-red-600 font-bold">×</button>
                          )}
                        </span>
                      ))}
                      {!dia.cerrado && (
                        <SearchableSelect options={[{ value: 0, label: "+ suelto" }, ...opcionesSueltos]}
                          value={0} onChange={(v) => anadirSuelto(dia.fecha, v)} placeholder="+ suelto" className="w-32" />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input value={dia.observaciones ?? ""} disabled={dia.cerrado}
                      onChange={(e) => cambiarObservaciones(dia.fecha, e.target.value)}
                      onBlur={() => guardarObservaciones(dia.fecha)}
                      placeholder="—"
                      className="w-full min-w-40 border border-gray-200 rounded px-2 py-1 text-xs disabled:bg-transparent" />
                  </td>
                  <td className="px-2 py-1.5 text-center align-top">
                    <button
                      onClick={() => cambiarCampo(dia.fecha, { cerrado: !dia.cerrado })}
                      title={dia.cerrado ? "Día cerrado (pulsa para abrir)" : "Marcar como cerrado"}
                      className={`rounded p-1 ${dia.cerrado ? "text-red-600 bg-red-50" : "text-gray-300 hover:text-red-500"}`}
                    >
                      <Ban size={16} />
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-center align-top">
                    {idx > 0 && !dia.cerrado && (
                      <button onClick={() => copiarDeAyer(dia.fecha)} title="Copiar menú y sueltos de ayer"
                        className="text-gray-300 hover:text-blue-600 p-1">
                        <Copy size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Los cambios se guardan automáticamente. ⚠ = plato sin receta vinculada. El menú guardado aquí es el que usa la Caja.
        Los días cerrados no aparecen en la Caja ni en el cálculo de ingredientes.
      </p>
    </div>
  );
}
