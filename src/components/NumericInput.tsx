import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { normalizeNumericDraft } from "../numericInput";

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
  emptyFallback?: number;
};

/**
 * حقل رقمي يسمح بالفراغ أثناء التحرير، ثم يعتمد قيمة رقمية آمنة عند الخروج.
 * هذا يمنع تحويل "" إلى 0 أثناء الكتابة وظهور قيم مثل 07 أو 015.
 */
export default function NumericInput({ value, onValueChange, emptyFallback, min, max, step, onBlur, onFocus, ...props }: NumericInputProps) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const clamp = (number: number): number => {
    const lower = min === undefined ? -Infinity : Number(min);
    const upper = max === undefined ? Infinity : Number(max);
    return Math.min(upper, Math.max(lower, number));
  };

  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={(event) => {
        focused.current = true;
        onFocus?.(event);
      }}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") {
          setDraft("");
          return;
        }
        const normalized = normalizeNumericDraft(raw);
        setDraft(normalized);
        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) onValueChange(clamp(parsed));
      }}
      onBlur={(event) => {
        focused.current = false;
        if (draft === "" || !Number.isFinite(Number(draft))) {
          const fallback = clamp(emptyFallback ?? (min === undefined ? 0 : Number(min)));
          setDraft(String(fallback));
          onValueChange(fallback);
        } else {
          const committed = clamp(Number(draft));
          setDraft(String(committed));
          onValueChange(committed);
        }
        onBlur?.(event);
      }}
    />
  );
}
