import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { normalizeNumericDraft } from "../numericInput";

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  emptyFallback?: number;
  zeroAsEmpty?: boolean;
  commitOnBlur?: boolean;
  onEmpty?: () => void;
};

/**
 * حقل رقمي يسمح بالفراغ أثناء التحرير، ثم يعتمد قيمة رقمية آمنة عند الخروج.
 * هذا يمنع تحويل "" إلى 0 أثناء الكتابة وظهور قيم مثل 07 أو 015.
 */
export default function NumericInput({ value, onValueChange, emptyFallback, zeroAsEmpty = false, commitOnBlur = false, onEmpty, min, max, step, onBlur, onFocus, inputMode, ...props }: NumericInputProps) {
  const displayValue = value === null || value === undefined || (zeroAsEmpty && value === 0) ? "" : String(value);
  const [draft, setDraft] = useState(displayValue);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(displayValue);
  }, [displayValue]);

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
      inputMode={inputMode ?? "decimal"}
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
        if (!commitOnBlur && Number.isFinite(parsed)) onValueChange(clamp(parsed));
      }}
      onBlur={(event) => {
        focused.current = false;
        if (draft === "" || !Number.isFinite(Number(draft))) {
          if (onEmpty) {
            setDraft("");
            onEmpty();
            onBlur?.(event);
            return;
          }
          const fallback = clamp(emptyFallback ?? (min === undefined ? 0 : Number(min)));
          setDraft(zeroAsEmpty && fallback === 0 ? "" : String(fallback));
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
