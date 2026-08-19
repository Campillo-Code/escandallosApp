import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { Pencil, Trash2, Plus, X, ChevronLeft } from "lucide-react";
import SearchBar from "../components/SearchBar";
import SearchableSelect from "../components/SearchableSelect";
import { getAlergenoColor, getAlergenoLabel } from "../lib/alergenos";

const menuSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().optional(),
  tipo: z.string().optional(),
  activo: z.boolean(),
});

type MenuFormData = z.infer<typeof menuSchema>;

interface Menu {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
  activo: boolean;
}

interface MenuReceta {
  id: number;
  menu_id: number;
  receta_id: number;
  receta_nombre: string | null;
  precio_venta: number | null;
  orden: number;
}

interface Receta {
  id: number;
  nombre: string;
  categoria: string | null;
}

const menuRecetaSchema = z.object({
  receta_id: z.any(),
  precio_venta: z.string().optional(),
});

type MenuRecetaFormData = z.infer<typeof menuRecetaSchema>;

const TIPOS_MENU = ["Carta", "Menú del día", "Banquete", "Degustación", "Temporada", "Otro"];

export default function Menus() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [menuRecetas, setMenuRecetas] = useState<MenuReceta[]>([]);
  const [menuAlergenos, setMenuAlergenos] = useState<string[]>([]);
  const [showRecetaForm, setShowRecetaForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: { activo: true },
  });

  const {
    register: registerReceta,
    control: controlReceta,
    handleSubmit: handleSubmitReceta,
    reset: resetReceta,
    formState: { errors: errorsReceta, isSubmitting: isSubmittingReceta },
  } = useForm<MenuRecetaFormData>({
    resolver: zodResolver(menuRecetaSchema),
  });

  const loadMenus = async () => {
    try {
      const data = await invoke<Menu[]>("get_menus");
      setMenus(data);
    } catch (e) {
      console.error("Error loading menus:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadRecetas = async () => {
    try {
      const data = await invoke<Receta[]>("get_recetas");
      setRecetas(data);
    } catch (e) {
      console.error("Error loading recetas:", e);
    }
  };

  const loadMenuRecetas = async (menuId: number) => {
    try {
      const data = await invoke<MenuReceta[]>("get_menu_recetas", { menuId: menuId });
      setMenuRecetas(data);
    } catch (e) {
      console.error("Error loading menu recetas:", e);
    }
  };

  const loadMenuAlergenos = async (menuId: number) => {
    try {
      const data = await invoke<string[]>("get_menu_alergenos", { menuId: menuId });
      setMenuAlergenos(data);
    } catch (e) {
      console.error("Error loading menu alergenos:", e);
    }
  };

  useEffect(() => {
    loadMenus();
    loadRecetas();
  }, []);

  useEffect(() => {
    if (selectedMenu) {
      loadMenuRecetas(selectedMenu.id);
      loadMenuAlergenos(selectedMenu.id);
    }
  }, [selectedMenu]);

  const onSubmitMenu = async (data: MenuFormData) => {
    try {
      const input = {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        tipo: data.tipo || null,
        activo: data.activo,
      };
      if (editingId) {
        await invoke("update_menu", { id: editingId, input });
      } else {
        await invoke("create_menu", { input });
      }
      setShowForm(false);
      setEditingId(null);
      reset();
      loadMenus();
    } catch (e) {
      console.error("Error saving menu:", e);
    }
  };

  const onSubmitReceta = async (data: MenuRecetaFormData) => {
    if (!selectedMenu) return;
    try {
      await invoke("add_menu_receta", {
        input: {
          menu_id: selectedMenu.id,
          receta_id: parseInt(data.receta_id),
          precio_venta: data.precio_venta ? parseFloat(data.precio_venta) : null,
          orden: menuRecetas.length,
        },
      });
      setShowRecetaForm(false);
      resetReceta();
      loadMenuRecetas(selectedMenu.id);
    } catch (e) {
      console.error("Error adding receta:", e);
    }
  };

  const handleEdit = (m: Menu) => {
    setEditingId(m.id);
    reset({
      nombre: m.nombre,
      descripcion: m.descripcion ?? "",
      tipo: m.tipo ?? "",
      activo: m.activo,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este menú y todas sus recetas?")) return;
    try {
      await invoke("delete_menu", { id });
      if (selectedMenu?.id === id) {
        setSelectedMenu(null);
        setMenuRecetas([]);
      }
      loadMenus();
    } catch (e) {
      console.error("Error deleting menu:", e);
    }
  };

  const handleDeleteReceta = async (id: number) => {
    if (!confirm("¿Eliminar esta receta del menú?")) return;
    try {
      await invoke("delete_menu_receta", { id });
      if (selectedMenu) {
        loadMenuRecetas(selectedMenu.id);
      }
    } catch (e) {
      console.error("Error deleting menu receta:", e);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    reset();
  };

  if (selectedMenu) {
    const totalVenta = menuRecetas.reduce((sum, mr) => sum + (mr.precio_venta ?? 0), 0);

    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              setSelectedMenu(null);
              setMenuRecetas([]);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{selectedMenu.nombre}</h2>
            <p className="text-sm text-gray-500">
              {selectedMenu.tipo ?? "Sin tipo"} · {selectedMenu.activo ? "Activo" : "Inactivo"}
            </p>
          </div>
        </div>

        {selectedMenu.descripcion && (
          <p className="text-gray-600 mb-4">{selectedMenu.descripcion}</p>
        )}

        {menuAlergenos.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">Alérgenos del menú:</p>
            <div className="flex flex-wrap gap-2">
              {menuAlergenos.map((a) => (
                <span key={a} className={`px-3 py-1 rounded-full text-sm font-medium ${getAlergenoColor(a)}`}>
                  {getAlergenoLabel(a)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recetas del menú</h3>
          {!showRecetaForm && (
            <button
              onClick={() => {
                resetReceta();
                setShowRecetaForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Añadir Receta
            </button>
          )}
        </div>

        {showRecetaForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Añadir Receta</h3>
              <button onClick={() => setShowRecetaForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitReceta(onSubmitReceta)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Receta *</label>
                <Controller
                  control={controlReceta}
                  name="receta_id"
                  rules={{ required: "Selecciona una receta" }}
                  render={({ field }) => (
                    <SearchableSelect
                      options={recetas.map(r => ({ value: r.id, label: r.nombre }))}
                      value={field.value ? Number(field.value) : 0}
                      onChange={(val) => field.onChange(val)}
                      placeholder="Seleccionar..."
                    />
                  )}
                />
                {errorsReceta.receta_id && <p className="text-red-500 text-sm mt-1">{String(errorsReceta.receta_id.message)}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio venta (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...registerReceta("precio_venta")}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-3 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowRecetaForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReceta}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmittingReceta ? "Añadiendo..." : "Añadir"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {menuRecetas.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No hay recetas en este menú</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Receta</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Precio venta</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {menuRecetas.map((mr) => (
                  <tr key={mr.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{mr.receta_nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {mr.precio_venta != null ? `${mr.precio_venta.toFixed(2)} €` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <button
                        onClick={() => handleDeleteReceta(mr.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-800 text-right">{totalVenta.toFixed(2)} €</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Menús</h2>
        {!showForm && (
          <button
            onClick={() => {
              setEditingId(null);
              reset();
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Nuevo Menú
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingId ? "Editar Menú" : "Nuevo Menú"}
            </h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmitMenu)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                {...register("nombre")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                {...register("tipo")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar...</option>
                {TIPOS_MENU.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                {...register("descripcion")}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("activo")}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Activo</span>
              </label>
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <>
          <div className="p-4 pb-2">
            <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Buscar menú..." />
          </div>
          {loading ? (
            <div className="p-6 text-center text-gray-500">Cargando...</div>
          ) : menus.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No hay menús registrados</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Activo</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {menus.filter((m) => m.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedMenu(m)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.tipo ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {m.activo ? "✓" : ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEdit(m)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      </div>
    </div>
  );
}
