import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const inputClass =
  'w-full min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-100';

interface WrapProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
  className?: string;
}

function FieldWrap({ label, hint, error, id, children, className = '' }: WrapProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-gray-700">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-sm text-red-600">{error}</p> : hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  onValueChange?: (value: string) => void;
  onChange?: InputHTMLAttributes<HTMLInputElement>['onChange'];
  wrapperClassName?: string;
  suffix?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({ label, hint, error, onValueChange, onChange, wrapperClassName, suffix, id, className = '', ref, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fid = id ?? autoId;
  return (
    <FieldWrap label={label} hint={hint} error={error} id={fid} className={wrapperClassName}>
      <div className="relative flex items-center">
        <input
          ref={ref}
          id={fid}
          className={`${inputClass} ${suffix ? 'pr-12' : ''} ${error ? 'border-red-400' : ''} ${className}`}
          onChange={(e) => {
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
          {...rest}
        />
        {suffix && <span className="pointer-events-none absolute right-3 text-sm text-gray-500">{suffix}</span>}
      </div>
    </FieldWrap>
  );
}

export interface NumberFieldProps extends Omit<TextFieldProps, 'value' | 'onValueChange' | 'type'> {
  value: number;
  onNumberChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

/** Champ numérique acceptant la virgule française. */
export function NumberField({ value, onNumberChange, step = 0.1, min, max, ...rest }: NumberFieldProps) {
  return (
    <TextField
      {...rest}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      value={Number.isFinite(value) ? value : ''}
      onValueChange={(v) => {
        const n = Number.parseFloat(v.replace(',', '.'));
        if (Number.isFinite(n)) onNumberChange(n);
      }}
    />
  );
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: ReactNode;
  hint?: ReactNode;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
}

export function SelectField({ label, hint, options, onValueChange, wrapperClassName, id, className = '', ...rest }: SelectFieldProps) {
  const autoId = useId();
  const fid = id ?? autoId;
  return (
    <FieldWrap label={label} hint={hint} id={fid} className={wrapperClassName}>
      <select id={fid} className={`${inputClass} ${className}`} onChange={(e) => onValueChange(e.target.value)} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
}

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: ReactNode;
  hint?: ReactNode;
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
}

export function TextArea({ label, hint, onValueChange, wrapperClassName, id, className = '', ...rest }: TextAreaProps) {
  const autoId = useId();
  const fid = id ?? autoId;
  return (
    <FieldWrap label={label} hint={hint} id={fid} className={wrapperClassName}>
      <textarea id={fid} className={`${inputClass} min-h-24 ${className}`} onChange={(e) => onValueChange(e.target.value)} {...rest} />
    </FieldWrap>
  );
}

export interface ToggleProps {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Interrupteur on/off (état indiqué aussi par le texte, pas seulement la couleur). */
export function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center gap-3 py-1">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block font-medium text-gray-900">
          {label}
        </label>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-green-600' : 'bg-gray-300'}`}
      >
        <span className="sr-only">{checked ? 'Activé' : 'Désactivé'}</span>
        <span className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

export interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  onCommit?: (value: number) => void;
}

export function Slider({ label, value, min, max, step = 1, onChange, format, onCommit }: SliderProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium text-gray-700">
          {label}
        </label>
        <span className="tabular-nums text-gray-600">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        className="h-11 w-full accent-brand-500"
      />
    </div>
  );
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; ariaLabel?: string }[];
  ariaLabel: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({ value, onChange, options, ariaLabel, size = 'md' }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex w-full rounded-xl bg-gray-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.ariaLabel}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 ${size === 'sm' ? 'min-h-9 text-sm' : 'min-h-10'} font-semibold transition-colors ${
            value === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
