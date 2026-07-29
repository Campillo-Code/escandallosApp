import DatePicker, { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("es", es);

interface DateInputProps {
  value: string; // ISO format yyyy-mm-dd
  onChange: (isoDate: string) => void;
  label?: string;
  className?: string;
}

function isoToDate(iso: string): Date | null {
  if (!iso || iso.length < 10) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function DateInput({ value, onChange, label, className = "" }: DateInputProps) {
  return (
    <div>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <DatePicker
        selected={isoToDate(value)}
        onChange={(date: Date | null) => {
          if (date) onChange(dateToIso(date));
          else onChange("");
        }}
        dateFormat="dd/MM/yyyy"
        locale="es"
        className={`border border-gray-300 rounded-lg px-3 py-2 w-full ${className}`}
        calendarClassName="border rounded-lg shadow-lg"
        placeholderText="dd/mm/aaaa"
        isClearable
      />
    </div>
  );
}
