import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DateInput from "../components/DateInput";

interface DesglosePlato {
  plato_nombre: string;
  ingresos: number;
  costes: number;
  margen_bruto: number;
  margen_porcentaje: number;
  unidades_vendidas: number;
}

interface ContabilidadData {
  total_ingresos: number;
  total_costes_cogs: number;
  margen_bruto_euros: number;
  margen_bruto_porcentaje: number;
  beneficio_bruto: number;
  beneficio_neto: number;
  num_platos_vendidos: number;
  ticket_medio: number;
  desglose_por_plato: DesglosePlato[];
}

export default function Contabilidad() {
  const [data, setData] = useState<ContabilidadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split("T")[0]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await invoke<ContabilidadData>("get_contabilidad", { fechaDesde: fechaDesde, fechaHasta: fechaHasta });
      setData(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [fechaDesde, fechaHasta]);

  const chartData = data?.desglose_por_plato.map(d => ({
    name: d.plato_nombre.length > 15 ? d.plato_nombre.substring(0, 15) + "..." : d.plato_nombre,
    ingresos: d.ingresos,
    costes: d.costes,
    margen: d.margen_bruto,
  })) || [];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Contabilidad</h2>

      <div className="flex items-center gap-4 mb-6">
        <DateInput value={fechaDesde} onChange={setFechaDesde} label="Desde" />
        <DateInput value={fechaHasta} onChange={setFechaHasta} label="Hasta" />
      </div>

      {loading ? <div className="text-center text-gray-500 py-12">Cargando datos...</div> :
        !data || data.desglose_por_plato.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No hay datos de ventas en este periodo. Importa datos desde el módulo de Ventas.</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 mb-1">Total Ingresos</p>
                <p className="text-xl font-bold text-gray-800">{data.total_ingresos.toFixed(2)}€</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 mb-1">Costes COGS</p>
                <p className="text-xl font-bold text-red-600">{data.total_costes_cogs.toFixed(2)}€</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 mb-1">Margen Bruto</p>
                <p className="text-xl font-bold text-green-600">{data.margen_bruto_euros.toFixed(2)}€</p>
                <p className={`text-sm ${data.margen_bruto_porcentaje >= 60 ? "text-green-600" : data.margen_bruto_porcentaje >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                  {data.margen_bruto_porcentaje.toFixed(1)}%
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 mb-1">Beneficio Bruto</p>
                <p className="text-xl font-bold text-blue-600">{data.beneficio_bruto.toFixed(2)}€</p>
                <p className="text-xs text-gray-400">= Margen Bruto (sin costes fijos)</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 mb-1">Beneficio Neto</p>
                <p className="text-xl font-bold text-blue-600">{data.beneficio_neto.toFixed(2)}€</p>
                <p className="text-xs text-gray-400">= Beneficio Bruto (sin costes fijos)</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 mb-1">Ticket Medio</p>
                <p className="text-xl font-bold text-gray-800">{data.ticket_medio.toFixed(2)}€</p>
                <p className="text-xs text-gray-400">{data.num_platos_vendidos} platos vendidos</p>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Ingresos vs Costes por Plato</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(2)}€`]} contentStyle={{ borderRadius: "8px" }} />
                  <Bar dataKey="ingresos" fill="#3b82f6" name="Ingresos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costes" fill="#ef4444" name="Costes" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="margen" fill="#22c55e" name="Margen Bruto" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detail Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Plato</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Uds.</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Ingresos</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Costes</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Margen Bruto €</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Margen Bruto %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.desglose_por_plato.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{d.plato_nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{d.unidades_vendidas}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{d.ingresos.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-sm text-red-600 text-right">{d.costes.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-sm font-medium text-right">
                        <span className={d.margen_bruto >= 0 ? "text-green-600" : "text-red-600"}>
                          {d.margen_bruto.toFixed(2)}€
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-medium ${d.margen_porcentaje >= 60 ? "text-green-600" : d.margen_porcentaje >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                          {d.margen_porcentaje.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold">Total</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">{data.num_platos_vendidos}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">{data.total_ingresos.toFixed(2)}€</td>
                    <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">{data.total_costes_cogs.toFixed(2)}€</td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">{data.margen_bruto_euros.toFixed(2)}€</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">{data.margen_bruto_porcentaje.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
    </div>
  );
}
