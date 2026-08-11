import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, Scissors } from "lucide-react";
import SearchBar from "../components/SearchBar";
import SearchableSelect from "../components/SearchableSelect";

interface Ingrediente {
  id: number;
  nombre: string;
  unidad_base: string;
}

interface Despiece {
  id: number;
  nombre: string;
  ingrediente_entrada_id: number;
  ingrediente_entrada_nombre: string | null;
  cantidad_entrada: number;
  unidad_entrada: string;
  notas: string | null;
}

interface DespieceSalida {
  id: number;
  despiece_id: number;
  ingrediente_id: number;
  ingrediente_nombre: string | null;
  porcentaje: number | null;
  cantidad: number | null;
  unidad: string;
  notas: string | null;
}

interface SalidaForm {
  ingrediente_id: number;
  porcentaje: string;
  cantidad: string;
  unidad: string;
  notas: string;
}

const UNIDADES = ["kg", "g", "l", "ml", "ud"];

export default function Despieces() {
  const [despieces, setDespieces] = useState<Despiece[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [nombre, setNombre] = useState("");
  const [ingredienteEntradaId, setIngredienteEntradaId] = useState<number>(0);
  const [cantidadEntrada, setCantidadEntrada] = useState("1");
  const [unidadEntrada, setUnidadEntrada] = useState("kg");
  const [notas, setNotas] = useState("");
  const [salidas, setSalidas] = useState<SalidaForm[]>([]);

  // Expanded despiece for viewing salidas
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [salidasMap, setSalidasMap] = useState<Record<number, DespieceSalida[]>>({});

  const loadData = async () => {
    try {
      const [d, i] = await Promise.all([
        invoke<Despiece[]>("get_despieces"),
        invoke<Ingrediente[]>("get_ingredientes"),
      ]);
      setDespieces(d);
      setIngredientes(i);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadSalidas = async (despieceId: number) => {
    try {
      const s = await invoke<DespieceSalida[]>("get_despiece_salidas", { despieceId });
      setSalidasMap((prev) => ({ ...prev, [despieceId]: s }));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!salidasMap[id]) {
        await loadSalidas(id);
      }
    }
  };

  const resetForm = () => {
    setNombre("");
    setIngredienteEntradaId(0);
    setCantidadEntrada("1");
    setUnidadEntrada("kg");
    setNotas("");
    setSalidas([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = async (d: Despiece) => {
    setEditingId(d.id);
    setNombre(d.nombre);
    setIngredienteEntradaId(d.ingrediente_entrada_id);
    setCantidadEntrada(String(d.cantidad_entrada));
    setUnidadEntrada(d.unidad_entrada);
    setNotas(d.notas || "");

    // Load salidas
    try {
      const s = await invoke<DespieceSalida[]>("get_despiece_salidas", { despieceId: d.id });
      setSalidas(
        s.map((sal) => ({
          ingrediente_id: sal.ingrediente_id,
          porcentaje: sal.porcentaje != null ? String(sal.porcentaje) : "",
          cantidad: sal.cantidad != null ? String(sal.cantidad) : "",
          unidad: sal.unidad,
          notas: sal.notas || "",
        }))
      );
    } catch (e) {
      console.error(e);
      setSalidas([]);
    }

    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este despiece y todas sus salidas?")) return;
    try {
      await invoke("delete_despiece", { id });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const addSalida = () => {
    setSalidas([
      ...salidas,
      { ingrediente_id: 0, porcentaje: "", cantidad: "", unidad: "g", notas: "" },
    ]);
  };

  const updateSalida = (index: number, field: keyof SalidaForm, value: string | number) => {
    const updated = [...salidas];
    (updated[index] as any)[field] = value;
    setSalidas(updated);
  };

  const removeSalida = (index: number) => {
    setSalidas(salidas.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!nombre || !ingredienteEntradaId || !cantidadEntrada) {
      alert("Nombre, ingrediente de entrada y cantidad son obligatorios");
      return;
    }

    const validSalidas = salidas.filter((s) => s.ingrediente_id > 0);
    if (validSalidas.length === 0) {
      alert("Debe añadir al menos una salida");
      return;
    }

    const payload = {
      despiece: {
        nombre,
        ingrediente_entrada_id: ingredienteEntradaId,
        cantidad_entrada: parseFloat(cantidadEntrada) || 1,
        unidad_entrada: unidadEntrada,
        notas: notas || null,
      },
      salidas: validSalidas.map((s) => ({
        ingrediente_id: s.ingrediente_id,
        porcentaje: s.porcentaje ? parseFloat(s.porcentaje) : null,
        cantidad: s.cantidad ? parseFloat(s.cantidad) : null,
        unidad: s.unidad,
        notas: s.notas || null,
      })),
    };

    try {
      if (editingId) {
        await invoke("update_despiece", { id: editingId, input: payload });
      } else {
        await invoke("create_despiece", { input: payload });
      }
      resetForm();
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Error al guardar: " + String(e));
    }
  };

  const handleExecute = async (id: number) => {
    if (!confirm("¿Ejecutar este despiece? Se descontará el ingrediente de entrada y se añadirán las salidas al inventario.")) return;
    try {
      const result = await invoke<string>("execute_despiece", { despieceId: id });
      alert(result);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Error al ejecutar: " + String(e));
    }
  };

  const filtered = despieces.filter(
    (d) =>
      d.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.ingrediente_entrada_nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Despieces</h2>
        <div className="flex gap-3">
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={18} /> Nuevo Despiece
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingId ? "Editar Despiece" : "Nuevo Despiece"}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Ej: Despiece de pollo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ingrediente de entrada
              </label>
              <SearchableSelect
                options={ingredientes.map((i) => ({ value: i.id, label: `${i.nombre} (${i.unidad_base})` }))}
                value={ingredienteEntradaId}
                onChange={setIngredienteEntradaId}
                placeholder="Seleccionar ingrediente..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad de entrada
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={cantidadEntrada}
                  onChange={(e) => setCantidadEntrada(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={unidadEntrada}
                  onChange={(e) => setUnidadEntrada(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <input
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Salidas */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700">Piezas de salida</h4>
              <button
                onClick={addSalida}
                className="flex items-center gap-1 text-sm bg-green-50 text-green-700 px-3 py-1 rounded-lg hover:bg-green-100"
              >
                <Plus size={14} /> Añadir salida
              </button>
            </div>

            {salidas.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                No hay salidas definidas. Añade las piezas que salen del despiece.
              </p>
            )}

            {salidas.map((salida, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                <SearchableSelect
                  options={ingredientes.map((i) => ({ value: i.id, label: i.nombre }))}
                  value={salida.ingrediente_id}
                  onChange={(val) => updateSalida(idx, "ingrediente_id", val)}
                  placeholder="Ingrediente..."
                  className="flex-1"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={salida.porcentaje}
                    onChange={(e) => updateSalida(idx, "porcentaje", e.target.value)}
                    className="w-20 border rounded px-2 py-1.5 text-sm"
                    placeholder="%"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
                <span className="text-xs text-gray-400">o</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={salida.cantidad}
                    onChange={(e) => updateSalida(idx, "cantidad", e.target.value)}
                    className="w-20 border rounded px-2 py-1.5 text-sm"
                    placeholder="cant."
                  />
                  <select
                    value={salida.unidad}
                    onChange={(e) => updateSalida(idx, "unidad", e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm"
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => removeSalida(idx)}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSubmit}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
            >
              {editingId ? "Actualizar" : "Guardar"}
            </button>
            <button
              onClick={resetForm}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Cargando...</div>
        ) : (
          <>
            <div className="p-4 pb-2">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar despiece..."
              />
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                    Ingrediente entrada
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cantidad</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Salidas</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">
                      No hay despieces definidos
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => (
                    <>
                      <tr
                        key={d.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpand(d.id)}
                      >
                        <td className="px-4 py-3 text-sm font-medium">{d.nombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {d.ingrediente_entrada_nombre || `#${d.ingrediente_entrada_id}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {d.cantidad_entrada} {d.unidad_entrada}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {salidasMap[d.id]
                            ? `${salidasMap[d.id].length} pieza(s)`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleExecute(d.id)}
                              className="text-green-600 hover:text-green-800 p-1"
                              title="Ejecutar despiece"
                            >
                              <Scissors size={16} />
                            </button>
                            <button
                              onClick={() => handleEdit(d)}
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title="Editar"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(d.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === d.id && salidasMap[d.id] && (
                        <tr key={`${d.id}-detail`}>
                          <td colSpan={5} className="px-4 py-3 bg-gray-50">
                            <div className="text-sm">
                              <p className="font-medium text-gray-700 mb-2">Piezas de salida:</p>
                              {salidasMap[d.id].length === 0 ? (
                                <p className="text-gray-400 italic">Sin salidas definidas</p>
                              ) : (
                                <table className="w-full max-w-2xl">
                                  <thead>
                                    <tr>
                                      <th className="text-left text-xs text-gray-500 pb-1">
                                        Ingrediente
                                      </th>
                                      <th className="text-left text-xs text-gray-500 pb-1">
                                        Cantidad
                                      </th>
                                      <th className="text-left text-xs text-gray-500 pb-1">
                                        Unidad
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {salidasMap[d.id].map((s) => (
                                      <tr key={s.id}>
                                        <td className="py-1">
                                          {s.ingrediente_nombre || `#${s.ingrediente_id}`}
                                        </td>
                                        <td className="py-1">
                                          {s.porcentaje != null
                                            ? `${s.porcentaje}%`
                                            : s.cantidad != null
                                              ? s.cantidad
                                              : "—"}
                                        </td>
                                        <td className="py-1">{s.unidad}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
