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

const AUTO_APPLY_KEY = 'mg-update-auto-applied-at';
const LAST_BUILD_KEY = 'mg-last-build';

/**
 * Au lancement : si une nouvelle version a déjà été téléchargée lors d'une utilisation précédente
 * (elle attend depuis), elle est installée tout de suite — fermer / rouvrir l'application suffit.
 * Une seule tentative par minute, pour ne jamais recharger en boucle.
 */
export function autoApplyWaitingUpdate(reg: ServiceWorkerRegistration | undefined): boolean {
  if (!reg?.waiting || !navigator.serviceWorker?.controller) return false;
  try {
    const last = Number(sessionStorage.getItem(AUTO_APPLY_KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(AUTO_APPLY_KEY, String(Date.now()));
  } catch {
    return false;
  }
  void installUpdate();
  return true;
}

/** Après une mise à jour (version différente de la dernière ouverte) : « Application mise à jour ✓ ». */
export function takeUpdateAnnouncement(): string | null {
  const current = `${__APP_BUILD__.commit}|${__APP_BUILD__.date}`;
  try {
    const previous = localStorage.getItem(LAST_BUILD_KEY);
    localStorage.setItem(LAST_BUILD_KEY, current);
    // Sans version mémorisée : première ouverture après installation (page pas encore gérée par le
    // service worker), ou mise à jour depuis une version antérieure à ce mécanisme (page déjà gérée).
    const updated = previous ? previous !== current : Boolean(navigator.serviceWorker?.controller);
    return updated ? `Application mise à jour ✓ (version du ${buildDate()})` : null;
  } catch {
    return null;
  }
}

function buildDate(): string {
  return new Date(__APP_BUILD__.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** « Version 1.0.0 du 29/09/2026 à 23:33 (f3871be) » */
export function buildLabel(): string {
  const time = new Date(__APP_BUILD__.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `Version ${__APP_VERSION__} du ${buildDate()} à ${time} (${__APP_BUILD__.commit})`;
}
