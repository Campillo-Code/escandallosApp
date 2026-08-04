import { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import Proveedores from "./pages/Proveedores";
import Ingredientes from "./pages/Ingredientes";
import Escandallos from "./pages/Escandallos";
import Guarniciones from "./pages/Guarniciones";
import Albaranes from "./pages/Albaranes";
import Inventario from "./pages/Inventario";
import Dashboard from "./pages/Dashboard";
import FichasTecnicas from "./pages/FichasTecnicas";
import Ventas from "./pages/Ventas";
import MenuEngineering from "./pages/MenuEngineering";
import Contabilidad from "./pages/Contabilidad";
import Configuracion from "./pages/Configuracion";
import Lotes from "./pages/Lotes";
import Produccion from "./pages/Produccion";
import Caja from "./pages/Caja";
import PreciosCaja from "./pages/PreciosCaja";


interface SidebarLink {
  to: string;
  label: string;
  icon: string;
}

interface SidebarSection {
  id: string;
  title: string;
  icon: string;
  links: SidebarLink[];
}

const sections: SidebarSection[] = [
  {
    id: "carta",
    title: "Carta",
    icon: "🍽️",
    links: [
      { to: "/escandallos", label: "Escandallos", icon: "📋" },
      { to: "/guarniciones", label: "Guarniciones", icon: "🥗" },
      { to: "/fichas-tecnicas", label: "Fichas Técnicas", icon: "🧾" },
    ],
  },
  {
    id: "suministros",
    title: "Suministros",
    icon: "🚚",
    links: [
      { to: "/ingredientes", label: "Ingredientes", icon: "🥕" },
      { to: "/proveedores", label: "Proveedores", icon: "🏭" },
      { to: "/albaranes", label: "Albaranes", icon: "📄" },
      { to: "/inventario", label: "Inventario", icon: "📦" },
    ],
  },
  {
    id: "negocio",
    title: "Negocio",
    icon: "💼",
    links: [
      { to: "/ventas", label: "Ventas", icon: "💰" },
      { to: "/menu-engineering", label: "Menu Engineering", icon: "📈" },
      { to: "/contabilidad", label: "Contabilidad", icon: "📉" },
    ],
  },
  {
    id: "trazabilidad",
    title: "Trazabilidad",
    icon: "🔍",
    links: [
      { to: "/lotes", label: "Lotes", icon: "🏷️" },
      { to: "/produccion", label: "Producción", icon: "🏭" },
    ],
  },
];

function App() {
  const location = useLocation();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((s) => {
      initial[s.id] = s.links.some((l) => location.pathname === l.to);
    });
    initial["caja"] = location.pathname === "/caja" || location.pathname === "/precios-caja";
    return initial;
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isActive = (to: string) => location.pathname === to;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold">🍽️ Con Sazón_gestión</h1>
          <p className="text-xs text-slate-400 mt-1">Gestión de costes</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto text-sm">
          {/* Dashboard */}
          <a
            href="/"
            className={`block px-3 py-2 rounded transition-colors ${
              location.pathname === "/"
                ? "bg-slate-600 text-white"
                : "text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            📊 Dashboard
          </a>

          {/* Caja */}
          {(() => {
            const isOpen = openSections["caja"];
            const hasActive = location.pathname === "/caja" || location.pathname === "/precios-caja";
            return (
              <div>
                <button
                  onClick={() => toggleSection("caja")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded transition-colors ${
                    hasActive && !isOpen ? "text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🛒</span>
                    <span className="font-medium">Caja</span>
                  </span>
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {isOpen && (
                  <div className="ml-4 space-y-0.5">
                    <a href="/caja"
                      className={`block px-3 py-1.5 rounded text-sm transition-colors ${
                        location.pathname === "/caja"
                          ? "bg-green-600 text-white"
                          : "text-slate-400 hover:bg-slate-700 hover:text-white"
                      }`}>Terminal</a>
                    <a href="/precios-caja"
                      className={`block px-3 py-1.5 rounded text-sm transition-colors ${
                        location.pathname === "/precios-caja"
                          ? "bg-green-600 text-white"
                          : "text-slate-400 hover:bg-slate-700 hover:text-white"
                      }`}>Precios</a>
                  </div>
                )}
              </div>
            );
          })()}


          {/* Sections */}
          {sections.map((section) => {
            const isOpen = openSections[section.id];
            const hasActive = section.links.some((l) => location.pathname === l.to);
            return (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded transition-colors ${
                    hasActive && !isOpen
                      ? "text-white"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{section.icon}</span>
                    <span className="font-medium">{section.title}</span>
                  </span>
                  <span className="text-slate-400">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
                {isOpen && (
                  <div className="ml-2 border-l border-slate-600 pl-2 mt-0.5 mb-1 space-y-0.5">
                    {section.links.map((link) => (
                      <a
                        key={link.to}
                        href={link.to}
                        className={`block px-3 py-1.5 rounded text-sm transition-colors ${
                          isActive(link.to)
                            ? "bg-slate-600 text-white"
                            : "text-slate-400 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        {link.icon} {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Configuración */}
          <div className="border-t border-slate-700 my-2 pt-2">
            <a
              href="/configuracion"
              className={`block px-3 py-2 rounded transition-colors ${
                location.pathname === "/configuracion"
                  ? "bg-slate-600 text-white"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              ⚙️ Configuración
            </a>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/precios-caja" element={<PreciosCaja />} />

          <Route path="/escandallos" element={<Escandallos />} />
          <Route path="/ingredientes" element={<Ingredientes />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/guarniciones" element={<Guarniciones />} />
          <Route path="/albaranes" element={<Albaranes />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/fichas-tecnicas" element={<FichasTecnicas />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/menu-engineering" element={<MenuEngineering />} />
          <Route path="/contabilidad" element={<Contabilidad />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/lotes" element={<Lotes />} />
          <Route path="/produccion" element={<Produccion />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
