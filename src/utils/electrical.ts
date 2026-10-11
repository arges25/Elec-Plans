/**
 * Lecture et mise en forme des caractéristiques électriques saisies librement
 * (calibre « C16 », « 20A », section « 2,5 mm² »…).
 */

/** Calibre en ampères : « C16 » → 16, « 20 A » → 20, « 40A 30mA » → 40. */
export function parseAmps(protection: string | undefined | null): number | null {
  if (!protection) return null;
  const m = /(\d+(?:[.,]\d+)?)/.exec(protection);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Section en mm² : « 2,5 mm² » → 2.5. */
export function parseSection(section: string | undefined | null): number | null {
  if (!section) return null;
  const m = /(\d+(?:[.,]\d+)?)/.exec(section);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 16 → « 16 A » */
export function formatAmps(amps: number): string {
  return `${String(amps).replace('.', ',')} A`;
}

/** 2.5 → « 2,5 mm² » */
export function formatSection(mm2: number): string {
  return `${String(mm2).replace('.', ',')} mm²`;
}

/** Calibre normalisé pour les disjoncteurs divisionnaires (courbe C) : 16 → « C16 ». */
export function breakerName(amps: number): string {
  return `C${amps}`;
}

export interface CircuitLabelInput {
  number?: string;
  name?: string;
  cableSection?: string;
  protection?: string;
}

/** « Circuit 3 – Prises salon – 2,5 mm² – 16 A » (les informations absentes sont omises). */
export function circuitLabel(c: CircuitLabelInput): string {
  const amps = parseAmps(c.protection);
  const section = parseSection(c.cableSection);
  return [
    c.number?.trim() ? `Circuit ${c.number.trim()}` : 'Circuit',
    c.name?.trim(),
    section !== null ? formatSection(section) : c.cableSection?.trim(),
    amps !== null ? formatAmps(amps) : c.protection?.trim(),
  ]
    .filter(Boolean)
    .join(' – ');
}

/** Comparaison de noms sans casse ni accents. */
export function normName(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
