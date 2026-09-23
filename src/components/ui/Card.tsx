import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2 first:mt-0">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      {icon && <div className="text-gray-400">{icon}</div>}
      <p className="font-semibold text-gray-800">{title}</p>
      {children && <div className="max-w-md text-sm text-gray-500">{children}</div>}
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'orange' | 'green' | 'yellow' | 'blue' | 'red' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    orange: 'bg-brand-100 text-brand-700',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-800',
    red: 'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
