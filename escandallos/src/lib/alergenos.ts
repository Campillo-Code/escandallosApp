export const ALERGENOS = [
  { id: "gluten", label: "Gluten", color: "bg-amber-100 text-amber-800" },
  { id: "crustaceos", label: "Crustáceos", color: "bg-red-100 text-red-800" },
  { id: "huevos", label: "Huevos", color: "bg-yellow-100 text-yellow-800" },
  { id: "pescado", label: "Pescado", color: "bg-blue-100 text-blue-800" },
  { id: "cacahuetes", label: "Cacahuetes", color: "bg-orange-100 text-orange-800" },
  { id: "soja", label: "Soja", color: "bg-green-100 text-green-800" },
  { id: "leche", label: "Leche", color: "bg-sky-100 text-sky-800" },
  { id: "frutos_secos", label: "Frutos secos", color: "bg-amber-100 text-amber-700" },
  { id: "apio", label: "Apio", color: "bg-lime-100 text-lime-800" },
  { id: "mostaza", label: "Mostaza", color: "bg-yellow-100 text-yellow-700" },
  { id: "sesamo", label: "Sésamo", color: "bg-stone-100 text-stone-800" },
  { id: "sulfitos", label: "Sulfitos", color: "bg-purple-100 text-purple-800" },
  { id: "moluscos", label: "Moluscos", color: "bg-cyan-100 text-cyan-800" },
  { id: "altramuz", label: "Altramuces", color: "bg-violet-100 text-violet-800" },
];

export function parseAlergenos(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeAlergenos(ids: string[]): string {
  return JSON.stringify(ids);
}

export function getAlergenoLabel(id: string): string {
  return ALERGENOS.find((a) => a.id === id)?.label ?? id;
}

export function getAlergenoColor(id: string): string {
  return ALERGENOS.find((a) => a.id === id)?.color ?? "bg-gray-100 text-gray-800";
}
