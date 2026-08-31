import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Pencil, Trash2, X, Wifi, WifiOff, Database, Printer, Download } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";

interface DbConfig {
  id: string;
  nombre: string;
  host: string;
  puerto: number;
  usuario: string;
  password: string;
  base_datos: string;
  activa: boolean;
}

interface PrinterInfo {
  name: string;
  is_default: boolean;
}

const emptyForm: Omit<DbConfig, "id" | "activa"> = {
  nombre: "",
  host: "127.0.0.1",
  puerto: 3306,
  usuario: "root",
  password: "",
  base_datos: "",
};

export default function Configuracion() {
  const [configs, setConfigs] = useState<DbConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [loadingPrinters, setLoadingPrinters] = useState(true);
  const [appVersion, setAppVersion] = useState<string>("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => { getVersion().then(setAppVersion).catch(() => {}); }, []);

  const checkForUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const update = await check();
      if (update) {
        const shouldUpdate = window.confirm(
          `Nueva versión disponible: v${update.version}\n\n¿Deseas descargar e instalar ahora?\nLa app se reiniciará automáticamente.`
        );
        if (shouldUpdate) {
          await update.downloadAndInstall();
          const { relaunch } = await import("@tauri-apps/plugin-process");
          await relaunch();
        }
      } else {
        alert("Estás en la última versión (v" + appVersion + ")");
      }
    } catch (e) {
      alert("Error al buscar actualizaciones: " + e);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const loadConfigs = async () => {
    try {
      const result = await invoke<DbConfig[]>("get_db_configs");
      setConfigs(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadPrinters = async () => {
    try {
      const result = await invoke<PrinterInfo[]>("get_printers");
      setPrinters(result);
      const saved = localStorage.getItem("selected_printer");
      if (saved) {
        setSelectedPrinter(saved);
      } else {
        const defaultPrinter = result.find(p => p.is_default);
        if (defaultPrinter) {
          setSelectedPrinter(defaultPrinter.name);
          localStorage.setItem("selected_printer", defaultPrinter.name);
        }
      }
    } catch (e) {
      console.error("Error loading printers:", e);
    } finally {
      setLoadingPrinters(false);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadPrinters();
  }, []);

  const handlePrinterChange = (printerName: string) => {
    setSelectedPrinter(printerName);
    localStorage.setItem("selected_printer", printerName);
  };

  const handleChange = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setTestResult(null);
    setShowForm(true);
  };

  const openEdit = (c: DbConfig) => {
    setEditingId(c.id);
    setForm({ nombre: c.nombre, host: c.host, puerto: c.puerto, usuario: c.usuario, password: c.password, base_datos: c.base_datos });
    setTestResult(null);
    setShowForm(true);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const testConfig: DbConfig = { ...form, id: "test", activa: false };
      const msg = await invoke<string>("test_db_connection", { config: testConfig });
      setTestResult({ ok: true, msg });
    } catch (e) {
      setTestResult({ ok: false, msg: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        const config: DbConfig = { ...form, id: editingId, activa: false };
        const result = await invoke<DbConfig[]>("update_db_config", { config });
        setConfigs(result);
      } else {
        const config: DbConfig = { ...form, id: crypto.randomUUID(), activa: false };
        const result = await invoke<DbConfig[]>("add_db_config", { config });
        setConfigs(result);
      }
      setShowForm(false);
    } catch (e) {
      alert("Error: " + e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta configuración?")) return;
    try {
      const result = await invoke<DbConfig[]>("delete_db_config", { id });
      setConfigs(result);
    } catch (e) {
      alert("Error: " + e);
    }
  };

  const handleActivate = async (id: string) => {
    if (!confirm("¿Activar esta base de datos?")) return;
    try {
      await invoke<DbConfig[]>("activate_and_switch_db", { id });
      await loadConfigs();
      alert("Base de datos activada correctamente");
    } catch (e) {
      alert("Error al conectar: " + e);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
          {appVersion && <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">v{appVersion}</span>}
          <button onClick={checkForUpdate} disabled={checkingUpdate} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 px-3 py-1 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors">
            <Download size={14} /> {checkingUpdate ? "Buscando..." : "Buscar actualizaciones"}
          </button>
        </div>
        {!showForm && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={18} /> Nueva BBDD
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{editingId ? "Editar" : "Nueva"} Base de Datos</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => handleChange("nombre", e.target.value)} placeholder="Ej: Producción" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base de datos *</label>
              <input value={form.base_datos} onChange={e => handleChange("base_datos", e.target.value)} placeholder="Ej: escandallos_db" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Host *</label>
              <input value={form.host} onChange={e => handleChange("host", e.target.value)} placeholder="127.0.0.1" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Puerto</label>
              <input type="number" value={form.puerto} onChange={e => handleChange("puerto", parseInt(e.target.value) || 3306)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario *</label>
              <input value={form.usuario} onChange={e => handleChange("usuario", e.target.value)} placeholder="root" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" value={form.password} onChange={e => handleChange("password", e.target.value)} placeholder="••••" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          {testResult && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${testResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {testResult.msg}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button onClick={handleTest} disabled={testing} className="px-4 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2">
              <Wifi size={16} /> {testing ? "Probando..." : "Probar conexión"}
            </button>
            <button onClick={handleSave} disabled={!form.nombre || !form.base_datos || !form.usuario} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Guardar</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Cargando...</div>
        ) : configs.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <Database size={48} className="mx-auto mb-3 opacity-50" />
            <p>No hay bases de datos configuradas</p>
            <p className="text-sm mt-1">Pulsa "Nueva BBDD" para añadir una</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Host</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Puerto</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Usuario</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Base de datos</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {configs.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.activa ? "bg-blue-50" : ""}`}>
                  <td className="px-4 py-3">
                    {c.activa ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <Wifi size={12} /> Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        <WifiOff size={12} /> Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.host}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.puerto}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.usuario}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.base_datos}</td>
                  <td className="px-4 py-3 text-sm text-right space-x-2">
                    {!c.activa && (
                      <button onClick={() => handleActivate(c.id)} className="text-green-600 hover:text-green-800 text-xs font-medium" title="Activar esta BBDD">Usar</button>
                    )}
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Printer Configuration */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Printer size={20} className="text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Impresora</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Selecciona la impresora para etiquetas de producción</p>
        {loadingPrinters ? (
          <p className="text-sm text-gray-400">Detectando impresoras...</p>
        ) : printers.length === 0 ? (
          <p className="text-sm text-orange-500">No se detectaron impresoras. Asegúrate de tener una instalada.</p>
        ) : (
          <div className="flex items-center gap-4">
            <select
              value={selectedPrinter}
              onChange={e => handlePrinterChange(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {printers.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name} {p.is_default ? "(predeterminada)" : ""}
                </option>
              ))}
            </select>
            <button onClick={loadPrinters} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              Actualizar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
