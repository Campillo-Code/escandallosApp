import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Calendar } from "lucide-react";
import SearchableSelect from "../components/SearchableSelect";

interface PlatoCaja {
  id: number;
  categoria_id: number;
  nombre: string;
  plus: number;
  activo: boolean;
  foto: string | null;
}

interface CajaCategoria {
  id: number;
  nombre: string;
  precio: number;
  plus: number;
  orden: number;
  activa: boolean;
}

interface MenuDelDia {
  id: number;
  fecha: string;
  primero_id: number | null;
  segundo_id: number | null;
  postre_id: number | null;
  precio_base: number;
}

export default function MenuDelDia() {
  const [categorias, setCategorias] = useState<CajaCategoria[]>([]);
  const [platos, setPlatos] = useState<PlatoCaja[]>([]);
  const [menuHoy, setMenuHoy] = useState<MenuDelDia | null>(null);
  const [fecha, setFecha] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [primeroId, setPrimeroId] = useState<number | null>(null);
  const [segundoId, setSegundoId] = useState<number | null>(null);
  const [postreId, setPostreId] = useState<number | null>(null);
  const [precioBase, setPrecioBase] = useState(12);
  const [loading, setLoading] = useState(true);

  const loadMenu = async () => {
    try {
      const data = await invoke<MenuDelDia[]>("get_menu_del_dia", { fecha });
      if (data.length > 0) {
        const menu = data[0];
        setMenuHoy(menu);
        setPrimeroId(menu.primero_id);
        setSegundoId(menu.segundo_id);
        setPostreId(menu.postre_id);
        setPrecioBase(menu.precio_base);
      } else {
        setMenuHoy(null);
        setPrimeroId(null);
        setSegundoId(null);
        setPostreId(null);
        setPrecioBase(12);
      }
    } catch (e) { console.error(e); }
  };

  const loadData = async () => {
    try {
      const [cats, plats] = await Promise.all([
        invoke<CajaCategoria[]>("get_caja_categorias"),
        invoke<PlatoCaja[]>("get_platos_caja", { categoriaId: null }),
      ]);
      setCategorias(cats.filter(c => c.activa));
      setPlatos(plats.filter(p => p.activo));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { loadMenu(); }, [fecha]);

  const getPlatosByCategoria = (catName: string) => {
    const cat = categorias.find(c => c.nombre.toLowerCase().includes(catName.toLowerCase()));
    if (!cat) return [];
    return platos.filter(p => p.categoria_id === cat.id);
  };

  const handleSave = async () => {
    try {
      await invoke("save_menu_del_dia", {
        input: {
          fecha,
          primero_id: primeroId,
          segundo_id: segundoId,
          postre_id: postreId,
          precio_base: precioBase,
        },
      });
      alert("Menú del día guardado");
      loadMenu();
    } catch (e) { alert("Error: " + e); }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Cargando...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Calendar size={28} /> Menú del Día
      </h2>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Precio base */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio base del menú (€)</label>
            <input type="number" step="0.01" min="0" value={precioBase}
              onChange={(e) => setPrecioBase(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Primero */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primero</label>
            <SearchableSelect
              options={getPlatosByCategoria("primero").map(p => ({
                value: p.id,
                label: `${p.nombre}${p.plus > 0 ? ` (+${p.plus.toFixed(2)}€)` : ""}`
              }))}
              value={primeroId || 0}
              onChange={(v) => setPrimeroId(v || null)}
              placeholder="Seleccionar primero..."
            />
          </div>

          {/* Segundo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Segundo</label>
            <SearchableSelect
              options={getPlatosByCategoria("segundo").map(p => ({
                value: p.id,
                label: `${p.nombre}${p.plus > 0 ? ` (+${p.plus.toFixed(2)}€)` : ""}`
              }))}
              value={segundoId || 0}
              onChange={(v) => setSegundoId(v || null)}
              placeholder="Seleccionar segundo..."
            />
          </div>

          {/* Postre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postre</label>
            <SearchableSelect
              options={getPlatosByCategoria("postre").map(p => ({
                value: p.id,
                label: `${p.nombre}${p.plus > 0 ? ` (+${p.plus.toFixed(2)}€)` : ""}`
              }))}
              value={postreId || 0}
              onChange={(v) => setPostreId(v || null)}
              placeholder="Seleccionar postre..."
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Guardar menú del día
          </button>
        </div>
      </div>

      {/* Resumen del menú actual */}
      {menuHoy && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-3">Menú activo para {menuHoy.fecha}</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-3 border">
              <p className="text-xs text-gray-500">Primero</p>
              <p className="font-medium">{platos.find(p => p.id === menuHoy.primero_id)?.nombre || "—"}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border">
              <p className="text-xs text-gray-500">Segundo</p>
              <p className="font-medium">{platos.find(p => p.id === menuHoy.segundo_id)?.nombre || "—"}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border">
              <p className="text-xs text-gray-500">Postre</p>
              <p className="font-medium">{platos.find(p => p.id === menuHoy.postre_id)?.nombre || "—"}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border">
              <p className="text-xs text-gray-500">Precio base</p>
              <p className="text-xl font-bold text-blue-600">{menuHoy.precio_base.toFixed(2)} €</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
