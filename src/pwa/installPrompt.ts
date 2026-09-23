import { create } from 'zustand';

/** Événement `beforeinstallprompt` (Chrome / Edge / Android). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  setDeferred: (e: BeforeInstallPromptEvent | null) => void;
  setInstalled: (v: boolean) => void;
}

export const useInstallStore = create<InstallState>((set) => ({
  deferred: null,
  installed: false,
  setDeferred: (deferred) => set({ deferred }),
  setInstalled: (installed) => set({ installed }),
}));

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || iPadOs;
}

/** À appeler au démarrage : capture l'invite d'installation pour l'afficher plus tard. */
export function initInstallPromptCapture(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstallStore.getState().setDeferred(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => {
    useInstallStore.getState().setDeferred(null);
    useInstallStore.getState().setInstalled(true);
  });
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const deferred = useInstallStore.getState().deferred;
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const choice = await deferred.userChoice;
  useInstallStore.getState().setDeferred(null);
  return choice.outcome;
}
