import { useEffect, useId, useState, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';

export interface StepperProps {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  hint?: ReactNode;
  /** Nombre de décimales affichées. */
  decimals?: number;
}

const fmt = (v: number, decimals: number) => (decimals ? v.toFixed(decimals).replace(/\.?0+$/, '') : String(Math.round(v))).replace('.', ',');

/** Réglage numérique au doigt : gros boutons − / + et saisie directe (virgule acceptée). */
export function Stepper({ label, value, onChange, step = 1, min = -Infinity, max = Infinity, suffix, hint, decimals = 0 }: StepperProps) {
  const id = useId();
  const [text, setText] = useState(fmt(value, decimals));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value, decimals));
  }, [value, decimals, focused]);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const commit = (raw: string) => {
    const n = Number.parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(n)) onChange(clamp(n));
    else setText(fmt(value, decimals));
  };
  const name = typeof label === 'string' ? ` ${label.toLowerCase()}` : '';
  const bump = (dir: 1 | -1) => onChange(clamp(Math.round((value + dir * step) * 1000) / 1000));
  const btn =
    'inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-800 active:bg-gray-100 disabled:opacity-40';
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-gray-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={() => bump(-1)} disabled={value <= min} aria-label={`Diminuer${name}`}>
          <Minus className="size-5" aria-hidden />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            inputMode="decimal"
            value={text}
            onFocus={(e) => {
              setFocused(true);
              e.target.select();
            }}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number.parseFloat(e.target.value.replace(',', '.'));
              if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
            }}
            onBlur={(e) => {
              setFocused(false);
              commit(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 pr-10 text-center text-base font-bold tabular-nums text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500">{suffix}</span>}
        </div>
        <button type="button" className={btn} onClick={() => bump(1)} disabled={value >= max} aria-label={`Augmenter${name}`}>
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
