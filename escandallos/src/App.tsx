import { Routes, Route } from "react-router-dom";
import Proveedores from "./pages/Proveedores";
import Ingredientes from "./pages/Ingredientes";
import Recetas from "./pages/Recetas";
import Menus from "./pages/Menus";
import Albaranes from "./pages/Albaranes";

function App() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold">🍽️ Escandallos</h1>
          <p className="text-xs text-slate-400 mt-1">Gestión de costes</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <a href="/" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📊 Dashboard
          </a>
          <a href="/recetas" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📝 Recetas
          </a>
          <a href="/ingredientes" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            🥕 Ingredientes
          </a>
          <a href="/proveedores" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            🚚 Proveedores
          </a>
          <a href="/menus" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📋 Menús
          </a>
          <a href="/albaranes" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📄 Albaranes
          </a>
          <a href="/inventario" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📦 Inventario
          </a>
          <a href="/reportes" className="block px-3 py-2 rounded hover:bg-slate-700 transition-colors">
            📈 Reportes
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recetas" element={<Recetas />} />
          <Route path="/ingredientes" element={<Ingredientes />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/menus" element={<Menus />} />
          <Route path="/albaranes" element={<Albaranes />} />
          <Route path="/inventario" element={<Placeholder title="Inventario" />} />
          <Route path="/reportes" element={<Placeholder title="Reportes" />} />
        </Routes>
      </main>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Recetas</p>
          <p className="text-3xl font-bold text-slate-800">0</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Ingredientes</p>
          <p className="text-3xl font-bold text-slate-800">0</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Food Cost Medio</p>
          <p className="text-3xl font-bold text-green-600">0%</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Proveedores</p>
          <p className="text-3xl font-bold text-slate-800">0</p>
        </div>
      </div>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
      <p className="text-gray-500 mt-2">Módulo en desarrollo...</p>
    </div>
  );
}

export default App;
