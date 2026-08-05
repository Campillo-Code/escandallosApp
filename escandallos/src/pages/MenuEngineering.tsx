import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, ReferenceArea } from "recharts";
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

  const chartData = data.map(d => ({
    x: d.unidades_vendidas,
    y: d.margen_porcentaje,
    z: d.precio_venta > 0 ? d.precio_venta : 1,
    nombre: d.plato_nombre,
    categoria: d.categoria,
  }));

  const sorted = [...data].sort((a, b) => a.unidades_vendidas - b.unidades_vendidas);
  const medianUnits = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)].unidades_vendidas : 0;
  const maxX = Math.max(...data.map(d => d.unidades_vendidas), medianUnits * 1.2 || 10);
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
              <h3 className="text-lg font-semibold mb-2">Matriz BCG</h3>
              <p className="text-xs text-gray-400 mb-4">Línea vertical: mediana de popularidad ({medianUnits} uds) — Línea horizontal: 30% de margen</p>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" dataKey="x" name="Unidades" domain={[0, maxX]} label={{ value: "Unidades vendidas →", position: "bottom", offset: 0 }} stroke="#6b7280" />
                  <YAxis type="number" dataKey="y" name="Margen %" domain={[0, maxY]} label={{ value: "Margen % →", angle: -90, position: "insideLeft" }} stroke="#6b7280" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value, name) => name === "x" ? [`${value} uds`, "Ventas"] : [`${Number(value).toFixed(1)}%`, "Margen"]} contentStyle={{ borderRadius: "8px" }} />
                  <ReferenceArea x1={medianUnits} x2={maxX} y1={30} y2={maxY} fill="#22c55e" fillOpacity={0.08} />
                  <ReferenceArea x1={0} x2={medianUnits} y1={30} y2={maxY} fill="#eab308" fillOpacity={0.08} />
                  <ReferenceArea x1={medianUnits} x2={maxX} y1={0} y2={30} fill="#3b82f6" fillOpacity={0.08} />
                  <ReferenceArea x1={0} x2={medianUnits} y1={0} y2={30} fill="#ef4444" fillOpacity={0.08} />
                  <ReferenceLine x={medianUnits} stroke="#9ca3af" strokeDasharray="6 3" label={{ value: "Popularidad", position: "top", fontSize: 11, fill: "#9ca3af" }} />
                  <ReferenceLine y={30} stroke="#9ca3af" strokeDasharray="6 3" label={{ value: "Margen 30%", position: "right", fontSize: 11, fill: "#9ca3af" }} />
                  <text x={((medianUnits + maxX) / 2) / maxX * 100 + "%"} y="15%" textAnchor="middle" fill="#16a34a" fontSize={12} fontWeight="bold">ESTRELLA</text>
                  <text x={((medianUnits) / 2) / maxX * 100 + "%"} y="15%" textAnchor="middle" fill="#ca8a04" fontSize={12} fontWeight="bold">ENIGMA</text>
                  <text x={((medianUnits + maxX) / 2) / maxX * 100 + "%"} y="88%" textAnchor="middle" fill="#2563eb" fontSize={12} fontWeight="bold">VACA</text>
                  <text x={((medianUnits) / 2) / maxX * 100 + "%"} y="88%" textAnchor="middle" fill="#dc2626" fontSize={12} fontWeight="bold">PERRO</text>
                  <Scatter data={chartData} fill="#8884d8">
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={COLORS[entry.categoria]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4 text-sm">
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
