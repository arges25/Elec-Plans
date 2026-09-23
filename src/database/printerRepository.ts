import type { PrinterProfile } from '../types';
import { createId } from '../utils/id';
import { db } from './db';

export const IDENTITY_CALIBRATION = { scaleX: 1, scaleY: 1, offsetXMm: 0, offsetYMm: 0 };

export function newPrinterProfile(name: string, kind: PrinterProfile['kind'] = 'system'): PrinterProfile {
  const now = Date.now();
  return { id: createId('prn'), name, kind, calibration: { ...IDENTITY_CALIBRATION }, createdAt: now, updatedAt: now };
}

export async function listPrinterProfiles(): Promise<PrinterProfile[]> {
  const list = await db.printerProfiles.toArray();
  if (list.length === 0) {
    const def = newPrinterProfile('Imprimante par défaut', 'system');
    await db.printerProfiles.add(def);
    return [def];
  }
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function savePrinterProfile(profile: PrinterProfile): Promise<void> {
  await db.printerProfiles.put({ ...profile, updatedAt: Date.now() });
}

export async function deletePrinterProfile(id: string): Promise<void> {
  await db.printerProfiles.delete(id);
}
