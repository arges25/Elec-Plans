import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Libellé accessible obligatoire. */
  label: string;
  icon: ReactNode;
  tone?: 'light' | 'dark' | 'brand' | 'plain';
  active?: boolean;
  showLabel?: boolean;
}

const TONES = {
  light: 'text-gray-700 hover:bg-gray-100 active:bg-gray-200',
  dark: 'text-gray-100 hover:bg-white/10 active:bg-white/20',
  brand: 'bg-brand-500 text-white hover:bg-brand-600 shadow',
  plain: 'bg-white text-gray-800 border border-gray-200 shadow-sm hover:bg-gray-50',
};

export function IconButton({ label, icon, tone = 'light', active, showLabel, className = '', type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl transition-colors disabled:opacity-40 ${
        active ? (tone === 'dark' ? 'bg-brand-500 text-white' : 'bg-brand-100 text-brand-700 ring-1 ring-brand-300') : TONES[tone]
      } ${showLabel ? 'px-3' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {showLabel && <span className="text-sm font-semibold">{label}</span>}
    </button>
  );
}
