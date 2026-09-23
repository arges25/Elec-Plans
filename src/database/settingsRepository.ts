import type { AppSettings } from '../types';
import { DEFAULT_TEMPLATE_ID } from '../data/electricalPanelTemplates';
import { db } from './db';

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  snapEnabled: true,
  snapDistance: 15,
  gridEnabled: false,
  gridSize: 20,
  showGuides: true,
  commandColor: '#f97316',
  circuitColor: '#2563eb',
  informationColor: '#6b7280',
  lineWidth: 2,
  defaultSymbolScale: 1,
  repeatMode: true,
  vibration: true,
  showCommandNumbers: true,
  favorites: ['prise-16a', 'inter-simple', 'va-et-vient', 'point-lumineux', 'prise-rj45'],
  recentSymbols: [],
  defaultTemplateId: DEFAULT_TEMPLATE_ID,
  onboardingDone: false,
  installHintDismissed: false,
  demoOffered: false,
  remoteReconstructionEnabled: false,
};

export async function loadSettings(): Promise<AppSettings> {
  const stored = await db.settings.get('app');
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}), id: 'app' };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ ...settings, id: 'app' });
}
