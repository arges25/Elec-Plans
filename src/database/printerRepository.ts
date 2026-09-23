import type { PrinterProfile } from '../types';
import { createId } from '../utils/id';
import { db } from './db';

export const IDENTITY_CALIBRATION = { scaleX: 1, scaleY: 1, offsetXMm: 0, offsetYMm: 0 };

export function newPrinterProfile(name: string, kind: PrinterProfile['kind'] = 'system'): PrinterProfile {
  const now = Date.now();
  return { id: createId('prn'), name, kind, calibration: { ...IDENTITY_CALIBRATION }, createdAt: now, updatedAt: now };
}

export const DEFAULT_PRINTER_ID = 'default-printer';

/** Profil par défaut (enregistré seulement lorsqu'il est calibré / modifié). */
function defaultPrinterProfile(): PrinterProfile {
  return { ...newPrinterProfile('Imprimante par défaut', 'system'), id: DEFAULT_PRINTER_ID, createdAt: 0, updatedAt: 0 };
}

/**
 * Liste des profils (lecture seule : utilisable dans une liveQuery).
 * Si aucun profil n'est enregistré, un profil par défaut non calibré est proposé.
 */
export async function listPrinterProfiles(): Promise<PrinterProfile[]> {
  const list = await db.printerProfiles.toArray();
  if (list.length === 0) return [defaultPrinterProfile()];
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function savePrinterProfile(profile: PrinterProfile): Promise<void> {
  await db.printerProfiles.put({ ...profile, updatedAt: Date.now() });
}

export async function deletePrinterProfile(id: string): Promise<void> {
  await db.printerProfiles.delete(id);
}
