import { create } from 'zustand';
import type { AppSettings } from '../types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../database/settingsRepository';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (changes: Partial<AppSettings>) => void;
  toggleFavorite: (symbolId: string) => void;
  pushRecent: (symbolId: string) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const settings = await loadSettings();
    set({ settings, loaded: true });
  },
  update: (changes) => {
    const settings = { ...get().settings, ...changes, id: 'app' as const };
    set({ settings });
    void saveSettings(settings);
  },
  toggleFavorite: (symbolId) => {
    const favs = get().settings.favorites;
    const favorites = favs.includes(symbolId) ? favs.filter((f) => f !== symbolId) : [...favs, symbolId];
    get().update({ favorites });
  },
  pushRecent: (symbolId) => {
    const recent = [symbolId, ...get().settings.recentSymbols.filter((r) => r !== symbolId)].slice(0, 12);
    get().update({ recentSymbols: recent });
  },
}));

export function getSettings(): AppSettings {
  return useSettingsStore.getState().settings;
}
