import { Routes, Route } from "react-router-dom";
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

function App() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold">🍽️ Con Sazón_gestión</h1>
          <p className="text-xs text-slate-400 mt-1">Gestión de costes</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <a href="/" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📊 Dashboard
          </a>
          <a href="/escandallos" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            🍽️ Escandallos
          </a>
          <a href="/ingredientes" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            🥕 Ingredientes
          </a>
          <a href="/proveedores" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            🚚 Proveedores
          </a>
          <a href="/guarniciones" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            🥗 Guarniciones
          </a>
          <a href="/albaranes" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📄 Albaranes
          </a>
          <a href="/inventario" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📦 Inventario
          </a>
          <a href="/fichas-tecnicas" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            🧾 Fichas Técnicas
          </a>
          <a href="/ventas" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            💰 Ventas
          </a>
          <a href="/menu-engineering" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📈 Menu Engineering
          </a>
          <a href="/contabilidad" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📉 Contabilidad
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
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
        </Routes>
      </main>
    </div>
  );
}

export default App;
