import { create } from 'zustand';
import { useSaveStatus } from '../store/saveStatusStore';

export type UpdateCheckResult = 'available' | 'up-to-date' | 'offline' | 'unavailable';

interface UpdateState {
  /** Une nouvelle version est téléchargée et attend d'être appliquée. */
  needRefresh: boolean;
  /** L'utilisateur a choisi « Plus tard » : le bandeau est masqué jusqu'au prochain lancement. */
  dismissed: boolean;
  checking: boolean;
  applying: boolean;
}

export const useUpdateStore = create<UpdateState>(() => ({ needRefresh: false, dismissed: false, checking: false, applying: false }));

let registration: ServiceWorkerRegistration | undefined;
let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;
let lastCheck = 0;

/** Vérification automatique au plus une fois par minute (retour au premier plan, reconnexion, minuterie). */
const AUTO_CHECK_INTERVAL_MS = 60_000;

export function setRegistration(reg: ServiceWorkerRegistration | undefined): void {
  registration = reg;
}

export function setUpdater(update: (reload?: boolean) => Promise<void>): void {
  applyUpdate = update;
}

/** Demande au navigateur de télécharger la dernière version publiée, si elle existe. */
export async function checkForUpdate(manual = false): Promise<UpdateCheckResult> {
  if (useUpdateStore.getState().needRefresh) return 'available';
  if (!registration) return 'unavailable';
  if (!manual && Date.now() - lastCheck < AUTO_CHECK_INTERVAL_MS) return 'up-to-date';
  if (!navigator.onLine) return 'offline';
  lastCheck = Date.now();
  useUpdateStore.setState({ checking: true });
  try {
    await registration.update();
  } catch {
    return navigator.onLine ? 'unavailable' : 'offline';
  } finally {
    useUpdateStore.setState({ checking: false });
  }
  return registration.installing || registration.waiting || useUpdateStore.getState().needRefresh ? 'available' : 'up-to-date';
}

/** Applique la mise à jour après la fin de la sauvegarde automatique en cours (4 s au plus), puis recharge l'application. */
export async function installUpdate(): Promise<void> {
  useUpdateStore.setState({ applying: true });
  const deadline = Date.now() + 4000;
  while (['pending', 'saving'].includes(useSaveStatus.getState().status) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
  }
  // Le rechargement est normalement fait dès que la nouvelle version prend la main ;
  // filet de sécurité si la page n'était pas encore gérée par le service worker (première installation).
  window.setTimeout(() => window.location.reload(), 3000);
  if (applyUpdate) await applyUpdate(true);
  else window.location.reload();
}

/** « Version 1.0.0 du 29/09/2026 à 23:33 (f3871be) » */
export function buildLabel(): string {
  const d = new Date(__APP_BUILD__.date);
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `Version ${__APP_VERSION__} du ${date} à ${time} (${__APP_BUILD__.commit})`;
}
