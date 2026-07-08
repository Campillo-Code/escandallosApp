import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChefHat, Users, ShoppingCart, AlertTriangle, TrendingDown, TrendingUp, Package, Receipt } from "lucide-react";

interface DashboardData {
  total_recetas: number;
  total_ingredientes: number;
  total_proveedores: number;
  food_cost_medio: number | null;
  receta_mas_rentable: string | null;
  ingrediente_mas_caro: string | null;
  alertas_stock_bajo: string[];
  ultimos_albaranes: string[];
}

interface ContabilidadData {
  total_ingresos: number;
  margen_bruto_euros: number;
  margen_bruto_porcentaje: number;
  num_platos_vendidos: number;
  ticket_medio: number;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [contabilidad, setContabilidad] = useState<ContabilidadData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      invoke<DashboardData>("get_dashboard_data").catch(() => null),
      invoke<ContabilidadData>("get_contabilidad", { fechaDesde: null, fechaHasta: null }).catch(() => null),
    ]).then(([dash, contab]) => {
      setData(dash);
      setContabilidad(contab);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Cargando dashboard...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ChefHat size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Escandallos</p>
              <p className="text-2xl font-bold text-gray-800">{data?.total_recetas ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ingredientes</p>
              <p className="text-2xl font-bold text-gray-800">{data?.total_ingredientes ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users size={24} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Proveedores</p>
              <p className="text-2xl font-bold text-gray-800">{data?.total_proveedores ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${data?.food_cost_medio != null && data.food_cost_medio <= 30 ? "bg-green-100" : data?.food_cost_medio != null && data.food_cost_medio <= 35 ? "bg-yellow-100" : "bg-red-100"}`}>
              <TrendingDown size={24} className={data?.food_cost_medio != null && data.food_cost_medio <= 30 ? "text-green-600" : data?.food_cost_medio != null && data.food_cost_medio <= 35 ? "text-yellow-600" : "text-red-600"} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Food Cost Medio</p>
              <p className="text-2xl font-bold text-gray-800">
                {data?.food_cost_medio != null ? `${data.food_cost_medio.toFixed(1)}%` : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contabilidad KPIs */}
      {contabilidad && contabilidad.num_platos_vendidos > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Receipt size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ingresos totales</p>
                <p className="text-2xl font-bold text-gray-800">{contabilidad.total_ingresos.toFixed(2)}€</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Margen bruto</p>
                <p className="text-2xl font-bold text-green-600">{contabilidad.margen_bruto_euros.toFixed(2)}€</p>
                <p className="text-xs text-gray-400">{contabilidad.margen_bruto_porcentaje.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingCart size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ticket medio</p>
                <p className="text-2xl font-bold text-gray-800">{contabilidad.ticket_medio.toFixed(2)}€</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Package size={24} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Platos vendidos</p>
                <p className="text-2xl font-bold text-gray-800">{contabilidad.num_platos_vendidos}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rankings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Rankings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-green-600" />
                <span className="text-sm font-medium">Escandallo más rentable</span>
              </div>
              <span className="text-sm font-bold text-green-700">{data?.receta_mas_rentable ?? "N/A"}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingDown size={18} className="text-red-600" />
                <span className="text-sm font-medium">Ingrediente más caro</span>
              </div>
              <span className="text-sm font-bold text-red-700">{data?.ingrediente_mas_caro ?? "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Alertas de Stock Bajo</h3>
          {(!data?.alertas_stock_bajo || data.alertas_stock_bajo.length === 0) ? (
            <p className="text-gray-500 text-sm">No hay alertas de stock bajo</p>
          ) : (
            <div className="space-y-2">
              {data.alertas_stock_bajo.map((alerta, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
                  <AlertTriangle size={16} className="text-yellow-600" />
                  <span className="text-sm">{alerta}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Albaranes */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Últimos Albaranes</h3>
          {(!data?.ultimos_albaranes || data.ultimos_albaranes.length === 0) ? (
            <p className="text-gray-500 text-sm">No hay albaranes registrados</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.ultimos_albaranes.map((albaran, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <ShoppingCart size={16} className="text-gray-600" />
                  <span className="text-sm">{albaran}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
