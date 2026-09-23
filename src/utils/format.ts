/** Formatage (dates, nombres, distances) en français. */

const dayMs = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** « Modifié aujourd'hui », « hier », « il y a 3 jours », sinon date courte. */
export function formatRelativeDate(ts: number, now = Date.now()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / dayMs);
  if (diffDays <= 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDate(value: string | number): string {
  const d = typeof value === 'number' ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 3.48 → « 3,48 m ». */
export function formatMeters(meters: number, decimals = 2): string {
  return `${meters.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} m`;
}

export function formatNumber(value: number, decimals = 1): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: decimals });
}

/** Analyse « 4,20 », « 4.2 m », « 420 cm » → mètres. */
export function parseMeters(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(',', '.');
  const m = raw.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?$/);
  if (!m) return null;
  const v = Number.parseFloat(m[1]);
  if (!Number.isFinite(v) || v <= 0) return null;
  const unit = m[2] ?? 'm';
  if (unit === 'cm') return v / 100;
  if (unit === 'mm') return v / 1000;
  return v;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

export function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n > 1 ? (pluralForm ?? `${singular}s`) : singular}`;
}

/** Nom de fichier sûr. */
export function safeFileName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'projet'
  );
}
