import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import DateInput from "../components/DateInput";

interface MenuItem {
  plato_nombre: string;
  receta_id: number | null;
  unidades_vendidas: number;
  margen_porcentaje: number;
  margen_euros: number;
  coste_porcion: number;
  precio_venta: number;
  categoria: string;
}

const COLORS: Record<string, string> = { estrella: "#22c55e", vaca: "#3b82f6", enigma: "#eab308", perro: "#ef4444" };
const LABELS: Record<string, string> = { estrella: "⭐ Estrella", vaca: "🐄 Vaca", enigma: "🔮 Enigma", perro: "🐕 Perro" };

export default function MenuEngineering() {
  const [data, setData] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fechaDesde, setFechaDesde] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; });
  const [fechaHasta, setFechaHasta] = useState(() => { const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await invoke<MenuItem[]>("get_menu_engineering", { fechaDesde: fechaDesde, fechaHasta: fechaHasta });
      setData(result);
    } catch (e) { console.error(e); setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [fechaDesde, fechaHasta]);

  const counts = { estrella: 0, vaca: 0, enigma: 0, perro: 0 };
  data.forEach(d => { counts[d.categoria as keyof typeof counts]++; });

  const maxX = Math.max(...data.map(d => d.unidades_vendidas), 10);
  const maxY = Math.max(...data.map(d => d.margen_porcentaje), 40);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Menu Engineering</h2>

      <div className="flex items-center gap-4 mb-6">
        <DateInput value={fechaDesde} onChange={setFechaDesde} label="Desde" />
        <DateInput value={fechaHasta} onChange={setFechaHasta} label="Hasta" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <p className="text-sm text-gray-500">⭐ Estrellas</p>
          <p className="text-2xl font-bold text-green-600">{counts.estrella}</p>
          <p className="text-xs text-gray-400">Alto margen + Alta popularidad</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">🐄 Vacas</p>
          <p className="text-2xl font-bold text-blue-600">{counts.vaca}</p>
          <p className="text-xs text-gray-400">Bajo margen + Alta popularidad</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">🔮 Enigmas</p>
          <p className="text-2xl font-bold text-yellow-600">{counts.enigma}</p>
          <p className="text-xs text-gray-400">Alto margen + Baja popularidad</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <p className="text-sm text-gray-500">🐕 Perros</p>
          <p className="text-2xl font-bold text-red-600">{counts.perro}</p>
          <p className="text-xs text-gray-400">Bajo margen + Baja popularidad</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center text-gray-500 py-12">Cargando datos...</div>
      ) : (
        <>
          {data.length === 0 && (
            <div className="text-center text-gray-500 mb-6">No hay ventas en este periodo. Importa datos desde el módulo de Ventas.</div>
          )}

          {data.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Matriz BCG</h3>
              <div className="relative border-l-2 border-b-2 border-gray-400 ml-[50px] mr-[10px]" style={{ height: "420px" }}>
                <div className="absolute top-0 left-0 right-0 bottom-0 grid grid-cols-2 grid-rows-2">
                  <div className="border-r border-b border-gray-200" style={{ background: "linear-gradient(135deg, #fef9c3 0%, #fef08a22 100%)" }}></div>
                  <div className="border-b border-gray-200" style={{ background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d022 100%)" }}></div>
                  <div className="border-r border-gray-200" style={{ background: "linear-gradient(135deg, #fee2e2 0%, #fecaca22 100%)" }}></div>
                  <div style={{ background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe22 100%)" }}></div>
                </div>
                <div className="absolute top-3 right-3 text-xs font-bold text-green-600 opacity-30">ESTRELLA</div>
                <div className="absolute top-3 left-3 text-xs font-bold text-yellow-600 opacity-30">ENIGMA</div>
                <div className="absolute bottom-3 right-3 text-xs font-bold text-blue-600 opacity-30">VACA</div>
                <div className="absolute bottom-3 left-3 text-xs font-bold text-red-600 opacity-30">PERRO</div>
                <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-gray-400" style={{ left: "50%" }}></div>
                <div className="absolute left-0 right-0 border-t-2 border-dashed border-gray-400" style={{ top: "50%" }}></div>
                <div className="absolute -top-5 left-0 text-[10px] text-gray-500 font-medium">Alto</div>
                <div className="absolute -bottom-5 left-0 text-[10px] text-gray-500 font-medium">Bajo</div>
                <div className="absolute -bottom-5 right-0 text-[10px] text-gray-500 font-medium">Alto</div>
                <div className="absolute -top-5 right-0 text-[10px] text-gray-500 font-medium">Alto</div>
                {data.length > 0 && data.map((d, i) => {
                  const xPos = maxX > 0 ? ((maxX - d.unidades_vendidas) / maxX) * 100 : 50;
                  const yPos = maxY > 0 ? ((maxY - d.margen_porcentaje) / maxY) * 100 : 50;
                  const clampedX = Math.max(2, Math.min(95, xPos));
                  const clampedY = Math.max(2, Math.min(95, yPos));
                  const catColor = COLORS[d.categoria] || "#888";
                  return (
                    <div
                      key={i}
                      className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                      style={{ left: `${clampedX}%`, top: `${clampedY}%` }}
                    >
                      <div
                        className="px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-md whitespace-nowrap transition-transform hover:scale-110 hover:z-10"
                        style={{ backgroundColor: catColor }}
                      >
                        {d.plato_nombre}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full mt-1 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                        {d.unidades_vendidas} uds · {d.margen_porcentaje.toFixed(1)}% margen
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-6 mt-6 text-sm">
                {Object.entries(LABELS).map(([key, label]) => (
                  <span key={key} className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[key] }}></span>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Plato</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Categoría</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Uds. vendidas</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Margen %</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Margen €</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Coste/ud</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Precio venta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{d.plato_nombre}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="px-2 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: COLORS[d.categoria] }}>
                          {LABELS[d.categoria]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{d.unidades_vendidas}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-medium ${d.margen_porcentaje >= 30 ? "text-green-600" : d.margen_porcentaje >= 15 ? "text-yellow-600" : "text-red-600"}`}>
                          {d.margen_porcentaje.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{d.margen_euros.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{d.coste_porcion.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right font-medium">{d.precio_venta.toFixed(2)}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
